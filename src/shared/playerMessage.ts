import { PLAYER_VERBS } from "../data/playerMessages.js";

export function playerMessage(
  user: string,
  action: keyof typeof PLAYER_VERBS,
): string {
  return `${user} ${PLAYER_VERBS[action]}`;
}
