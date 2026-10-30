import { ICONS } from "../data/icons";
import { UI } from "../data/uiTexts";
import type { BoardAssignment, PlayerIdentity } from "../types/bingo";
import BingoBoard from "./BingoBoard";

interface GamePageProps {
  board: BoardAssignment;
  userName: string;
  players: PlayerIdentity[];
  selfId: string | undefined;
  onLeave: () => void;
}

export default function GamePage({
  board,
  userName,
  players,
  selfId,
  onLeave,
}: GamePageProps) {
  return (
    <main>
      <div className="room-heading">
        <div>
          <span className="eyebrow">{UI.gameEyebrow}</span>
          <h1 tabIndex={-1}>
            {UI.roomPrefix} {board.roomId}
          </h1>
          <p className="room-subtitle">{UI.greeting(userName.trim())}</p>
        </div>
        <button type="button" className="secondary-button" onClick={onLeave}>
          {UI.leave}
        </button>
      </div>
      <div className="game-layout">
        <BingoBoard key={board.roundId} board={board} />
        <aside className="game-sidebar">
          <section className="sidebar-card">
            <h2>
              {UI.playersPrefix} ({players.length})
            </h2>
            <ul className="player-list">
              {players.map((player) => (
                <li className="player-chip" key={player.id}>
                  <span className="player-avatar" aria-hidden="true">
                    {player.user.charAt(0).toUpperCase()}
                  </span>
                  <span>
                    {player.user}
                    {player.id === selfId ? UI.selfSuffix : ""}
                  </span>
                </li>
              ))}
            </ul>
          </section>
          <section className="sidebar-card">
            <span className="sidebar-ornament" aria-hidden="true">
              {ICONS.gift}
            </span>
            <h2>{UI.helpTitle}</h2>
            <p>{UI.helpCopy}</p>
          </section>
        </aside>
      </div>
    </main>
  );
}
