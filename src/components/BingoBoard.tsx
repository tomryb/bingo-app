import { useEffect, useRef, useState } from "react";
import { toast } from "react-hot-toast";
import { ICONS, TILE_ICONS } from "../data/icons";
import { UI } from "../data/uiTexts";
import { socket } from "../socket";
import type { BoardAssignment } from "../types/bingo";
import type { SetMarkRequest } from "../types/socket";
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
  const pending = useRef<SetMarkRequest | null>(null);
  const active = useRef(true);
  const [waiting, setWaiting] = useState(false);
  const [retrying, setRetrying] = useState(false);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);

  function sendMark(request: SetMarkRequest) {
    setRetrying(false);
    socket.timeout(5000).emit("set-mark", request, (error, result) => {
      if (!active.current || pending.current !== request) return;
      if (
        error ||
        typeof result !== "object" ||
        result === null ||
        result.roomId !== roomId ||
        result.roundId !== board.roundId ||
        typeof result.accepted !== "boolean" ||
        !Array.isArray(result.selected) ||
        result.selected.length !== size * size ||
        !result.selected.every((value) => typeof value === "boolean")
      ) {
        setRetrying(true);
        toast.error(UI.markTimeout, { id: "mark-error" });
        return;
      }
      pending.current = null;
      setWaiting(false);
      setSelected(result.selected);
      if (!result.accepted) toast.error(UI.markRejected, { id: "mark-error" });
      else toast.dismiss("mark-error");
    });
  }

  function toggle(index: number) {
    if (pending.current) return;
    const copy = [...selected];
    copy[index] = !copy[index];
    setSelected(copy);
    const request = {
      roomId,
      index,
      roundId: board.roundId,
      marked: copy[index],
    };
    pending.current = request;
    setWaiting(true);
    sendMark(request);
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
      {retrying && (
        <button
          type="button"
          className="secondary-button"
          onClick={() => {
            if (pending.current) sendMark(pending.current);
          }}
        >
          {UI.retryMark}
        </button>
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
            disabled={waiting}
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
