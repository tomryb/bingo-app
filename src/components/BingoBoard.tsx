import { useEffect, useState } from "react";
import texts from "../data/texts";
import { toast } from "react-hot-toast";
import type { BoardSize } from "../types/bingo";
import { socket } from "../socket";
import { checkBingo } from "../utils/checkBingo";

interface BingoBoardProps {
  size: BoardSize;
  user: string;
  roomId?: string;
}

export default function BingoBoard({ size, user, roomId }: BingoBoardProps) {
  const boardTexts: string[] = texts.slice(0, size * size);
  const [selected, setSelected] = useState<boolean[]>(
    Array(size * size).fill(false),
  );

  const storageKey = `bingo:selected:${roomId ?? "no-room"}:${user}:${size}`;

  useEffect(() => {
    setSelected(Array(size * size).fill(false));
  }, [size]);

  // Restore persisted selection for this room/user/size
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) return;
      if (parsed.length !== size * size) return;
      if (!parsed.every((v) => typeof v === "boolean")) return;
      setSelected(parsed as boolean[]);
    } catch {
      // ignore
    }
  }, [storageKey, size]);

  // Persist selection on each change
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(selected));
    } catch {
      // ignore
    }
  }, [selected, storageKey]);

  function toggle(index: number) {
    const copy = [...selected];
    copy[index] = !copy[index];
    setSelected(copy);

    if (roomId) {
      socket.emit("mark", { roomId, index });
    }

    if (checkBingo(copy, size)) {
      toast.success("🎯 BINGO!");
      if (roomId) socket.emit("bingo", { roomId });
    }
  }

  useEffect(() => {
    const onMark = ({
      user: fromUser,
      text,
    }: {
      user: string;
      text: string;
    }) => {
      toast(`${fromUser} zaznaczył: "${text}"`);
    };

    const onBingo = (fromUser: string) => {
      toast.success(`🎉 ${fromUser} ma BINGO!`);
    };

    const onUserJoined = (id: string) => {
      toast(`${id} dołączył do pokoju`);
    };

    socket.on("mark", onMark);
    socket.on("bingo", onBingo);
    socket.on("user-joined", onUserJoined);

    return () => {
      socket.off("mark", onMark);
      socket.off("bingo", onBingo);
      socket.off("user-joined", onUserJoined);
    };
  }, []);

  return (
    <div className="w-full">
      <div className="mb-4 text-sm text-slate-300">
        Grasz jako: <span className="text-white font-semibold">{user}</span>
        {roomId ? ` — Pokój: ${roomId}` : ""}
      </div>
      <div className="mx-auto max-w-3xl">
        <div
          className="grid gap-2 sm:gap-3 md:gap-4"
          style={{ gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))` }}
        >
          {boardTexts.map((text, i) => (
            <button
              key={i}
              onClick={() => toggle(i)}
              aria-pressed={selected[i]}
              className={`flex items-center justify-center aspect-square rounded-xl text-xs sm:text-sm md:text-base font-medium transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 p-3 sm:p-4 ${selected[i] ? "bg-emerald-500 text-black" : "bg-slate-800 hover:bg-slate-700 text-white"}`}
            >
              <span className="px-1 text-center break-words">{text}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
