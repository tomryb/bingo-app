import type { BoardSize } from "../types/bingo";

import { BOARD_SIZES } from "../data/boardSizes.js";

// A size is buildable only if there are enough texts to fill every cell.
export function isBoardSizeAvailable(
  size: BoardSize,
  textsCount: number,
): boolean {
  return textsCount >= size * size;
}

export function getAvailableBoardSizes(textsCount: number): BoardSize[] {
  return BOARD_SIZES.filter((size) => isBoardSizeAvailable(size, textsCount));
}
