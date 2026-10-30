import type { BoardSize } from "../types/bingo.js";

export const BOARD_SIZES: BoardSize[] = [3, 4, 5];
export const BOARD_SIZE_LABELS: Record<BoardSize, string> = {
  3: "Szybka runda",
  4: "Złoty środek",
  5: "Wielka uczta",
};
