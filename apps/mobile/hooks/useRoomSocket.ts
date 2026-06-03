import type { ClientGameEvent, GameEvent } from "@musical-bingo/shared";
import { useEffect, useRef, useState } from "react";
import { getRoomById } from "@/lib/api";
import { WS_BASE_URL } from "@/lib/constants";
import { useSessionStore } from "@/store/sessionStore";

export function useRoomSocket() {
  const token = useSessionStore((state) => state.token);
  const snapshot = useSessionStore((state) => state.snapshot);
  const setSnapshot = useSessionStore((state) => state.setSnapshot);
  const updateCurrentCard = useSessionStore((state) => state.updateCurrentCard);
  const [connected, setConnected] = useState(false);
  const socketRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!token || !snapshot?.room.id) {
      return;
    }

    let closedByEffect = false;
    const socket = new WebSocket(`${WS_BASE_URL}/ws?roomId=${snapshot.room.id}&token=${token}`);
    socketRef.current = socket;

    socket.onopen = () => {
      setConnected(true);
      getRoomById(snapshot.room.id, token).then(setSnapshot).catch(() => undefined);
    };
    socket.onclose = () => {
      setConnected(false);
      if (!closedByEffect) {
        setTimeout(() => {
          getRoomById(snapshot.room.id, token).then(setSnapshot).catch(() => undefined);
        }, 1200);
      }
    };
    socket.onmessage = (event) => {
      const message = JSON.parse(event.data) as GameEvent;
      if (message.type === "card_state") {
        updateCurrentCard(message.payload.card);
        return;
      }
      if (
        message.type === "player_joined" ||
        message.type === "game_started" ||
        message.type === "game_finished" ||
        message.type === "bingo_confirmed" ||
        message.type === "game_reset"
      ) {
        getRoomById(snapshot.room.id, token).then(setSnapshot).catch(() => undefined);
      }
    };

    return () => {
      closedByEffect = true;
      socket.close();
    };
  }, [snapshot?.room.id, token, setSnapshot, updateCurrentCard]);

  const send = (event: ClientGameEvent) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(event));
    }
  };

  return { connected, send };
}
