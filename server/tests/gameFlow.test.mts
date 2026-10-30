import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:net";
import test, { type TestContext } from "node:test";
import { fileURLToPath } from "node:url";
import { io, type Socket } from "socket.io-client";
import {
  MAX_PLAYER_NAME_LENGTH,
  MAX_ROOM_NAME_LENGTH,
} from "../../src/shared/limits.ts";
import { TEXTS_VERSION } from "../../src/textsVersion.ts";
import type { BoardSize, RoomInfo } from "../../src/types/bingo.ts";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
} from "../../src/types/socket.ts";

type TestSocket = Socket<ServerToClientEvents, ClientToServerEvents>;
type EventPayload<K extends keyof ServerToClientEvents> = Parameters<
  ServerToClientEvents[K]
>[0];

function nextEvent<K extends keyof ServerToClientEvents>(
  socket: TestSocket,
  event: K,
  matches: (value: EventPayload<K>) => boolean = () => true,
) {
  return new Promise<EventPayload<K>>((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.offAny(onEvent);
      reject(new Error(`Timed out waiting for ${event}`));
    }, 5000);
    function onEvent(received: string, value: EventPayload<K>) {
      if (received !== event) return;
      if (!matches(value)) return;
      clearTimeout(timer);
      socket.offAny(onEvent);
      resolve(value);
    }
    socket.onAny(onEvent);
  });
}

async function unusedPort() {
  const listener = createServer();
  listener.listen(0, "127.0.0.1");
  await once(listener, "listening");
  const address = listener.address();
  assert.ok(address && typeof address !== "string");
  const { port } = address;
  await new Promise<void>((resolve, reject) =>
    listener.close((error) => (error ? reject(error) : resolve())),
  );
  return port;
}

async function startServer(t: TestContext) {
  const port = await unusedPort();
  const child = spawn(process.execPath, ["--import", "tsx", "index.ts"], {
    cwd: fileURLToPath(new URL("..", import.meta.url)),
    env: { ...process.env, PORT: String(port) },
    stdio: ["ignore", "pipe", "pipe"],
  });
  const clients: TestSocket[] = [];
  const warnings: string[] = [];
  child.stderr.on("data", (chunk) => warnings.push(String(chunk)));
  t.after(async () => {
    for (const client of clients) client.disconnect();
    if (child.exitCode === null) {
      const exited = once(child, "exit");
      child.kill();
      await exited;
    }
  });
  await new Promise<void>((resolve, reject) => {
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
    const client: TestSocket = io(`http://127.0.0.1:${port}`, {
      autoConnect: false,
      reconnection: false,
    });
    clients.push(client);
    const connected = new Promise<void>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error("Connection timed out")),
        5000,
      );
      client.once("connect", () => {
        clearTimeout(timer);
        resolve();
      });
      client.once("connect_error", (error) => {
        clearTimeout(timer);
        reject(error);
      });
    });
    client.connect();
    await connected;
    return client;
  }
  return Object.assign(connect, { warnings });
}

async function join(
  client: TestSocket,
  roomId: string,
  user: string,
  size: BoardSize = 3,
  joinRequestId?: string,
) {
  const assigned = nextEvent(client, "join-accepted");
  client.emit("join-room", {
    roomId,
    user,
    size,
    textsVersion: TEXTS_VERSION,
    ...(joinRequestId === undefined ? {} : { joinRequestId }),
  });
  return assigned;
}

// Engine.IO wraps this Socket.IO EVENT packet; intentionally bypass static types.
function emitRaw(client: TestSocket, event: string, ...args: unknown[]) {
  client.io.engine.write(`2${JSON.stringify([event, ...args])}`);
}

// An ACK is an ordering barrier: earlier messages on this connection were processed.
function sync(client: TestSocket, roomId: string) {
  return new Promise<RoomInfo>((resolve, reject) => {
    client
      .timeout(3000)
      .emit("watch-room", { roomId }, (error, value) =>
        error ? reject(error) : resolve(value),
      );
  });
}

