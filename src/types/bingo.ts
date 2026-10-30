export type BoardSize = 3 | 4 | 5;

export interface PlayerIdentity {
  id: string;
  user: string;
}

export interface RoundSummary {
  roomId: string;
  roundId: string;
  size: BoardSize;
  winner: PlayerIdentity;
  players: (PlayerIdentity & { markedCount: number })[];
}

export interface RoomInfo {
  roomId: string;
  size: BoardSize | null;
}

export interface BoardAssignment {
  joinRequestId?: string;
  roomId: string;
  size: BoardSize;
  boardTexts: string[];
  textsVersion: string;
  roundId: string;
}
