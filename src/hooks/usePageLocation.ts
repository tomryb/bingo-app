import { useEffect, useRef } from "react";
import { UI } from "../data/uiTexts";

export function usePageLocation(inRoom: boolean, hasSummary: boolean) {
  const view = hasSummary ? "summary" : inRoom ? "game" : "lobby";
  const previousView = useRef(view);
  useEffect(() => {
    window.history.replaceState(
      null,
      "",
      hasSummary ? "#/podsumowanie" : inRoom ? "#/gra" : "#/",
    );
    document.title = hasSummary ? UI.summaryPageTitle : UI.pageTitle;
    if (previousView.current !== view) {
      document.querySelector<HTMLElement>("main h1")?.focus();
      previousView.current = view;
    }
  }, [inRoom, hasSummary, view]);
}
