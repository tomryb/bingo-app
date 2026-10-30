import { toast } from "react-hot-toast";
import { UI } from "../data/uiTexts";

export default function CopyRoomButton({ roomId }: { roomId: string }) {
  async function copyRoom() {
    try {
      await navigator.clipboard.writeText(roomId);
      toast.success(UI.roomCopied);
    } catch (error) {
      console.warn("Could not copy room name", error);
      toast.error(UI.roomCopyFailed);
    }
  }

  return (
    <button type="button" className="secondary-button" onClick={copyRoom}>
      {UI.copyRoom}
    </button>
  );
}