function observe(client: TestSocket) {
  const marks: EventPayload<"mark">[] = [];
  const summaries: EventPayload<"round-ended">[] = [];
  client.on("mark", (value) => marks.push(value));
  client.on("round-ended", (value) => summaries.push(value));
  return { marks, summaries };
}

test("absolute marks acknowledge authoritative state and retries do not toggle or notify twice", async (t) => {
  const connect = await startServer(t);
  const first = await connect();
  const second = await connect();
  const roomId = "absolute-marks";
  const board = await join(first, roomId, "A");
  await join(second, roomId, "B");
  const outsider = await connect();
  const denied = await outsider.timeout(3000).emitWithAck("set-mark", {
    roomId,
    roundId: board.roundId,
    index: 0,
    marked: true,
  });
  assert.equal(denied.accepted, false);
  assert.deepEqual(denied.selected, []);
  const observed = observe(second);
  const mark = (index: number, marked: boolean, roundId = board.roundId) =>
    first
      .timeout(3000)
      .emitWithAck("set-mark", { roomId, roundId, index, marked });
  const accepted = await mark(0, true);
  assert.equal(accepted.accepted, true);
  assert.deepEqual(accepted.selected, [
    true,
    false,
    false,
    false,
    false,
    false,
    false,
    false,
    false,
  ]);
  assert.deepEqual(await mark(0, true), accepted);
  await sync(second, roomId);
  assert.equal(observed.marks.length, 1);
  assert.equal((await mark(0, false)).selected[0], false);
  assert.equal((await mark(1, true, "stale")).accepted, false);
  await mark(0, true);
  await mark(1, true);
  await mark(2, true);
  const afterFinal = await mark(4, true);
  assert.equal(afterFinal.accepted, false);
  assert.equal(afterFinal.selected[4], false);
  assert.equal((await mark(2, true)).accepted, true);
  await sync(second, roomId);
  assert.equal(observed.marks.length, 5);
  assert.equal(observed.summaries.length, 1);
});

test("names are unique within a room and released when a player leaves", async (t) => {
  const connect = await startServer(t);
  const first = await connect();
  const second = await connect();
  const roomId = "unique-names";
  const board = await join(first, roomId, "Tomasz");
  for (const user of ["Tomasz", "  tOMASZ  ", "Ｔｏｍａｓｚ"]) {
    const rejected = nextEvent(second, "join-rejected");
    second.emit("join-room", {
      roomId,
      user,
      size: 3,
      textsVersion: TEXTS_VERSION,
      joinRequestId: "occupied-name",
    });
    assert.deepEqual(await rejected, {
      reason: "name-taken",
      joinRequestId: "occupied-name",
    });
  }
  const state = nextEvent(first, "room-state");
  assert.equal((await join(first, roomId, "Tomasz")).roundId, board.roundId);
  assert.deepEqual((await state).players, [{ id: first.id, user: "Tomasz" }]);
  await join(second, "another-room", "Tomasz");
  second.emit("leave-room", { roomId: "another-room" });
  await sync(second, "another-room");
  await join(second, roomId, "Tomasz2");
  first.emit("leave-room", { roomId });
  await sync(first, roomId);
  const third = await connect();
  await join(third, roomId, "Tomasz");
});

