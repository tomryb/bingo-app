import { useEffect } from "react";
import { UI } from "../data/uiTexts";

export function usePageLocation(inRoom: boolean, hasSummary: boolean) {
  useEffect(() => {
    window.history.replaceState(
      null,
      "",
      hasSummary ? "#/podsumowanie" : inRoom ? "#/gra" : "#/",
    );
    document.title = hasSummary ? UI.summaryPageTitle : UI.pageTitle;
  }, [inRoom, hasSummary]);
}
