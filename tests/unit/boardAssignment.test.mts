import assert from "node:assert/strict";
import test from "node:test";
import texts from "../../src/data/texts.ts";
import { TEXTS_VERSION } from "../../src/textsVersion.ts";
import type { BoardAssignment } from "../../src/types/bingo.ts";
import { isValidBoardAssignment } from "../../src/utils/boardAssignment.ts";

test("board assignments reject duplicates, unknown texts and outdated versions", () => {
  const board: BoardAssignment = {
    roomId: "test",
    roundId: "round",
    size: 3,
    boardTexts: texts.slice(0, 9),
    textsVersion: TEXTS_VERSION,
  };
  assert.equal(isValidBoardAssignment(board), true);
  assert.equal(
    isValidBoardAssignment({ ...board, textsVersion: "old" }),
    false,
  );
  assert.equal(isValidBoardAssignment({ ...board, roundId: "" }), false);
  assert.equal(
    isValidBoardAssignment({ ...board, boardTexts: Array(9).fill(texts[0]) }),
    false,
  );
  assert.equal(
    isValidBoardAssignment({
      ...board,
      boardTexts: [...texts.slice(0, 8), "unknown"],
    }),
    false,
  );
  assert.equal(isValidBoardAssignment({ ...board, size: 4 }), false);
});
