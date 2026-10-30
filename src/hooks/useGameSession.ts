import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { toast } from "react-hot-toast";
import { ICONS } from "../data/icons";
import type { FeedbackKind } from "../data/notificationFeedback";
import { UI } from "../data/uiTexts";
import { playerMessage } from "../shared/playerMessage";
import { socket } from "../socket";
import { TEXTS_VERSION } from "../textsVersion";
import type {
  BoardAssignment,
  BoardSize,
  PlayerIdentity,
  RoundSummary,
} from "../types/bingo";
import type { MarkNotification, RoundReadiness } from "../types/socket";
import { isValidBoardAssignment } from "../utils/boardAssignment";

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
  const [players, setPlayers] = useState<PlayerIdentity[]>([]);
  const [readiness, setReadiness] = useState<
    Pick<RoundReadiness, "ready" | "members">
  >({
    ready: [],
    members: [],
  });
  const [joining, setJoining] = useState(false);
  // Socket.IO may deliver the next event before React commits the previous update.
  const activeBoard = useRef<BoardAssignment | null>(null);
  const pendingJoin = useRef<(JoinRequest & { joinRequestId: string }) | null>(
    null,
  );
  const joinTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearJoinTimer = useCallback(() => {
    if (joinTimer.current !== null) clearTimeout(joinTimer.current);
    joinTimer.current = null;
  }, []);
  const roundFinished = useRef(false);

  const finishJoin = useCallback(() => {
    clearJoinTimer();
    pendingJoin.current = null;
    setJoining(false);
  }, [clearJoinTimer]);

  const reset = useCallback(() => {
    finishJoin();
    activeBoard.current = null;
    roundFinished.current = false;
    setBoard(null);
    setSummary(null);
    setPlayers([]);
    setReadiness({ ready: [], members: [] });
  }, [finishJoin]);

  useEffect(() => {
    const onDisconnect = () => {
      reset();
      toast.error(UI.disconnected);
    };
    const onConnectError = () => {
      finishJoin();
      toast.error(UI.connectionError, { id: "connection-error" });
    };
    const onJoinAccepted = (assignment: BoardAssignment) => {
      const request = pendingJoin.current;
      if (
        assignment.joinRequestId &&
        assignment.joinRequestId !== request?.joinRequestId
      )
        return;
      if (
        assignment.roomId !== (request?.roomId ?? activeBoard.current?.roomId)
      ) {
        socket.emit("leave-room", { roomId: assignment.roomId });
        return;
      }
      finishJoin();
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
      activeBoard.current = assignment;
      roundFinished.current = false;
      setBoard(assignment);
      setSummary(null);
      setReadiness({ ready: [], members: [] });
    };
    const onJoinRejected = ({
      reason,
      joinRequestId,
    }: {
      reason: string;
      joinRequestId?: string;
    }) => {
      if (joinRequestId && joinRequestId !== pendingJoin.current?.joinRequestId)
        return;
      finishJoin();
      toast.error(
        reason === "name-taken"
          ? UI.nameTaken
          : reason === "not-enough-texts"
            ? UI.notEnoughTexts
            : UI.joinError,
      );
    };
    const onRequestRejected = ({
      event,
      joinRequestId,
    }: {
      event: string;
      joinRequestId?: string;
    }) => {
      if (event === "join-room") {
        if (
          joinRequestId &&
          joinRequestId !== pendingJoin.current?.joinRequestId
        )
          return;
        finishJoin();
      }
      toast.error(UI.requestRejected, { id: "request-rejected" });
    };
    const onRoomState = (state: {
      roomId: string;
      players: PlayerIdentity[];
    }) => {
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
    socket.on("request-rejected", onRequestRejected);
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
      socket.off("request-rejected", onRequestRejected);
      socket.off("room-state", onRoomState);
      socket.off("round-ended", onRoundEnded);
      socket.off("round-ready", onRoundReady);
      socket.off("mark", onMark);
      socket.off("user-joined", onUserJoined);
      socket.off("user-left", onUserLeft);
      window.removeEventListener("beforeunload", leaveOnUnload);
    };
  }, [onSizeAssigned, reset, signal, finishJoin]);

  useEffect(
    () => () => {
      clearJoinTimer();
      const roomId = activeBoard.current?.roomId ?? pendingJoin.current?.roomId;
      if (roomId) socket.emit("leave-room", { roomId });
    },
    [clearJoinTimer],
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
      joinRequestId: crypto.randomUUID(),
    };
    pendingJoin.current = normalized;
    setJoining(true);
    joinTimer.current = setTimeout(() => {
      if (pendingJoin.current?.joinRequestId !== normalized.joinRequestId)
        return;
      finishJoin();
      socket.emit("leave-room", { roomId: normalized.roomId });
      toast.error(UI.joinTimeout);
    }, 8000);
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
