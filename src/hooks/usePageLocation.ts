import { useEffect, useRef } from "react";
import { UI } from "../data/uiTexts";

export function usePageLocation(
  roomId: string | undefined,
  hasSummary: boolean,
) {
  const inRoom = roomId !== undefined;
  const view = hasSummary ? "summary" : inRoom ? "game" : "lobby";
  const previousView = useRef(view);
  useEffect(() => {
    window.history.replaceState(
      null,
      "",
      roomId === undefined
        ? "/"
        : `/${encodeURIComponent(roomId)}${hasSummary ? "/podsumowanie" : ""}`,
    );
    document.title = hasSummary ? UI.summaryPageTitle : UI.title;
    if (previousView.current !== view) {
      document.querySelector<HTMLElement>("main h1")?.focus();
      previousView.current = view;
    }
  }, [roomId, hasSummary, view]);
}
