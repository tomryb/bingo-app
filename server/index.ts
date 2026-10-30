import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";
import { randomUUID } from "node:crypto";
import texts from "../src/data/texts";
import { computeTextsVersion } from "../src/shared/textsVersion";
import { checkBingo } from "../src/utils/checkBingo";
import { createBoard } from "./board";
import type { RoomInfo, RoundSummary } from "../src/types/bingo";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
} from "../src/types/socket";

const app = express();
app.use(cors());

const server = http.createServer(app);

const io = new Server<ClientToServerEvents, ServerToClientEvents>(server, {
  cors: {
    origin: "*",
  },
});

const SERVER_TEXTS_VERSION = computeTextsVersion(texts);

interface RoomState {
  size: 3 | 4 | 5;
  marked: Record<string, boolean[]>;
  usernames: Record<string, string>;
  boards: Record<string, string[]>;
  roundId: string;
  summary: RoundSummary | null;
  ready: Set<string>;
}

const rooms = new Map<string, RoomState>();
const roomWatchers = new Map<string, string>();

function sendBoard(socketId: string, roomId: string, room: RoomState) {
  io.to(socketId).emit("join-accepted", {
    roomId,
    size: room.size,
    textsVersion: SERVER_TEXTS_VERSION,
    boardTexts: room.boards[socketId],
    roundId: room.roundId,
  });
}

function updateReadiness(roomId: string, room: RoomState) {
  if (!room.summary) return;
  const members = Object.keys(room.usernames);
  if (members.length > 0 && members.every((id) => room.ready.has(id))) {
    const previousBoards = Object.values(room.boards);
    room.roundId = randomUUID();
    room.summary = null;
    room.ready.clear();
    for (const id of members) {
      room.marked[id] = Array<boolean>(room.size * room.size).fill(false);
      room.boards[id] = createBoard(texts, room.size, [
        ...previousBoards,
        ...Object.values(room.boards),
      ]);
      sendBoard(id, roomId, room);
    }
  } else {
    io.to(roomId).emit("round-ready", {
      roomId,
      roundId: room.roundId,
      ready: [...room.ready],
      members,
    });
  }
}

function getRoomInfo(roomId: string): RoomInfo {
  return { roomId, size: rooms.get(roomId)?.size ?? null };
}

function broadcastRoomState(roomId: string) {
  for (const [socketId, watchedRoom] of roomWatchers) {
    if (watchedRoom === roomId) {
      io.to(socketId).emit("room-info", getRoomInfo(roomId));
    }
  }
  const room = rooms.get(roomId);
  if (!room) return;
  io.to(roomId).emit("room-state", {
    roomId,
    size: room.size,
    players: Object.values(room.usernames),
    textsVersion: SERVER_TEXTS_VERSION,
  });
}

function removeRoomPlayer(socketId: string, roomId: string) {
  const room = rooms.get(roomId);
  if (!room || !(socketId in room.marked)) return;
  const user = room.usernames[socketId];
  delete room.marked[socketId];
  delete room.usernames[socketId];
  delete room.boards[socketId];
  room.ready.delete(socketId);
  io.to(roomId).emit("user-left", { id: socketId, user, roomId });
  if (Object.keys(room.marked).length === 0) {
    rooms.delete(roomId);
  }
  broadcastRoomState(roomId);
  updateReadiness(roomId, room);
}

io.on("connection", (socket) => {
  console.log("User connected", socket.id);

  socket.on(
    "watch-room",
    ({ roomId }: { roomId: string }, reply: (info: RoomInfo) => void) => {
      roomWatchers.set(socket.id, roomId);
      reply(getRoomInfo(roomId));
    },
  );
  socket.on("unwatch-room", () => roomWatchers.delete(socket.id));

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
      const roomSize = rooms.get(roomId)?.size ?? requestedSize;
      if (new Set(texts).size < roomSize * roomSize) {
        io.to(socket.id).emit("join-rejected", { reason: "not-enough-texts" });
        return;
      }

      socket.join(roomId);

      if (!rooms.has(roomId)) {
        rooms.set(roomId, {
          size: requestedSize,
          marked: {},
          usernames: {},
          boards: {},
          roundId: randomUUID(),
          summary: null,
          ready: new Set(),
        });
      }

      const room = rooms.get(roomId)!;
      room.marked[socket.id] = Array(room.size * room.size).fill(false);
      room.usernames[socket.id] = user ?? socket.id;
      room.boards[socket.id] = createBoard(
        texts,
        room.size,
        Object.values(room.boards),
      );

      sendBoard(socket.id, roomId, room);
      if (room.summary) {
        io.to(socket.id).emit("round-ended", room.summary);
        updateReadiness(roomId, room);
      }
      io.to(roomId).emit("user-joined", {
        id: socket.id,
        user: room.usernames[socket.id],
        roomId,
      });
      broadcastRoomState(roomId);
    },
  );

  socket.on("leave-room", ({ roomId }: { roomId: string }) => {
    socket.leave(roomId);
    removeRoomPlayer(socket.id, roomId);
  });

  socket.on(
    "mark",
    ({
      roomId,
      index,
      roundId,
    }: {
      roomId: string;
      index: number;
      roundId: string;
    }) => {
      const room = rooms.get(roomId);
      if (!room || room.summary || roundId !== room.roundId) return;

      const board = room.marked[socket.id];
      if (!board) return;
      if (!Number.isInteger(index) || index < 0 || index >= board.length)
        return;

      board[index] = !board[index];

      const text = room.boards[socket.id][index];

      socket.to(roomId).emit("mark", {
        roomId,
        roundId: room.roundId,
        user: room.usernames[socket.id] ?? socket.id,
        text,
        marked: board[index],
      });

      if (checkBingo(board, room.size)) {
        room.summary = {
          roomId,
          roundId: room.roundId,
          size: room.size,
          winner: {
            id: socket.id,
            user: room.usernames[socket.id],
          },
          players: [
            socket.id,
            ...Object.keys(room.usernames).filter((id) => id !== socket.id),
          ].map((id) => ({
            id,
            user: room.usernames[id],
            markedCount: room.marked[id].filter(Boolean).length,
          })),
        };
        io.to(roomId).emit("round-ended", room.summary);
        updateReadiness(roomId, room);
      }
    },
  );

  socket.on(
    "round-restart",
    ({ roomId, roundId }: { roomId: string; roundId: string }) => {
      const room = rooms.get(roomId);
      if (
        !room?.summary ||
        room.roundId !== roundId ||
        !(socket.id in room.usernames)
      )
        return;
      room.ready.add(socket.id);
      updateReadiness(roomId, room);
    },
  );

  socket.on("disconnect", () => {
    roomWatchers.delete(socket.id);
    rooms.forEach((_room, key) => {
      removeRoomPlayer(socket.id, key);
    });
  });
});

const DEFAULT_PORT = 3001;
const envPort = Number.parseInt(process.env.PORT ?? "", 10);
const port = Number.isFinite(envPort) ? envPort : DEFAULT_PORT;

server.listen(port, () => {
  console.log(`Socket server running on :${port}`);
});
