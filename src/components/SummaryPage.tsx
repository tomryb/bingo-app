import { ICONS } from "../data/icons";
import { UI } from "../data/uiTexts";
import { playerMessage } from "../shared/playerMessage";
import { summaryMessage } from "../shared/summaryMessage";
import type { RoundSummary } from "../types/bingo";
import type { RoundReadiness } from "../types/socket";

interface SummaryPageProps {
  summary: RoundSummary;
  readiness: Pick<RoundReadiness, "ready" | "members">;
  selfId: string | undefined;
  onRestart: () => void;
  onLeave: () => void;
}

export default function SummaryPage({
  summary,
  readiness,
  selfId,
  onRestart,
  onLeave,
}: SummaryPageProps) {
  const ready = readiness.ready.includes(selfId ?? "");
  return (
    <main className="summary-page">
      <section className="summary-card" aria-labelledby="summary-title">
        <span className="summary-trophy" aria-hidden="true">
          {ICONS.trophy}
        </span>
        <span className="eyebrow">{UI.summaryEyebrow}</span>
        <h1 id="summary-title" tabIndex={-1}>
          {UI.summaryTitle}
        </h1>
        <p className="summary-winner">
          {playerMessage(summary.winner.user, "win")}!
        </p>
        <p className="room-subtitle">
          {UI.roomPrefix} {summary.roomId} · {summary.size}×{summary.size}
        </p>
        <p className="board-hint">{summaryMessage(summary)}</p>
        <ul className="summary-results">
          {summary.players.map((player) => (
            <li key={player.id}>
              <span>
                {player.id === summary.winner.id ? ICONS.trophy : ICONS.tree}{" "}
                {player.user}
                {player.id === selfId ? UI.selfSuffix : ""}
              </span>
              <strong>
                {player.markedCount} / {summary.size * summary.size}
              </strong>
            </li>
          ))}
        </ul>
        <p className="board-hint" aria-live="polite">
          {UI.readinessPrefix} {readiness.ready.length} /{" "}
          {readiness.members.length}. {UI.readinessNote}
        </p>
        <button
          type="button"
          className="primary-button"
          disabled={ready}
          onClick={onRestart}
        >
          {ready ? UI.waiting : UI.replay}
        </button>
        <button
          type="button"
          className="secondary-button summary-leave"
          onClick={onLeave}
        >
          {UI.leaveRoom}
        </button>
      </section>
    </main>
  );
}
