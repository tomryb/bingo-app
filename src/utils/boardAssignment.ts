import type { BoardAssignment } from "../types/bingo";
import { TEXTS_VERSION } from "../textsVersion";
import texts from "../data/texts";
import { getAvailableBoardSizes } from "./boardSize";

export const AVAILABLE_SIZES = getAvailableBoardSizes(new Set(texts).size);

export function isValidBoardAssignment(board: BoardAssignment): boolean {
  return (
    board.textsVersion === TEXTS_VERSION &&
    AVAILABLE_SIZES.includes(board.size) &&
    typeof board.roundId === "string" &&
    board.roundId.length > 0 &&
    Array.isArray(board.boardTexts) &&
    board.boardTexts.length === board.size * board.size &&
    board.boardTexts.every((text) => texts.includes(text)) &&
    new Set(board.boardTexts).size === board.boardTexts.length
  );
}
