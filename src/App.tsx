import type { FormEvent } from "react";
import AppLayout from "./components/AppLayout";
import GamePage from "./components/GamePage";
import LobbyPage from "./components/LobbyPage";
import NotificationControls from "./components/NotificationControls";
import SummaryPage from "./components/SummaryPage";
import { useGameSession } from "./hooks/useGameSession";
import { useLobbyPreferences } from "./hooks/useLobbyPreferences";
import { useNotificationFeedback } from "./hooks/useNotificationFeedback";
import { usePageLocation } from "./hooks/usePageLocation";
import { useRoomPreview } from "./hooks/useRoomPreview";
import { AVAILABLE_SIZES } from "./utils/boardAssignment";

export default function App() {
  const preferences = useLobbyPreferences();
  const feedback = useNotificationFeedback();
  const session = useGameSession(preferences.setSize, feedback.signal);
  const preview = useRoomPreview(
    preferences.roomId,
    session.connected && !session.board,
  );
  usePageLocation(session.board?.roomId, Boolean(session.summary));

  function join(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (AVAILABLE_SIZES.length === 0) return;
    session.join({
      roomId: preferences.roomId,
      size: preview.info?.size ?? preferences.size,
      user: preferences.userName,
    });
  }

  return (
    <AppLayout connected={session.connected}>
      {!session.board ? (
        <LobbyPage
          preferences={preferences}
          preview={preview}
          connected={session.connected}
          joining={session.joining}
          onJoin={join}
        />
      ) : session.summary ? (
        <SummaryPage
          summary={session.summary}
          readiness={session.readiness}
          selfId={session.selfId}
          onRestart={session.restart}
          onLeave={session.leave}
        />
      ) : (
        <GamePage
          board={session.board}
          userName={preferences.userName}
          players={session.players}
          selfId={session.selfId}
          onLeave={session.leave}
        />
      )}
      <NotificationControls feedback={feedback} />
    </AppLayout>
  );
}
