import { useEffect, useState } from "react";
import { UI } from "../data/uiTexts";
import type { BoardSize } from "../types/bingo";
import { AVAILABLE_SIZES } from "../utils/boardAssignment";

export function useLobbyPreferences() {
  const [size, setSize] = useState<BoardSize>(() => {
    const stored = Number(localStorage.getItem("bingo:size") ?? 5);
    const requested = stored === 3 || stored === 4 || stored === 5 ? stored : 5;
    return AVAILABLE_SIZES.includes(requested)
      ? requested
      : (AVAILABLE_SIZES[AVAILABLE_SIZES.length - 1] ?? 3);
  });
  const [roomId, setRoomId] = useState(
    () => localStorage.getItem("bingo:roomId") ?? UI.defaultRoom,
  );
  const [userName, setUserName] = useState(
    () => localStorage.getItem("bingo:userName") ?? "",
  );

  useEffect(() => {
    localStorage.setItem("bingo:roomId", roomId);
    localStorage.setItem("bingo:userName", userName);
    localStorage.setItem("bingo:size", String(size));
    localStorage.removeItem("bingo:verbForm");
  }, [roomId, userName, size]);

  return { size, setSize, roomId, setRoomId, userName, setUserName };
}
