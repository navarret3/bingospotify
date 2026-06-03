import type { ClientGameEvent, GameEvent } from "@musical-bingo/shared";
import { useEffect, useRef, useState } from "react";
import { ApiError, getRoomById } from "@/lib/api";
import { WS_BASE_URL } from "@/lib/constants";
import { useSessionStore } from "@/store/sessionStore";

export function useRoomSocket() {
  const token = useSessionStore((state) => state.token);
  const snapshot = useSessionStore((state) => state.snapshot);
  const setSnapshot = useSessionStore((state) => state.setSnapshot);
  const updateCurrentCard = useSessionStore((state) => state.updateCurrentCard);
  const clear = useSessionStore((state) => state.clear);
  const [connected, setConnected] = useState(false);
  const socketRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!token || !snapshot?.room.id) {
      return;
    }

    let closedByEffect = false;
    const socket = new WebSocket(`${WS_BASE_URL}/ws?roomId=${snapshot.room.id}&token=${token}`);
    socketRef.current = socket;

    const refreshSnapshot = () => {
      getRoomById(snapshot.room.id, token)
        .then(setSnapshot)
        .catch((error) => {
          if (
            error instanceof ApiError &&
            (error.code === "ROOM_NOT_FOUND" || error.code === "UNAUTHORIZED")
          ) {
            clear();
          }
        });
    };

    socket.onopen = () => {
      setConnected(true);
      refreshSnapshot();
    };
    socket.onclose = () => {
      setConnected(false);
      if (!closedByEffect) {
        setTimeout(() => {
          refreshSnapshot();
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
        message.type === "player_left" ||
        message.type === "game_started" ||
        message.type === "game_finished" ||
        message.type === "bingo_confirmed" ||
        message.type === "game_reset"
      ) {
        refreshSnapshot();
      }
    };

    return () => {
      closedByEffect = true;
      socket.close();
    };
  }, [snapshot?.room.id, token, clear, setSnapshot, updateCurrentCard]);

  const send = (event: ClientGameEvent) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(event));
    }
  };

  return { connected, send };
}
