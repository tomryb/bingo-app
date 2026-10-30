import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { UI } from "../data/uiTexts";
import type { BoardSize } from "../types/bingo";
import { AVAILABLE_SIZES } from "../utils/boardAssignment";

export function useLobbyPreferences() {
  const [stored] = useState(() => {
    try {
      return {
        size: localStorage.getItem("bingo:size"),
        roomId: localStorage.getItem("bingo:roomId"),
        userName: localStorage.getItem("bingo:userName"),
        failed: false,
      };
    } catch (error) {
      console.warn("Could not read bingo preferences", error);
      return { size: null, roomId: null, userName: null, failed: true };
    }
  });
  const [size, setSize] = useState<BoardSize>(() => {
    const value = Number(stored.size ?? 5);
    const requested = value === 3 || value === 4 || value === 5 ? value : 5;
    return AVAILABLE_SIZES.includes(requested)
      ? requested
      : (AVAILABLE_SIZES[AVAILABLE_SIZES.length - 1] ?? 3);
  });
  const [roomId, setRoomId] = useState(() => stored.roomId ?? UI.defaultRoom);
  const [userName, setUserName] = useState(() => stored.userName ?? "");
  const [storageFailed, setStorageFailed] = useState(stored.failed);

  useEffect(() => {
    if (storageFailed) {
      toast.error(UI.storageUnavailable, { id: "storage-unavailable" });
      return;
    }
    try {
      localStorage.setItem("bingo:roomId", roomId);
      localStorage.setItem("bingo:userName", userName);
      localStorage.setItem("bingo:size", String(size));
      localStorage.removeItem("bingo:verbForm");
    } catch (error) {
      console.warn("Could not save bingo preferences", error);
      setStorageFailed(true);
      toast.error(UI.storageUnavailable, { id: "storage-unavailable" });
    }
  }, [roomId, userName, size, storageFailed]);

  return { size, setSize, roomId, setRoomId, userName, setUserName };
}
