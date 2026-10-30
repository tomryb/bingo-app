import type {
  BoardAssignment,
  BoardSize,
  PlayerIdentity,
  RoomInfo,
  RoundSummary,
} from "./bingo.js";

export interface RoundReadiness {
  roomId: string;
  roundId: string;
  ready: string[];
  members: string[];
}

export interface MarkNotification {
  roomId: string;
  roundId: string;
  user: string;
  text: string;
  marked: boolean;
}

export interface SetMarkRequest {
  roomId: string;
  roundId: string;
  index: number;
  marked: boolean;
}

export interface MarkResult {
  roomId: string;
  roundId: string;
  accepted: boolean;
  selected: boolean[];
}

export interface ServerToClientEvents {
  "request-rejected": (error: {
    event: string;
    reason: string;
    joinRequestId?: string;
  }) => void;
  "room-info": (info: RoomInfo) => void;
  "join-accepted": (board: BoardAssignment) => void;
  "join-rejected": (error: {
    joinRequestId?: string;
    reason: string;
    serverTextsVersion?: string;
  }) => void;
  "room-state": (state: {
    roomId: string;
    size: BoardSize;
    players: PlayerIdentity[];
    textsVersion: string;
  }) => void;
  "round-ended": (summary: RoundSummary) => void;
  "round-ready": (state: RoundReadiness) => void;
  "user-joined": (player: PlayerIdentity & { roomId: string }) => void;
  "user-left": (player: PlayerIdentity & { roomId: string }) => void;
  mark: (notification: MarkNotification) => void;
  "texts-version-mismatch": (versions: {
    client: string;
    server: string;
  }) => void;
}

export interface ClientToServerEvents {
  "watch-room": (
    request: { roomId: string },
    reply: (info: RoomInfo) => void,
  ) => void;
  "unwatch-room": () => void;
  "join-room": (request: {
    joinRequestId?: string;
    roomId: string;
    size: BoardSize;
    user: string;
    textsVersion: string;
  }) => void;
  "leave-room": (request: { roomId: string }) => void;
  mark: (request: { roomId: string; index: number; roundId: string }) => void;
  "set-mark": (
    request: SetMarkRequest,
    reply: (result: MarkResult) => void,
  ) => void;
  "round-restart": (request: { roomId: string; roundId: string }) => void;
}
