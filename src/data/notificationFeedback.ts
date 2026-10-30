export type FeedbackKind = "mark" | "win";

export const FEEDBACK_SIGNALS = {
  mark: {
    notes: [{ frequency: 880, delay: 0, duration: 0.16 }],
    vibration: [70],
  },
  win: {
    notes: [
      { frequency: 659.25, delay: 0, duration: 0.18 },
      { frequency: 830.61, delay: 0.18, duration: 0.18 },
      { frequency: 987.77, delay: 0.36, duration: 0.32 },
    ],
    vibration: [100, 70, 100, 70, 180],
  },
} as const;

export const NOTIFICATION_UI = {
  title: "Dźwięk i wibracje",
  soundOn: "Wyłącz dźwięk",
  soundOff: "Włącz dźwięk",
  enabling: "Włączanie dźwięku…",
  vibrationOn: "Wyłącz wibracje",
  vibrationOff: "Włącz wibracje",
  test: "Przetestuj sygnał",
  hint: "Sygnały dotyczą ruchów innych graczy i BINGO. Działają tylko w aktywnej stronie, nie jako push.",
  vibrationHint:
    "Brak wibracji na Androidzie? Włącz wibracje przy dotyku (haptykę), wyłącz oszczędzanie baterii i tryb „Nie przeszkadzać”, a następnie przetestuj sygnał. Ustawienia zależą od telefonu.",
  soundUnsupported: "Ta przeglądarka nie obsługuje dźwięku Web Audio.",
  vibrationUnsupported:
    "Ta przeglądarka nie obsługuje wibracji strony (np. Safari na iPhonie).",
  soundError: "Nie udało się odtworzyć dźwięku. Włącz go ponownie przyciskiem.",
  vibrationError:
    "Telefon nie uruchomił wibracji. Sprawdź ustawienia urządzenia i przeglądarki.",
  closeError: "Nie udało się zamknąć odtwarzacza dźwięku.",
} as const;
