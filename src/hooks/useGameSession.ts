import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { toast } from "react-hot-toast";
import { socket } from "../socket";
import type {
  BoardAssignment,
  BoardSize,
  PlayerIdentity,
  RoundSummary,
} from "../types/bingo";
import type { MarkNotification, RoundReadiness } from "../types/socket";
import { TEXTS_VERSION } from "../textsVersion";
import { isValidBoardAssignment } from "../utils/boardAssignment";
import { playerMessage } from "../shared/playerMessage";
import { ICONS } from "../data/icons";
import { UI } from "../data/uiTexts";
import type { FeedbackKind } from "../data/notificationFeedback";

function subscribeConnection(onChange: () => void) {
  socket.on("connect", onChange);
  socket.on("disconnect", onChange);
  return () => {
    socket.off("connect", onChange);
    socket.off("disconnect", onChange);
  };
}

interface JoinRequest {
  roomId: string;
  size: BoardSize;
  user: string;
}

export function useGameSession(
  onSizeAssigned: (size: BoardSize) => void,
  signal: (kind: FeedbackKind) => void,
) {
  const connected = useSyncExternalStore(
    subscribeConnection,
    () => socket.connected,
  );
  const [board, setBoard] = useState<BoardAssignment | null>(null);
  const [summary, setSummary] = useState<RoundSummary | null>(null);
  const [players, setPlayers] = useState<string[]>([]);
  const [readiness, setReadiness] = useState<
    Pick<RoundReadiness, "ready" | "members">
  >({
    ready: [],
    members: [],
  });
  const [joining, setJoining] = useState(false);
  // Socket.IO may deliver the next event before React commits the previous update.
  const activeBoard = useRef<BoardAssignment | null>(null);
  const pendingJoin = useRef<JoinRequest | null>(null);
  const roundFinished = useRef(false);

  const reset = useCallback(() => {
    activeBoard.current = null;
    pendingJoin.current = null;
    roundFinished.current = false;
    setJoining(false);
    setBoard(null);
    setSummary(null);
    setPlayers([]);
    setReadiness({ ready: [], members: [] });
  }, []);

  useEffect(() => {
    const onDisconnect = () => {
      reset();
      toast.error(UI.disconnected);
    };
    const onConnectError = () => {
      pendingJoin.current = null;
      setJoining(false);
      toast.error(UI.connectionError, { id: "connection-error" });
    };
    const onJoinAccepted = (assignment: BoardAssignment) => {
      const request = pendingJoin.current;
      if (
        assignment.roomId !== (request?.roomId ?? activeBoard.current?.roomId)
      ) {
        socket.emit("leave-room", { roomId: assignment.roomId });
        return;
      }
      setJoining(false);
      if (!isValidBoardAssignment(assignment)) {
        socket.emit("leave-room", { roomId: assignment.roomId });
        reset();
        toast.error(UI.invalidBoard);
        return;
      }
      onSizeAssigned(assignment.size);
      if (request && assignment.size !== request.size) {
        toast(UI.sizeAdjusted(assignment.size), { icon: ICONS.bell });
      }
      pendingJoin.current = null;
      activeBoard.current = assignment;
      roundFinished.current = false;
      setBoard(assignment);
      setSummary(null);
      setReadiness({ ready: [], members: [] });
    };
    const onJoinRejected = ({ reason }: { reason: string }) => {
      pendingJoin.current = null;
      setJoining(false);
      toast.error(
        reason === "not-enough-texts" ? UI.notEnoughTexts : UI.joinError,
      );
    };
    const onRoomState = (state: { roomId: string; players: string[] }) => {
      if (state.roomId === activeBoard.current?.roomId)
        setPlayers(state.players);
    };
    const isCurrentRound = (event: { roomId: string; roundId: string }) =>
      event.roomId === activeBoard.current?.roomId &&
      event.roundId === activeBoard.current?.roundId;
    const onRoundEnded = (result: RoundSummary) => {
      if (!isCurrentRound(result) || roundFinished.current) return;
      roundFinished.current = true;
      setSummary(result);
      toast.success(
        `${playerMessage(result.winner.user, "win")} — ${UI.bingo}`,
      );
      signal("win");
    };
    const onRoundReady = (state: RoundReadiness) => {
      if (isCurrentRound(state)) setReadiness(state);
    };
    const onMark = (event: MarkNotification) => {
      if (!isCurrentRound(event) || roundFinished.current) return;
      toast(
        `${playerMessage(event.user, event.marked ? "mark" : "unmark")}: "${event.text}"`,
        {
          icon: event.marked ? ICONS.bell : ICONS.snowflake,
        },
      );
      signal("mark");
    };
    const onUserJoined = (player: PlayerIdentity & { roomId: string }) => {
      if (
        player.roomId === activeBoard.current?.roomId &&
        player.id !== socket.id
      ) {
        toast(playerMessage(player.user, "join"), { icon: ICONS.tree });
      }
    };
    const onUserLeft = (player: PlayerIdentity & { roomId: string }) => {
      if (
        player.roomId === activeBoard.current?.roomId &&
        player.id !== socket.id
      ) {
        toast(playerMessage(player.user, "leave"), { icon: ICONS.wave });
      }
    };
    const leaveOnUnload = () => {
      if (activeBoard.current)
        socket.emit("leave-room", { roomId: activeBoard.current.roomId });
    };
    socket.on("disconnect", onDisconnect);
    socket.on("connect_error", onConnectError);
    socket.on("join-accepted", onJoinAccepted);
    socket.on("join-rejected", onJoinRejected);
    socket.on("room-state", onRoomState);
    socket.on("round-ended", onRoundEnded);
    socket.on("round-ready", onRoundReady);
    socket.on("mark", onMark);
    socket.on("user-joined", onUserJoined);
    socket.on("user-left", onUserLeft);
    window.addEventListener("beforeunload", leaveOnUnload);
    return () => {
      socket.off("disconnect", onDisconnect);
      socket.off("connect_error", onConnectError);
      socket.off("join-accepted", onJoinAccepted);
      socket.off("join-rejected", onJoinRejected);
      socket.off("room-state", onRoomState);
      socket.off("round-ended", onRoundEnded);
      socket.off("round-ready", onRoundReady);
      socket.off("mark", onMark);
      socket.off("user-joined", onUserJoined);
      socket.off("user-left", onUserLeft);
      window.removeEventListener("beforeunload", leaveOnUnload);
    };
  }, [onSizeAssigned, reset, signal]);

  useEffect(
    () => () => {
      const roomId = activeBoard.current?.roomId ?? pendingJoin.current?.roomId;
      if (roomId) socket.emit("leave-room", { roomId });
    },
    [],
  );

  function join(request: JoinRequest) {
    if (
      !socket.connected ||
      pendingJoin.current ||
      !request.roomId.trim() ||
      !request.user.trim()
    )
      return;
    const normalized = {
      ...request,
      roomId: request.roomId.trim(),
      user: request.user.trim(),
    };
    pendingJoin.current = normalized;
    setJoining(true);
    socket.emit("join-room", { ...normalized, textsVersion: TEXTS_VERSION });
  }

  function leave() {
    if (activeBoard.current)
      socket.emit("leave-room", { roomId: activeBoard.current.roomId });
    reset();
  }

  function restart() {
    if (summary)
      socket.emit("round-restart", {
        roomId: summary.roomId,
        roundId: summary.roundId,
      });
  }

  return {
    connected,
    board,
    summary,
    players,
    readiness,
    joining,
    join,
    leave,
    restart,
    selfId: socket.id,
  };
}
