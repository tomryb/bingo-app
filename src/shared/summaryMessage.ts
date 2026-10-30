import {
  FESTIVE_MESSAGES,
  SINGULAR_MESSAGES,
  SOLO_SUMMARY_MESSAGE,
} from "../data/summaryMessages.js";
import type { RoundSummary } from "../types/bingo.js";
import { computeTextsVersion } from "./textsVersion.js";

export function summaryMessage(summary: RoundSummary): string {
  const others = summary.players
    .filter((player) => player.id !== summary.winner.id)
    .map((player) => player.user);
  if (others.length === 0) {
    return SOLO_SUMMARY_MESSAGE;
  }
  const names =
    others.length === 1
      ? others[0]
      : `${others.slice(0, -1).join(", ")} i ${others[others.length - 1]}`;
  const index =
    Number.parseInt(computeTextsVersion([summary.roundId]), 16) %
    FESTIVE_MESSAGES.length;
  const messages = others.length === 1 ? SINGULAR_MESSAGES : FESTIVE_MESSAGES;
  return `${names} ${messages[index]}`;
}
