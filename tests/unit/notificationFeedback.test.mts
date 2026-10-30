import assert from "node:assert/strict";
import test from "node:test";
import { FEEDBACK_SIGNALS } from "../../src/data/notificationFeedback.ts";
import {
  FeedbackError,
  type FeedbackOutput,
  NotificationFeedback,
} from "../../src/services/notificationFeedback.ts";

function createOutput(overrides: Partial<FeedbackOutput> = {}) {
  const calls: (string | number[])[] = [];
  return {
    calls,
    supportsSound: true,
    supportsVibration: true,
    isVisible: () => true,
    unlockSound: async () => {
      calls.push("unlock");
    },
    playSound: (kind: "mark" | "win") => {
      calls.push(kind);
    },
    stopSound: () => {
      calls.push("stop");
    },
    vibrate: (pattern: readonly number[]) => {
      calls.push([...pattern]);
      return true;
    },
    dispose: async () => {
      calls.push("dispose");
    },
    ...overrides,
  };
}

test("feedback defaults to silent and requires separate opt-ins", async () => {
  const output = createOutput();
  const feedback = new NotificationFeedback(output);
  feedback.signal("mark");
  assert.deepEqual(output.calls, []);
  await feedback.enableSound();
  assert.deepEqual(output.calls, ["unlock", "mark"]);
  feedback.signal("win");
  assert.equal(output.calls.at(-1), "win");
  feedback.enableVibration();
  assert.deepEqual(output.calls.at(-1), [...FEEDBACK_SIGNALS.mark.vibration]);
  feedback.signal("win");
  assert.deepEqual(output.calls.slice(-2), [
    "win",
    [...FEEDBACK_SIGNALS.win.vibration],
  ]);
  feedback.disableSound();
  output.calls.length = 0;
  feedback.signal("mark");
  assert.deepEqual(output.calls, [[...FEEDBACK_SIGNALS.mark.vibration]]);
  feedback.disableVibration();
  output.calls.length = 0;
  feedback.signal("win");
  assert.deepEqual(output.calls, []);
});

test("hidden pages do not play or vibrate; foreground resumes opt-ins", async () => {
  let visible = true;
  const output = createOutput({ isVisible: () => visible });
  const feedback = new NotificationFeedback(output);
  await feedback.enableSound();
  feedback.enableVibration();
  output.calls.length = 0;
  visible = false;
  feedback.signal("win");
  assert.deepEqual(output.calls, []);
  visible = true;
  feedback.signal("win");
  assert.deepEqual(output.calls, ["win", [...FEEDBACK_SIGNALS.win.vibration]]);
});

test("unsupported or blocked vibration is reported explicitly", () => {
  for (const overrides of [
    { supportsVibration: false },
    { vibrate: () => false },
  ]) {
    const feedback = new NotificationFeedback(createOutput(overrides));
    assert.throws(
      () => feedback.enableVibration(),
      (error) =>
        error instanceof FeedbackError && error.channel === "vibration",
    );
  }
});

test("failed audio unlock never enables automatic sound", async () => {
  const output = createOutput({
    unlockSound: async () => {
      throw new Error("blocked");
    },
  });
  const feedback = new NotificationFeedback(output);
  await assert.rejects(
    () => feedback.enableSound(),
    (error) =>
      error instanceof FeedbackError &&
      error.channel === "sound" &&
      error.cause instanceof Error &&
      error.cause.message === "blocked",
  );
  output.calls.length = 0;
  feedback.signal("mark");
  assert.deepEqual(output.calls, []);
});

test("disposing an unused service does not request vibration", async () => {
  const output = createOutput();
  await new NotificationFeedback(output).dispose();
  assert.deepEqual(output.calls, ["dispose"]);
});

test("audio playback errors are surfaced with the sound channel", async () => {
  const output = createOutput();
  const feedback = new NotificationFeedback(output);
  await feedback.enableSound();
  output.playSound = () => {
    throw new Error("suspended");
  };
  const [error] = feedback.signal("mark");
  assert.ok(error instanceof FeedbackError);
  assert.equal(error.channel, "sound");
  assert.ok(error.cause instanceof Error);
  assert.equal(error.cause.message, "suspended");
});

test("failure of one signal does not suppress the other", async () => {
  const output = createOutput();
  const feedback = new NotificationFeedback(output);
  await feedback.enableSound();
  feedback.enableVibration();
  output.calls.length = 0;
  output.playSound = () => {
    throw new Error("suspended");
  };
  assert.equal(feedback.signal("win")[0].channel, "sound");
  assert.deepEqual(output.calls, [[...FEEDBACK_SIGNALS.win.vibration]]);
  output.playSound = (kind) => {
    output.calls.push(kind);
  };
  output.vibrate = () => false;
  output.calls.length = 0;
  assert.equal(feedback.signal("win")[0].channel, "vibration");
  assert.deepEqual(output.calls, ["win"]);
});

test("disposing during audio unlock cannot re-enable playback", async () => {
  let unlock: (() => void) | undefined;
  const output = createOutput({
    unlockSound: () =>
      new Promise<void>((resolve) => {
        unlock = resolve;
      }),
  });
  const feedback = new NotificationFeedback(output);
  const enabling = feedback.enableSound();
  await feedback.dispose();
  assert.ok(unlock);
  unlock();
  assert.equal(await enabling, false);
  output.calls.length = 0;
  assert.deepEqual(feedback.signal("win"), []);
  assert.deepEqual(output.calls, []);
});

test("stop and dispose cancel output and reset opt-ins", async () => {
  const output = createOutput();
  const feedback = new NotificationFeedback(output);
  await feedback.enableSound();
  feedback.enableVibration();
  output.calls.length = 0;
  feedback.stop();
  assert.deepEqual(output.calls, ["stop", [0]]);
  await feedback.dispose();
  output.calls.length = 0;
  feedback.signal("win");
  assert.deepEqual(output.calls, []);
  await feedback.enableSound();
  assert.deepEqual(output.calls, ["unlock", "mark"]);
});
