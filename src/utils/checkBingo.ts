import type { BoardSize } from "../types/bingo.js";

function buildLines(size: BoardSize): number[][] {
  const lines: number[][] = [];

  for (let r = 0; r < size; r++) {
    lines.push([...Array(size)].map((_, i) => r * size + i));
  }

  for (let c = 0; c < size; c++) {
    lines.push([...Array(size)].map((_, i) => i * size + c));
  }

  lines.push([...Array(size)].map((_, i) => i * size + i));
  lines.push([...Array(size)].map((_, i) => i * size + (size - i - 1)));

  return lines;
}

// Returns the indices of the first fully-selected line, or null if none.
export function findBingoLine(
  selected: boolean[],
  size: BoardSize,
): number[] | null {
  const line = buildLines(size).find((line) => line.every((i) => selected[i]));
  return line ?? null;
}

export function checkBingo(selected: boolean[], size: BoardSize): boolean {
  return findBingoLine(selected, size) !== null;
}
