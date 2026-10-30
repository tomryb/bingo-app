import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:net";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { io } from "socket.io-client";
import { TEXTS_VERSION } from "../src/textsVersion.ts";

function nextEvent(socket, event, matches = () => true) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(event, onEvent);
      reject(new Error(`Timed out waiting for ${event}`));
    }, 5000);
    function onEvent(value) {
      if (!matches(value)) return;
      clearTimeout(timer);
      socket.off(event, onEvent);
      resolve(value);
    }
    socket.on(event, onEvent);
  });
}

async function unusedPort() {
  const listener = createServer();
  listener.listen(0, "127.0.0.1");
  await once(listener, "listening");
  const { port } = listener.address();
  await new Promise((resolve, reject) =>
    listener.close((error) => (error ? reject(error) : resolve())),
  );
  return port;
}

test(
  "Socket.IO preserves room size, boards, winner order, readiness and exit flow",
  { timeout: 20000 },
  async (t) => {
    const port = await unusedPort();
    const child = spawn(process.execPath, ["--import", "tsx", "index.ts"], {
      cwd: fileURLToPath(new URL(".", import.meta.url)),
      env: { ...process.env, PORT: String(port) },
      stdio: ["ignore", "pipe", "pipe"],
    });
    const clients = [];
    t.after(async () => {
      for (const client of clients) client.disconnect();
      if (child.exitCode === null) {
        const exited = once(child, "exit");
        child.kill();
        await exited;
      }
    });
    await new Promise((resolve, reject) => {
      let output = "";
      const timer = setTimeout(
        () => reject(new Error(`Server startup timeout: ${output}`)),
        8000,
      );
      child.stdout.on("data", (chunk) => {
        output += chunk;
        if (output.includes("Socket server running")) {
          clearTimeout(timer);
          resolve();
        }
      });
      child.stderr.on("data", (chunk) => {
        output += chunk;
      });
      child.once("error", (error) => {
        clearTimeout(timer);
        reject(error);
      });
      child.once("exit", (code) => {
        clearTimeout(timer);
        reject(new Error(`Server exited (${code}): ${output}`));
      });
    });

    async function connect() {
      const client = io(`http://127.0.0.1:${port}`, {
        autoConnect: false,
        reconnection: false,
      });
      clients.push(client);
      const connected = nextEvent(client, "connect");
      client.connect();
      await connected;
      return client;
    }
    const first = await connect();
    const second = await connect();
    const roomId = "regression-room";
    async function join(client, user, size) {
      const assigned = nextEvent(client, "join-accepted");
      client.emit("join-room", {
        roomId,
        user,
        size,
        textsVersion: TEXTS_VERSION,
      });
      return assigned;
    }
    const firstBoard = await join(first, "Ania", 3);
    const secondBoard = await join(second, "Kuba", 5);
    assert.equal(firstBoard.size, 3);
    assert.equal(secondBoard.size, 3);
    assert.notDeepEqual(firstBoard.boardTexts, secondBoard.boardTexts);
    assert.equal(firstBoard.roundId, secondBoard.roundId);

    const ownMark = nextEvent(second, "mark");
    first.emit("mark", { roomId, roundId: firstBoard.roundId, index: 8 });
    const mark = await ownMark;
    assert.deepEqual(mark, {
      roomId,
      roundId: firstBoard.roundId,
      user: "Ania",
      text: firstBoard.boardTexts[8],
      marked: true,
    });
    const firstEnded = nextEvent(first, "round-ended");
    const secondEnded = nextEvent(second, "round-ended");
    for (const index of [0, 1, 2])
      second.emit("mark", { roomId, roundId: secondBoard.roundId, index });
    const [summary, otherSummary] = await Promise.all([
      firstEnded,
      secondEnded,
    ]);
    assert.deepEqual(summary, otherSummary);
    assert.equal(summary.players[0].id, second.id);
    assert.equal(summary.players[1].markedCount, 1);

    const readyState = nextEvent(first, "round-ready", (state) =>
      state.ready.includes(first.id),
    );
    first.emit("round-restart", { roomId, roundId: summary.roundId });
    assert.deepEqual((await readyState).ready, [first.id]);
    const firstRestarted = nextEvent(first, "join-accepted");
    const secondRestarted = nextEvent(second, "join-accepted");
    second.emit("round-restart", { roomId, roundId: summary.roundId });
    const [newFirst, newSecond] = await Promise.all([
      firstRestarted,
      secondRestarted,
    ]);
    assert.notEqual(newFirst.roundId, firstBoard.roundId);
    assert.notDeepEqual(newFirst.boardTexts, newSecond.boardTexts);

    const left = nextEvent(first, "user-left");
    second.emit("leave-room", { roomId });
    assert.deepEqual(await left, { roomId, id: second.id, user: "Kuba" });
    first.emit("leave-room", { roomId });
    const info = await new Promise((resolve, reject) => {
      first
        .timeout(3000)
        .emit("watch-room", { roomId }, (error, value) =>
          error ? reject(error) : resolve(value),
        );
    });
    assert.deepEqual(info, { roomId, size: null });
  },
);
