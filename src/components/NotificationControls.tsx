import { NOTIFICATION_UI } from "../data/notificationFeedback";
import type { useNotificationFeedback } from "../hooks/useNotificationFeedback";

interface NotificationControlsProps {
  feedback: ReturnType<typeof useNotificationFeedback>;
}

export default function NotificationControls({
  feedback,
}: NotificationControlsProps) {
  return (
    <section
      className="notification-controls"
      aria-labelledby="notification-title"
    >
      <h2 id="notification-title">{NOTIFICATION_UI.title}</h2>
      <div className="notification-actions">
        <button
          type="button"
          className="secondary-button"
          aria-pressed={feedback.soundEnabled}
          disabled={!feedback.supportsSound || feedback.enablingSound}
          onClick={() => void feedback.toggleSound()}
        >
          {feedback.enablingSound
            ? NOTIFICATION_UI.enabling
            : feedback.soundEnabled
              ? NOTIFICATION_UI.soundOn
              : NOTIFICATION_UI.soundOff}
        </button>
        <button
          type="button"
          className="secondary-button"
          aria-pressed={feedback.vibrationEnabled}
          disabled={!feedback.supportsVibration}
          onClick={feedback.toggleVibration}
        >
          {feedback.vibrationEnabled
            ? NOTIFICATION_UI.vibrationOn
            : NOTIFICATION_UI.vibrationOff}
        </button>
        <button
          type="button"
          className="secondary-button"
          disabled={!feedback.soundEnabled && !feedback.vibrationEnabled}
          onClick={() => feedback.signal("win")}
        >
          {NOTIFICATION_UI.test}
        </button>
      </div>
      <p>{NOTIFICATION_UI.hint}</p>
      {!feedback.supportsSound && <p>{NOTIFICATION_UI.soundUnsupported}</p>}
      {!feedback.supportsVibration && (
        <p>{NOTIFICATION_UI.vibrationUnsupported}</p>
      )}
    </section>
  );
}
