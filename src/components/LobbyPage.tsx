import type { FormEvent } from "react";
import { BOARD_SIZE_LABELS, BOARD_SIZES } from "../data/boardSizes";
import { ICONS } from "../data/icons";
import { STEPS } from "../data/instructions";
import { UI } from "../data/uiTexts";
import type { useLobbyPreferences } from "../hooks/useLobbyPreferences";
import type { useRoomPreview } from "../hooks/useRoomPreview";
import { MAX_PLAYER_NAME_LENGTH, MAX_ROOM_NAME_LENGTH } from "../shared/limits";
import { AVAILABLE_SIZES } from "../utils/boardAssignment";

interface LobbyPageProps {
  preferences: ReturnType<typeof useLobbyPreferences>;
  preview: ReturnType<typeof useRoomPreview>;
  connected: boolean;
  joining: boolean;
  onJoin: (event: FormEvent<HTMLFormElement>) => void;
}

export default function LobbyPage({
  preferences,
  preview,
  connected,
  joining,
  onJoin,
}: LobbyPageProps) {
  const { size, setSize, roomId, setRoomId, userName, setUserName } =
    preferences;
  const normalizedRoomId = roomId.trim();
  const existingSize = preview.info?.size ?? null;
  const effectiveSize = existingSize ?? size;
  const roomStatus = !normalizedRoomId
    ? UI.enterRoom
    : !connected
      ? UI.awaitingConnection
      : preview.info
        ? existingSize
          ? UI.existingRoom(existingSize)
          : UI.newRoom
        : preview.failed
          ? UI.lookupFailed
          : UI.checkingRoom;

  return (
    <>
      <main className="landing">
        <section className="hero">
          <span className="eyebrow">{UI.heroEyebrow}</span>
          <h1 tabIndex={-1}>
            {UI.heroTitle}
            <br />
            {UI.heroSubtitle} <em>{UI.bingo}</em>
          </h1>
          <p className="hero-copy">{UI.heroCopy}</p>
          <div className="festive-scene" aria-hidden="true">
            <span className="scene-gift">{ICONS.gift}</span>
            <span className="scene-tree">{ICONS.tree}</span>
            <span className="scene-gift">{ICONS.gift}</span>
            <span className="scene-star">{ICONS.sparkle}</span>
          </div>
        </section>
        <form className="join-card" onSubmit={onJoin}>
          <span className="card-kicker">{UI.joinKicker}</span>
          <h2>{UI.joinTitle}</h2>
          <p className="card-intro">{UI.joinIntro}</p>
          <label className="field">
            {UI.nameLabel}
            <input
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              placeholder={UI.namePlaceholder}
              required
              maxLength={MAX_PLAYER_NAME_LENGTH}
              autoComplete="nickname"
              disabled={joining}
            />
          </label>
          <label className="field">
            {UI.roomLabel}
            <input
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              placeholder={UI.roomPlaceholder}
              required
              maxLength={MAX_ROOM_NAME_LENGTH}
              disabled={joining}
            />
          </label>
          <p className="size-label" id="size-label">
            {UI.sizeLabel}
          </p>
          <fieldset className="size-options" aria-labelledby="size-label">
            {BOARD_SIZES.map((s) => (
              <button
                className="size-option"
                type="button"
                key={s}
                disabled={
                  joining ||
                  existingSize !== null ||
                  !AVAILABLE_SIZES.includes(s)
                }
                aria-pressed={effectiveSize === s}
                onClick={() => setSize(s)}
              >
                <strong>
                  {s} × {s}
                </strong>
                <small>{BOARD_SIZE_LABELS[s]}</small>
              </button>
            ))}
          </fieldset>
          <p className="card-note" role="status">
            {roomStatus}
          </p>
          {!preview.info && preview.failed && (
            <button
              type="button"
              className="size-option"
              onClick={preview.retry}
            >
              {UI.retry}
            </button>
          )}
          <button
            className="primary-button"
            type="submit"
            disabled={
              !connected ||
              joining ||
              !normalizedRoomId ||
              !userName.trim() ||
              AVAILABLE_SIZES.length === 0
            }
          >
            {joining
              ? UI.preparing
              : existingSize !== null
                ? UI.joinRoom
                : preview.info
                  ? UI.createRoom
                  : UI.createOrJoin}
          </button>
          {AVAILABLE_SIZES.length === 0 && (
            <p className="form-error">{UI.insufficientTexts}</p>
          )}
          <p className="card-note">{UI.joinNote}</p>
        </form>
      </main>
      <section className="how-it-works" aria-label={UI.instructionsLabel}>
        {STEPS.map((step) => (
          <div className="how-step" key={step.title}>
            <span className="step-icon" aria-hidden="true">
              {step.icon}
            </span>
            <div>
              <h3>{step.title}</h3>
              <p>{step.text}</p>
            </div>
          </div>
        ))}
      </section>
    </>
  );
}
