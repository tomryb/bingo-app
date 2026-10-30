import { useCallback, useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import {
  FeedbackError,
  NotificationFeedback,
} from "../services/notificationFeedback";
import {
  NOTIFICATION_UI,
  type FeedbackKind,
} from "../data/notificationFeedback";

export function useNotificationFeedback() {
  const [service] = useState(() => new NotificationFeedback());
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [vibrationEnabled, setVibrationEnabled] = useState(false);
  const [enablingSound, setEnablingSound] = useState(false);

  const reportFailure = useCallback(
    (error: unknown) => {
      if (error instanceof FeedbackError && error.channel === "vibration") {
        service.disableVibration();
        setVibrationEnabled(false);
      } else {
        service.disableSound();
        setSoundEnabled(false);
      }
      toast.error(
        error instanceof Error ? error.message : NOTIFICATION_UI.soundError,
        {
          id: "notification-feedback-error",
        },
      );
    },
    [service],
  );

  const signal = useCallback(
    (kind: FeedbackKind) => {
      for (const error of service.signal(kind)) reportFailure(error);
    },
    [service, reportFailure],
  );

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState !== "visible") service.stop();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      void service
        .dispose()
        .catch(() => toast.error(NOTIFICATION_UI.closeError));
    };
  }, [service]);

  async function toggleSound() {
    if (soundEnabled) {
      service.disableSound();
      setSoundEnabled(false);
      return;
    }
    setEnablingSound(true);
    try {
      if (await service.enableSound()) setSoundEnabled(true);
    } catch (error) {
      reportFailure(error);
    } finally {
      setEnablingSound(false);
    }
  }

  function toggleVibration() {
    if (vibrationEnabled) {
      service.disableVibration();
      setVibrationEnabled(false);
      return;
    }
    try {
      service.enableVibration();
      setVibrationEnabled(true);
    } catch (error) {
      reportFailure(error);
    }
  }

  return {
    soundEnabled,
    vibrationEnabled,
    enablingSound,
    supportsSound: service.supportsSound,
    supportsVibration: service.supportsVibration,
    toggleSound,
    toggleVibration,
    signal,
  };
}
