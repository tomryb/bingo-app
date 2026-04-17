import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";
import texts from "../src/data/texts";
import { computeTextsVersion } from "../src/shared/textsVersion";

const app = express();
app.use(cors());

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
  },
});

const SERVER_TEXTS_VERSION = computeTextsVersion(texts);

interface RoomState {
  size: 3 | 4 | 5;
  marked: Record<string, boolean[]>;
  usernames: Record<string, string>;
}

const rooms = new Map<string, RoomState>();

io.on("connection", (socket) => {
  console.log("User connected", socket.id);

  socket.on(
    "join-room",
    ({
      roomId,
      size,
      user,
      textsVersion,
    }: {
      roomId: string;
      size: 3 | 4 | 5;
      user?: string;
      textsVersion?: string;
    }) => {
      if (!textsVersion || textsVersion !== SERVER_TEXTS_VERSION) {
        io.to(socket.id).emit("texts-version-mismatch", {
          client: textsVersion ?? "missing",
          server: SERVER_TEXTS_VERSION,
        });
        io.to(socket.id).emit("join-rejected", {
          reason: "texts-version-mismatch",
          serverTextsVersion: SERVER_TEXTS_VERSION,
        });
        return;
      }

      const requestedSize = size === 3 || size === 4 || size === 5 ? size : 5;

      socket.join(roomId);

      if (!rooms.has(roomId)) {
        rooms.set(roomId, {
          size: requestedSize,
          marked: {},
          usernames: {},
        });
      }

      const room = rooms.get(roomId)!;
      room.marked[socket.id] = Array(room.size * room.size).fill(false);
      room.usernames[socket.id] = user ?? socket.id;

      io.to(socket.id).emit("room-state", {
        size: room.size,
        players: Object.values(room.usernames),
        textsVersion: SERVER_TEXTS_VERSION,
      });

      io.to(socket.id).emit("join-accepted", {
        roomId,
        size: room.size,
        textsVersion: SERVER_TEXTS_VERSION,
      });

      io.to(roomId).emit("user-joined", room.usernames[socket.id]);
    },
  );

  socket.on("mark", ({ roomId, index }: { roomId: string; index: number }) => {
    const room = rooms.get(roomId);
    if (!room) return;

    const board = room.marked[socket.id];
    if (!board) return;
    if (typeof index !== "number" || index < 0 || index >= board.length) return;

    board[index] = !board[index];

    const roomTexts = texts.slice(0, room.size * room.size);
    const text = roomTexts[index] ?? String(index);

    socket.to(roomId).emit("mark", {
      user: room.usernames[socket.id] ?? socket.id,
      text,
    });
  });

  socket.on("bingo", ({ roomId }) => {
    const room = rooms.get(roomId);
    const name = room ? (room.usernames[socket.id] ?? socket.id) : socket.id;
    socket.to(roomId).emit("bingo", name);
  });

  socket.on("disconnect", () => {
    rooms.forEach((room, key) => {
      delete room.marked[socket.id];
      if (Object.keys(room.marked).length === 0) {
        rooms.delete(key);
      }
    });
  });
});

const DEFAULT_PORT = 3001;
const envPort = Number.parseInt(process.env.PORT ?? "", 10);
const port = Number.isFinite(envPort) ? envPort : DEFAULT_PORT;

server.listen(port, () => {
  console.log(`Socket server running on :${port}`);
});
