import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { socket } from "../socket";
import type { RoomInfo } from "../types/bingo";
import { UI } from "../data/uiTexts";

export function useRoomPreview(roomId: string, enabled: boolean) {
  const [info, setInfo] = useState<RoomInfo | null>(null);
  const [failedRoom, setFailedRoom] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const normalizedRoomId = roomId.trim();

  useEffect(() => {
    if (!enabled || !normalizedRoomId) return;
    let active = true;
    const onRoomInfo = (next: RoomInfo) => {
      if (active && next.roomId === normalizedRoomId) {
        setInfo(next);
        setFailedRoom(null);
      }
    };
    socket.on("room-info", onRoomInfo);
    socket
      .timeout(5000)
      .emit(
        "watch-room",
        { roomId: normalizedRoomId },
        (error: Error | null, next: RoomInfo) => {
          if (!active) return;
          if (error) {
            setFailedRoom(normalizedRoomId);
            setInfo(null);
            toast.error(UI.lookupError);
            return;
          }
          onRoomInfo(next);
        },
      );
    return () => {
      active = false;
      socket.off("room-info", onRoomInfo);
      socket.emit("unwatch-room");
    };
  }, [enabled, normalizedRoomId, attempt]);

  return {
    info: enabled && info?.roomId === normalizedRoomId ? info : null,
    failed: failedRoom === normalizedRoomId,
    retry: () => setAttempt((value) => value + 1),
  };
}
