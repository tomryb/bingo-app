import { randomInt } from "node:crypto";
import type { BoardSize } from "../src/types/bingo.js";

export function createBoard(
  texts: string[],
  size: BoardSize,
  occupied: string[][],
): string[] {
  if (new Set(texts).size < size * size) {
    throw new Error("Not enough unique texts to build a board");
  }

  let board: string[];
  do {
    const shuffled = [...new Set(texts)];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = randomInt(i + 1);
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    board = shuffled.slice(0, size * size);
  } while (
    occupied.some((other) => other.every((text, i) => text === board[i]))
  );
  return board;
}
