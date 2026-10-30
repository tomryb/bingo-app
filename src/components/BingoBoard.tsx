import { useState } from "react";
import { ICONS, TILE_ICONS } from "../data/icons";
import { UI } from "../data/uiTexts";
import { socket } from "../socket";
import type { BoardAssignment } from "../types/bingo";
import { findBingoLine } from "../utils/checkBingo";

interface BingoBoardProps {
  board: BoardAssignment;
}

export default function BingoBoard({ board }: BingoBoardProps) {
  const { size, roomId, boardTexts } = board;
  const [selected, setSelected] = useState<boolean[]>(() =>
    Array<boolean>(size * size).fill(false),
  );
  const winningLine = findBingoLine(selected, size);
  const markedCount = selected.filter(Boolean).length;

  function toggle(index: number) {
    const copy = [...selected];
    copy[index] = !copy[index];
    setSelected(copy);
    socket.emit("mark", { roomId, index, roundId: board.roundId });
  }

  return (
    <section className="board-panel" aria-label={UI.boardLabel}>
      <div className="board-heading">
        <div>
          <h2>{UI.boardTitle}</h2>
          <p>{UI.boardIntro}</p>
        </div>
        <span className="board-count" aria-live="polite">
          {markedCount} / {size * size}
        </span>
      </div>
      {winningLine && (
        <div className="win-banner" role="status">
          {UI.winBanner}
        </div>
      )}
      <div
        className="bingo-grid"
        data-size={size}
        style={{ gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))` }}
      >
        {boardTexts.map((text, i) => (
          <button
            type="button"
            key={text}
            onClick={() => toggle(i)}
            aria-pressed={selected[i]}
            className={`bingo-tile${selected[i] ? " is-selected" : ""}${winningLine?.includes(i) ? " is-winning" : ""}`}
          >
            {selected[i] && (
              <span className="tile-check" aria-hidden="true">
                {ICONS.check}
              </span>
            )}
            <span className="tile-icon" aria-hidden="true">
              {TILE_ICONS[i % TILE_ICONS.length]}
            </span>
            <span className="tile-text">{text}</span>
          </button>
        ))}
      </div>
      <p className="board-hint">{UI.boardHint}</p>
    </section>
  );
}
