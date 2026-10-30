import {
  FEEDBACK_SIGNALS,
  NOTIFICATION_UI,
  type FeedbackKind,
} from "../data/notificationFeedback";

export interface FeedbackOutput {
  supportsSound: boolean;
  supportsVibration: boolean;
  isVisible(): boolean;
  unlockSound(): Promise<void>;
  playSound(kind: FeedbackKind): void;
  stopSound(): void;
  vibrate(pattern: readonly number[]): boolean;
  dispose(): Promise<void>;
}

export class FeedbackError extends Error {
  readonly channel: "sound" | "vibration";

  constructor(
    channel: "sound" | "vibration",
    message: string,
    cause?: unknown,
  ) {
    super(message, { cause });
    this.channel = channel;
  }
}

class BrowserFeedbackOutput implements FeedbackOutput {
  private context: AudioContext | null = null;
  private oscillators = new Set<OscillatorNode>();

  get supportsSound() {
    return typeof window.AudioContext === "function";
  }

  get supportsVibration() {
    return typeof navigator.vibrate === "function";
  }

  isVisible() {
    return document.visibilityState === "visible";
  }

  async unlockSound() {
    if (!this.supportsSound) throw new Error(NOTIFICATION_UI.soundUnsupported);
    const context = (this.context ??= new AudioContext());
    await context.resume();
    if (context.state !== "running")
      throw new Error(NOTIFICATION_UI.soundError);
  }

  playSound(kind: FeedbackKind) {
    const context = this.context;
    if (!context || context.state !== "running")
      throw new Error(NOTIFICATION_UI.soundError);
    this.stopSound();
    for (const note of FEEDBACK_SIGNALS[kind].notes) {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const start = context.currentTime + note.delay;
      oscillator.type = "sine";
      oscillator.frequency.value = note.frequency;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.08, start + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, start + note.duration);
      oscillator.connect(gain);
      gain.connect(context.destination);
      this.oscillators.add(oscillator);
      oscillator.onended = () => {
        this.oscillators.delete(oscillator);
        oscillator.disconnect();
        gain.disconnect();
      };
      oscillator.start(start);
      oscillator.stop(start + note.duration);
    }
  }

  stopSound() {
    for (const oscillator of this.oscillators) oscillator.stop();
    this.oscillators.clear();
  }

  vibrate(pattern: readonly number[]) {
    return this.supportsVibration && navigator.vibrate([...pattern]);
  }

  async dispose() {
    this.stopSound();
    const context = this.context;
    this.context = null;
    if (context && context.state !== "closed") await context.close();
  }
}

export class NotificationFeedback {
  private soundEnabled = false;
  private vibrationEnabled = false;
  private generation = 0;
  private readonly output: FeedbackOutput;

  constructor(output: FeedbackOutput = new BrowserFeedbackOutput()) {
    this.output = output;
  }

  get supportsSound() {
    return this.output.supportsSound;
  }

  get supportsVibration() {
    return this.output.supportsVibration;
  }

  async enableSound() {
    const generation = this.generation;
    try {
      await this.output.unlockSound();
      if (generation !== this.generation) return false;
      this.soundEnabled = true;
      if (this.output.isVisible()) this.output.playSound("mark");
      return true;
    } catch (error) {
      if (generation !== this.generation) return false;
      this.disableSound();
      throw new FeedbackError(
        "sound",
        this.supportsSound
          ? NOTIFICATION_UI.soundError
          : NOTIFICATION_UI.soundUnsupported,
        error,
      );
    }
  }

  disableSound() {
    this.soundEnabled = false;
    this.output.stopSound();
  }

  enableVibration() {
    if (!this.supportsVibration)
      throw new FeedbackError(
        "vibration",
        NOTIFICATION_UI.vibrationUnsupported,
      );
    if (!this.output.vibrate(FEEDBACK_SIGNALS.mark.vibration)) {
      throw new FeedbackError("vibration", NOTIFICATION_UI.vibrationError);
    }
    this.vibrationEnabled = true;
  }

  disableVibration() {
    const wasEnabled = this.vibrationEnabled;
    this.vibrationEnabled = false;
    if (wasEnabled && this.supportsVibration) this.output.vibrate([0]);
  }

  signal(kind: FeedbackKind): FeedbackError[] {
    const failures: FeedbackError[] = [];
    if (!this.output.isVisible()) return failures;
    if (this.soundEnabled) {
      try {
        this.output.playSound(kind);
      } catch (error) {
        failures.push(
          new FeedbackError("sound", NOTIFICATION_UI.soundError, error),
        );
      }
    }
    if (this.vibrationEnabled) {
      try {
        if (!this.output.vibrate(FEEDBACK_SIGNALS[kind].vibration)) {
          throw new Error(NOTIFICATION_UI.vibrationError);
        }
      } catch (error) {
        failures.push(
          new FeedbackError("vibration", NOTIFICATION_UI.vibrationError, error),
        );
      }
    }
    return failures;
  }

  stop() {
    this.output.stopSound();
    if (this.vibrationEnabled) this.output.vibrate([0]);
  }

  async dispose() {
    this.generation += 1;
    this.soundEnabled = false;
    this.disableVibration();
    await this.output.dispose();
  }
}
