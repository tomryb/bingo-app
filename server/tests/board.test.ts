import assert from "node:assert/strict";
import test from "node:test";
import { BOARD_SIZE_LABELS, BOARD_SIZES } from "../../src/data/boardSizes";
import { TILE_ICONS } from "../../src/data/icons";
import {
  FESTIVE_MESSAGES,
  SINGULAR_MESSAGES,
} from "../../src/data/summaryMessages";
import texts from "../../src/data/texts";
import { playerMessage } from "../../src/shared/playerMessage";
import { summaryMessage } from "../../src/shared/summaryMessage";
import type { RoundSummary } from "../../src/types/bingo";
import { checkBingo } from "../../src/utils/checkBingo";
import { createBoard } from "../board";

const testTexts = Array.from({ length: 30 }, (_, i) => `Test ${i}`);

test("content data retains complete summary variants, tile icons and board labels", () => {
  assert.equal(FESTIVE_MESSAGES.length, 10);
  assert.equal(SINGULAR_MESSAGES.length, FESTIVE_MESSAGES.length);
  assert.equal(TILE_ICONS.length, 10);
  assert.ok(TILE_ICONS.every((icon) => icon.length > 0));
  assert.deepEqual(BOARD_SIZES, [3, 4, 5]);
  assert.ok(BOARD_SIZES.every((size) => BOARD_SIZE_LABELS[size].length > 0));
});
test("festive summary names only the other players and stays stable per round", () => {
  const summary: RoundSummary = {
    roomId: "test",
    roundId: "round-1",
    size: 3,
    winner: { id: "winner", user: "Ania Kowalska" },
    players: [
      { id: "winner", user: "Ania Kowalska", markedCount: 3 },
      { id: "b", user: "Kuba Nowak", markedCount: 1 },
      { id: "c", user: "Alex Lis", markedCount: 0 },
    ],
  };
  const message = summaryMessage(summary);
  assert.ok(message.startsWith("Kuba Nowak i Alex Lis "));
  assert.ok(!message.includes("Pozostałe osoby"));
  assert.ok(!message.includes("Ania Kowalska"));
  assert.equal(summaryMessage(summary), message);
  const variants = new Set(
    Array.from({ length: 100 }, (_, i) =>
      summaryMessage({ ...summary, roundId: `round-${i}` }),
    ),
  );
  assert.equal(variants.size, 10);
  assert.ok(
    summaryMessage({
      ...summary,
      players: summary.players.slice(0, 2),
    }).startsWith("Kuba Nowak "),
  );
  const singularVariants = new Set(
    Array.from({ length: 100 }, (_, i) =>
      summaryMessage({
        ...summary,
        roundId: `round-${i}`,
        players: summary.players.slice(0, 2),
      }),
    ),
  );
  assert.equal(singularVariants.size, 10);
  assert.ok(
    [...singularVariants].some((text) =>
      text.startsWith("Kuba Nowak śle ukłony"),
    ),
  );
  const solo = summaryMessage({
    ...summary,
    players: summary.players.slice(0, 1),
  });
  assert.ok(solo.includes("solo"));
  assert.ok(!solo.includes("Pozostałe osoby"));
});

test("all player messages are neutral regardless of the name", () => {
  for (const name of ["Kuba", "Ania", "Alex"]) {
    assert.equal(playerMessage(name, "mark"), `${name} zaznacza`);
    assert.equal(playerMessage(name, "unmark"), `${name} odznacza`);
    assert.equal(playerMessage(name, "join"), `${name} dołącza do pokoju`);
    assert.equal(playerMessage(name, "leave"), `${name} opuszcza pokój`);
    assert.equal(playerMessage(name, "win"), `${name} wygrywa`);
  }
});

test("each board size gets unique texts without changing the pool", () => {
  const original = [...testTexts];
  for (const size of [3, 4, 5] as const) {
    const board = createBoard(testTexts, size, []);
    assert.equal(board.length, size * size);
    assert.equal(new Set(board).size, size * size);
    assert.ok(board.every((text) => testTexts.includes(text)));
  }
  assert.deepEqual(testTexts, original);
});

test("uses only the configured texts and rejects unsupported sizes", () => {
  for (const size of [3, 4, 5] as const) {
    if (new Set(texts).size >= size * size) {
      const board = createBoard(texts, size, []);
      assert.equal(board.length, size * size);
      assert.ok(board.every((text) => texts.includes(text)));
    } else {
      assert.throws(() => createBoard(texts, size, []), /Not enough/);
    }
  }
});

test("players in the same room receive different board layouts", () => {
  const boards: string[][] = [];
  for (let i = 0; i < 100; i++) {
    const board = createBoard(testTexts, 5, boards);
    assert.ok(
      boards.every((other) => JSON.stringify(other) !== JSON.stringify(board)),
    );
    boards.push(board);
  }
});

test("rejects pools with too few unique texts", () => {
  assert.throws(() => createBoard(texts.slice(0, 8), 3, []), /Not enough/);
  assert.throws(
    () => createBoard(Array<string>(25).fill("same"), 5, []),
    /Not enough/,
  );
});

test("only complete rows, columns and diagonals win for every size", () => {
  for (const size of [3, 4, 5] as const) {
    const lineIndices = [
      Array.from({ length: size }, (_, i) => i),
      Array.from({ length: size }, (_, i) => i * size),
      Array.from({ length: size }, (_, i) => i * (size + 1)),
      Array.from({ length: size }, (_, i) => (i + 1) * (size - 1)),
    ];
    for (const indices of lineIndices) {
      const selected = Array<boolean>(size * size).fill(false);
      assert.equal(checkBingo(selected, size), false);
      for (const i of indices) selected[i] = true;
      assert.equal(checkBingo(selected, size), true);
      selected[indices[0]] = false;
      assert.equal(checkBingo(selected, size), false);
    }
  }
});
