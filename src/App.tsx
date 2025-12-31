import { useState } from "react";
import { Toaster } from "react-hot-toast";
import BingoBoard from "./components/BingoBoard";
import { socket } from "./socket";
import type { BoardSize } from "./types/bingo";

export default function App() {
  const [size, setSize] = useState<BoardSize>(5);
  const [roomId, setRoomId] = useState<string>("room-1");
  const [joined, setJoined] = useState(false);
  const [userName, setUserName] = useState<string>(() => `User_${Math.floor(Math.random() * 1000)}`);

  function joinRoom() {
    if (!roomId) return
    socket.emit('join-room', { roomId, size, user: userName })
    setJoined(true)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-slate-900 text-white flex flex-col items-center p-4 sm:p-6 md:p-8">
      <Toaster position="top-right" />

      <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-4 sm:mb-6">Bingo App</h1>

      {!joined ? (
        <div className="w-full max-w-3xl p-4 bg-slate-800 rounded-md">
          <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
            <div className="flex gap-2 items-center">
              <label className="text-sm text-slate-300">Pokój:</label>
              <input value={roomId} onChange={(e) => setRoomId(e.target.value)} className="p-2 rounded bg-slate-700 text-white" />
              <label className="text-sm text-slate-300">Nazwa:</label>
              <input value={userName} onChange={(e) => setUserName(e.target.value)} className="p-2 rounded bg-slate-700 text-white" />
            </div>

            <div className="flex items-center gap-2">
              <select
                value={size}
                onChange={(e) => setSize(Number(e.target.value) as BoardSize)}
                className="p-2 rounded bg-slate-800"
              >
                <option value={3}>3x3</option>
                <option value={4}>4x4</option>
                <option value={5}>5x5</option>
              </select>

              <button onClick={joinRoom} className="px-3 py-2 bg-indigo-600 rounded">Dołącz</button>
            </div>
          </div>
        </div>
      ) : (
        <div className="w-full max-w-3xl">
          <BingoBoard size={size} user={userName} roomId={roomId} />
        </div>
      )}
    </div>
  );
}