test("Socket.IO preserves room size, boards, winner order, readiness and exit flow", {
  timeout: 20000,
}, async (t) => {
  const connect = await startServer(t);
  const first = await connect();
  const second = await connect();
  const firstId = first.id;
  assert.ok(firstId);
  const roomId = "regression-room";
  const firstBoard = await join(first, roomId, "Ania", 3, "initial-join");
  const secondBoard = await join(second, roomId, "Kuba", 5);
  assert.equal(firstBoard.size, 3);
  assert.equal(firstBoard.joinRequestId, "initial-join");
  assert.equal("joinRequestId" in secondBoard, false);
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
  const [summary, otherSummary] = await Promise.all([firstEnded, secondEnded]);
  assert.deepEqual(summary, otherSummary);
  assert.equal(summary.players[0].id, second.id);
  assert.equal(summary.players[1].markedCount, 1);

  const readyState = nextEvent(first, "round-ready", (state) =>
    state.ready.includes(firstId),
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
  assert.equal("joinRequestId" in newFirst, false);
  assert.equal("joinRequestId" in newSecond, false);
  assert.notDeepEqual(newFirst.boardTexts, newSecond.boardTexts);

  const left = nextEvent(first, "user-left");
  second.emit("leave-room", { roomId });
  assert.deepEqual(await left, { roomId, id: second.id, user: "Kuba" });
  first.emit("leave-room", { roomId });
  const info = await sync(first, roomId);
  assert.deepEqual(info, { roomId, size: null });
});

test("invalid, foreign and stale marks cannot change a round or its final snapshot", {
  timeout: 20000,
}, async (t) => {
  const connect = await startServer(t);
  const first = await connect();
  const second = await connect();
  const outsider = await connect();
  const roomId = "guarded-room";
  const board = await join(first, roomId, "Ania");
  await join(second, roomId, "Kuba");
  const otherBoard = await join(outsider, "other-room", "Ola");
  const received = observe(second);
  const foreign = observe(outsider);

  for (const index of [-1, 9, 1.5, Number.NaN]) {
    first.emit("mark", { roomId, roundId: board.roundId, index });
  }
  first.emit("mark", { roomId, roundId: "old-round", index: 0 });
  first.emit("mark", {
    roomId: "other-room",
    roundId: otherBoard.roundId,
    index: 0,
  });
  first.emit("mark", {
    roomId: "missing-room",
    roundId: board.roundId,
    index: 0,
  });
  outsider.emit("mark", { roomId, roundId: board.roundId, index: 0 });
  await sync(first, roomId);
  await sync(outsider, roomId);
  await sync(second, roomId);
  assert.deepEqual(received, { marks: [], summaries: [] });
  assert.deepEqual(foreign, { marks: [], summaries: [] });

  const ended = nextEvent(second, "round-ended");
  for (const index of [0, 1, 2]) {
    first.emit("mark", { roomId, roundId: board.roundId, index });
  }
  const summary = await ended;
  assert.deepEqual(
    summary.players.map((player) => player.markedCount),
    [3, 0],
  );
  const snapshot = structuredClone(summary);
  first.emit("mark", { roomId, roundId: board.roundId, index: 4 });
  second.emit("mark", { roomId, roundId: board.roundId, index: 0 });
  await sync(first, roomId);
  await sync(second, roomId);
  assert.equal(received.marks.length, 3);
  assert.deepEqual(received.summaries, [snapshot]);

  const lateSummary = nextEvent(outsider, "round-ended");
  await join(outsider, roomId, "Ola");
  assert.deepEqual(await lateSummary, snapshot);

  const restarted = nextEvent(first, "join-accepted");
  for (const client of [first, second, outsider]) {
    client.emit("round-restart", { roomId, roundId: board.roundId });
  }
  const newBoard = await restarted;
  first.emit("mark", { roomId, roundId: board.roundId, index: 0 });
  await sync(first, roomId);
  await sync(second, roomId);
  assert.equal(received.marks.length, 3);
  const validMark = nextEvent(second, "mark");
  first.emit("mark", { roomId, roundId: newBoard.roundId, index: 0 });
  assert.equal((await validMark).marked, true);
});

test("nearly simultaneous BINGOs produce exactly one shared winner and final", {
  timeout: 20000,
}, async (t) => {
  const connect = await startServer(t);
  const first = await connect();
  const second = await connect();
  const roomId = "race-room";
  const board = await join(first, roomId, "Ania");
  await join(second, roomId, "Kuba");
  const firstEvents = observe(first);
  const secondEvents = observe(second);
  for (const client of [first, second]) {
    for (const index of [0, 1]) {
      client.emit("mark", { roomId, roundId: board.roundId, index });
    }
    await sync(client, roomId);
  }
  const firstEnded = nextEvent(first, "round-ended");
  const secondEnded = nextEvent(second, "round-ended");
  first.emit("mark", { roomId, roundId: board.roundId, index: 2 });
  second.emit("mark", { roomId, roundId: board.roundId, index: 2 });
  const [summary, otherSummary] = await Promise.all([firstEnded, secondEnded]);
  await sync(first, roomId);
  await sync(second, roomId);
  assert.deepEqual(summary, otherSummary);
  assert.ok([first.id, second.id].includes(summary.winner.id));
  assert.equal(summary.players[0].id, summary.winner.id);
  assert.deepEqual(
    summary.players.map((player) => player.markedCount),
    [3, 2],
  );
  assert.deepEqual(firstEvents.summaries, [summary]);
  assert.deepEqual(secondEvents.summaries, [summary]);
});

test("disconnecting during play removes the player; reconnecting starts a clean board", {
  timeout: 20000,
}, async (t) => {
  const connect = await startServer(t);
  const first = await connect();
  const second = await connect();
  const roomId = "disconnect-room";
  const board = await join(first, roomId, "Ania");
  await join(second, roomId, "Kuba");
  first.emit("mark", { roomId, roundId: board.roundId, index: 0 });
  const marked = nextEvent(first, "mark");
  second.emit("mark", { roomId, roundId: board.roundId, index: 4 });
  await marked;
  const oldId = second.id;
  const left = nextEvent(first, "user-left");
  const remaining = nextEvent(
    first,
    "room-state",
    (state) => state.players.length === 1,
  );
  second.disconnect();
  assert.deepEqual(await left, { roomId, id: oldId, user: "Kuba" });
  assert.deepEqual((await remaining).players, [{ id: first.id, user: "Ania" }]);

  const reconnected = await connect();
  const newBoard = await join(reconnected, roomId, "Kuba");
  assert.notEqual(reconnected.id, oldId);
  assert.equal(newBoard.roundId, board.roundId);
  const freshMark = nextEvent(first, "mark");
  reconnected.emit("mark", { roomId, roundId: board.roundId, index: 4 });
  assert.equal((await freshMark).marked, true);
  const ended = nextEvent(first, "round-ended");
  for (const index of [1, 2]) {
    first.emit("mark", { roomId, roundId: board.roundId, index });
  }
  const summary = await ended;
  assert.deepEqual(
    summary.players.map((player) => [player.id, player.markedCount]),
    [
      [first.id, 3],
      [reconnected.id, 1],
    ],
  );
  const lastLeft = nextEvent(first, "user-left");
  reconnected.disconnect();
  await lastLeft;
  first.emit("leave-room", { roomId });
  assert.deepEqual(await sync(first, roomId), { roomId, size: null });
});

test("disconnects remove ready players and stop absent players blocking a replay", {
  timeout: 20000,
}, async (t) => {
  const connect = await startServer(t);
  const first = await connect();
  const second = await connect();
  const third = await connect();
  const roomId = "readiness-room";
  const board = await join(first, roomId, "Ania");
  await join(second, roomId, "Kuba");
  await join(third, roomId, "Ola");
  const ended = nextEvent(second, "round-ended");
  for (const index of [0, 1, 2]) {
    first.emit("mark", { roomId, roundId: board.roundId, index });
  }
  const summary = await ended;
  const ready = nextEvent(
    second,
    "round-ready",
    (state) => state.ready.length === 1,
  );
  first.emit("round-restart", { roomId, roundId: summary.roundId });
  assert.deepEqual((await ready).ready, [first.id]);
  const removed = nextEvent(
    second,
    "round-ready",
    (state) => state.members.length === 2,
  );
  first.disconnect();
  const readiness = await removed;
  assert.deepEqual(readiness.ready, []);
  assert.deepEqual(new Set(readiness.members), new Set([second.id, third.id]));

  const secondReady = nextEvent(
    second,
    "round-ready",
    (state) => state.ready.length === 1,
  );
  second.emit("round-restart", { roomId, roundId: summary.roundId });
  await secondReady;
  const restarted = nextEvent(second, "join-accepted");
  third.disconnect();
  const newBoard = await restarted;
  assert.notEqual(newBoard.roundId, summary.roundId);
  const state = nextEvent(second, "room-state");
  const newcomer = await connect();
  await join(newcomer, roomId, "Iga");
  assert.deepEqual((await state).players, [
    { id: second.id, user: "Kuba" },
    { id: newcomer.id, user: "Iga" },
  ]);
  const mark = nextEvent(newcomer, "mark");
  second.emit("mark", { roomId, roundId: newBoard.roundId, index: 0 });
  assert.equal((await mark).marked, true);
});

test("malformed socket requests are rejected without crashing or mutating a game", {
  timeout: 20000,
}, async (t) => {
  const connect = await startServer(t);
  const first = await connect();
  const second = await connect();
  const roomId = "validated-room";
  const board = await join(first, roomId, "Ania");
  await join(second, roomId, "Kuba");
  const events = observe(second);
  const member = { roomId, roundId: board.roundId };
  const validJoin = {
    roomId,
    user: "Ania",
    size: 3,
    textsVersion: TEXTS_VERSION,
  };
  const malformed: { event: string; args: unknown[] }[] = [];
  for (const event of [
    "watch-room",
    "join-room",
    "leave-room",
    "mark",
    "set-mark",
    "round-restart",
  ]) {
    for (const payload of [null, false, 42, "private-payload", [], {}]) {
      malformed.push({ event, args: [payload] });
    }
    malformed.push({ event, args: [] });
    for (const roomId of [
      "",
      " \t ",
      "r".repeat(MAX_ROOM_NAME_LENGTH + 1),
      123,
      null,
    ]) {
      malformed.push({
        event,
        args: [{ ...validJoin, ...member, index: 0, roomId }],
      });
    }
  }
  malformed.push(
    { event: "watch-room", args: [{ roomId }] },
    { event: "watch-room", args: [{ roomId }, "not-an-ack"] },
    { event: "set-mark", args: [{ ...member, index: 0, marked: true }] },
    {
      event: "set-mark",
      args: [{ ...member, index: 0, marked: true }, "not-an-ack"],
    },
    { event: "unwatch-room", args: [null] },
    { event: "unwatch-room", args: [{}] },
    { event: "unknown-private-event", args: ["private-payload"] },
  );
  for (const user of [
    "",
    "  ",
    "u".repeat(MAX_PLAYER_NAME_LENGTH + 1),
    null,
    123,
    [],
  ]) {
    malformed.push({ event: "join-room", args: [{ ...validJoin, user }] });
  }
  for (const size of [0, 2, 6, 3.5, "3", null]) {
    malformed.push({ event: "join-room", args: [{ ...validJoin, size }] });
  }
  for (const textsVersion of [null, 123, {}, []]) {
    malformed.push({
      event: "join-room",
      args: [{ ...validJoin, textsVersion }],
    });
  }
  for (const joinRequestId of [null, 123, {}, []]) {
    malformed.push({
      event: "join-room",
      args: [{ ...validJoin, joinRequestId }],
    });
  }
  for (const index of [-1, 9, 25, 1.5, null, "0", {}, Number.NaN]) {
    malformed.push({ event: "mark", args: [{ ...member, index }] });
    malformed.push({
      event: "set-mark",
      args: [{ ...member, index, marked: true }, () => {}],
    });
  }
  for (const marked of [undefined, null, "true", 1, {}]) {
    malformed.push({
      event: "set-mark",
      args: [{ ...member, index: 0, marked }, () => {}],
    });
  }
  for (const event of ["mark", "set-mark", "round-restart"]) {
    for (const roundId of [undefined, null, "", [], 123, "x".repeat(81)]) {
      malformed.push({
        event,
        args: [
          { ...member, index: 0, roundId, marked: true },
          ...(event === "set-mark" ? [() => {}] : []),
        ],
      });
    }
  }
  for (const { event, args } of malformed) {
    const rejected = nextEvent(first, "request-rejected");
    emitRaw(first, event, ...args);
    const rejection = await rejected;
    assert.equal(rejection.event, event);
    assert.equal(typeof rejection.reason, "string");
    assert.ok(rejection.reason.length > 0);
    assert.deepEqual(Object.keys(rejection).sort(), ["event", "reason"]);
  }
  for (const joinRequestId of ["stale-request", "new-request", ""]) {
    const rejected = nextEvent(first, "request-rejected");
    emitRaw(first, "join-room", { ...validJoin, size: 2, joinRequestId });
    assert.deepEqual(await rejected, {
      event: "join-room",
      reason: "invalid-payload",
      joinRequestId,
    });
  }
  assert.deepEqual(await sync(first, roomId), { roomId, size: 3 });
  await sync(second, roomId);
  assert.deepEqual(events, { marks: [], summaries: [] });
  const mark = nextEvent(second, "mark");
  first.emit("mark", { ...member, index: 0 });
  assert.equal((await mark).marked, true);
  const newcomer = await connect();
  assert.equal((await join(newcomer, "responsive-room", "Ola")).size, 3);
  assert.equal(connect.warnings.join("").includes("private-payload"), false);
  assert.equal(
    connect.warnings.join("").includes("unknown-private-event"),
    false,
  );
  for (const line of connect.warnings.join("").trim().split(/\r?\n/)) {
    assert.match(
      line,
      /^Rejected socket event: (watch-room|unwatch-room|join-room|leave-room|mark|set-mark|round-restart|unknown-event)$/,
    );
  }
});

test("room and user normalization preserves version rejection and valid joins", {
  timeout: 20000,
}, async (t) => {
  const connect = await startServer(t);
  const client = await connect();
  const roomId = "normalized-room";
  for (const textsVersion of [undefined, "", "stale-version"]) {
    const correlation =
      textsVersion === undefined
        ? {}
        : { joinRequestId: `version-${textsVersion}` };
    const mismatch = nextEvent(client, "texts-version-mismatch");
    const rejected = nextEvent(client, "join-rejected");
    emitRaw(client, "join-room", {
      roomId,
      size: 3,
      user: "Ania",
      textsVersion,
      ...correlation,
    });
    assert.deepEqual(await mismatch, {
      client: textsVersion ?? "missing",
      server: TEXTS_VERSION,
    });
    assert.deepEqual(await rejected, {
      reason: "texts-version-mismatch",
      serverTextsVersion: TEXTS_VERSION,
      ...correlation,
    });
    assert.equal((await sync(client, roomId)).size, null);
  }
  for (const size of [4, 5]) {
    const correlation = size === 4 ? {} : { joinRequestId: "insufficient-5" };
    const rejected = nextEvent(client, "join-rejected");
    emitRaw(client, "join-room", {
      roomId: `insufficient-texts-${size}`,
      user: "Ania",
      size,
      textsVersion: TEXTS_VERSION,
      ...correlation,
    });
    assert.deepEqual(await rejected, {
      reason: "not-enough-texts",
      ...correlation,
    });
  }
  const state = nextEvent(client, "room-state");
  const board = await join(client, `  ${roomId}  `, "  Ania  ", 3, "join-123");
  assert.equal(board.roomId, roomId);
  assert.equal(board.joinRequestId, "join-123");
  assert.deepEqual((await state).players, [{ id: client.id, user: "Ania" }]);
  assert.deepEqual(await sync(client, ` ${roomId} `), { roomId, size: 3 });
  client.emit("unwatch-room");
  const repeated = await join(client, roomId, "Ania", 5, "repeat-join");
  assert.equal(repeated.size, 3);
  assert.equal(repeated.joinRequestId, "repeat-join");
  client.emit("leave-room", { roomId: `  ${roomId} ` });
  assert.deepEqual(await sync(client, roomId), { roomId, size: null });
  const boundaryRoom = "r".repeat(MAX_ROOM_NAME_LENGTH);
  const boundaryUser = "u".repeat(MAX_PLAYER_NAME_LENGTH);
  const boundaryState = nextEvent(client, "room-state");
  await join(client, boundaryRoom, boundaryUser);
  assert.deepEqual((await boundaryState).players, [
    { id: client.id, user: boundaryUser },
  ]);
});
