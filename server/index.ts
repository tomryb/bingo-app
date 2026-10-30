import http from "node:http";
import cors from "cors";
import express from "express";
import { Server } from "socket.io";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
} from "../src/types/socket";
import { registerGameSockets } from "./gameSocket";

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server<ClientToServerEvents, ServerToClientEvents>(server, {
  cors: { origin: "*" },
});
registerGameSockets(io);

const DEFAULT_PORT = 3001;
const envPort = Number.parseInt(process.env.PORT ?? "", 10);
const port = Number.isFinite(envPort) ? envPort : DEFAULT_PORT;

server.listen(port, () => {
  console.log(`Socket server running on :${port}`);
});
