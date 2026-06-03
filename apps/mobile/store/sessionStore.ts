import type { BingoCard, Player, RoomSnapshot } from "@musical-bingo/shared";
import { create } from "zustand";

type Role = "host" | "guest";

interface SessionState {
  token?: string;
  role?: Role;
  snapshot?: RoomSnapshot;
  setSession: (payload: { token: string; role: Role; snapshot: RoomSnapshot }) => void;
  setSnapshot: (snapshot: RoomSnapshot) => void;
  updateCurrentCard: (card: BingoCard) => void;
  clear: () => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  setSession: ({ token, role, snapshot }) => set({ token, role, snapshot }),
  setSnapshot: (snapshot) => set({ snapshot }),
  updateCurrentCard: (card) =>
    set((state) => {
      if (!state.snapshot?.currentPlayer) {
        return state;
      }
      const currentPlayer: Player = { ...state.snapshot.currentPlayer, card };
      return {
        snapshot: {
          ...state.snapshot,
          currentPlayer,
          players: state.snapshot.players.map((player) =>
            player.id === currentPlayer.id ? currentPlayer : player
          )
        }
      };
    }),
  clear: () => set({ token: undefined, role: undefined, snapshot: undefined })
}));
