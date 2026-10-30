import {
  MAX_PLAYER_NAME_LENGTH,
  MAX_ROOM_NAME_LENGTH,
} from "../src/shared/limits";
import type { BoardSize } from "../src/types/bingo";

type Validation =
  | { valid: true; payload?: Record<string, unknown> }
  | { valid: false; reason: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function joinRequestCorrelation(event: string, request: unknown) {
  return event === "join-room" &&
    isRecord(request) &&
    typeof request.joinRequestId === "string"
    ? { joinRequestId: request.joinRequestId }
    : {};
}

function normalizedString(value: unknown, maxLength: number) {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length > 0 && normalized.length <= maxLength
    ? normalized
    : null;
}

export function validateSocketRequest(
  event: string,
  args: unknown[],
  roomSize: (roomId: string) => BoardSize | undefined,
): Validation {
  const invalid: Validation = { valid: false, reason: "invalid-payload" };
  if (event === "unwatch-room") {
    return args.length === 0 ? { valid: true } : invalid;
  }
  if (
    event !== "watch-room" &&
    event !== "join-room" &&
    event !== "leave-room" &&
    event !== "mark" &&
    event !== "set-mark" &&
    event !== "round-restart"
  ) {
    return { valid: false, reason: "unknown-event" };
  }
  const [request, reply] = args;
  if (!isRecord(request)) return invalid;
  const roomId = normalizedString(request.roomId, MAX_ROOM_NAME_LENGTH);
  if (!roomId) return invalid;
  const needsReply = event === "watch-room" || event === "set-mark";
  if (needsReply && typeof reply !== "function") {
    return { valid: false, reason: "missing-ack" };
  }
  if (args.length !== (needsReply ? 2 : 1)) return invalid;
  if (event === "watch-room" || event === "leave-room") {
    return { valid: true, payload: { roomId } };
  }
  if (event === "join-room") {
    const user = normalizedString(request.user, MAX_PLAYER_NAME_LENGTH);
    const { size, textsVersion, joinRequestId } = request;
    if (
      !user ||
      (size !== 3 && size !== 4 && size !== 5) ||
      (textsVersion !== undefined && typeof textsVersion !== "string") ||
      (joinRequestId !== undefined && typeof joinRequestId !== "string")
    ) {
      return invalid;
    }
    return {
      valid: true,
      payload: { roomId, user, size, textsVersion, joinRequestId },
    };
  }
  const roundId = normalizedString(request.roundId, 80);
  if (!roundId) return invalid;
  if (event === "round-restart") {
    return { valid: true, payload: { roomId, roundId } };
  }
  const { index } = request;
  const size = roomSize(roomId) ?? 5;
  if (
    typeof index !== "number" ||
    !Number.isInteger(index) ||
    index < 0 ||
    index >= size * size
  ) {
    return { valid: false, reason: "invalid-index" };
  }
  if (event === "set-mark") {
    if (typeof request.marked !== "boolean") return invalid;
    return {
      valid: true,
      payload: { roomId, roundId, index, marked: request.marked },
    };
  }
  return { valid: true, payload: { roomId, roundId, index } };
}

export function rejectedEventLabel(event: string) {
  switch (event) {
    case "watch-room":
    case "unwatch-room":
    case "join-room":
    case "leave-room":
    case "mark":
    case "set-mark":
    case "round-restart":
      return event;
    default:
      return "unknown-event";
  }
}
