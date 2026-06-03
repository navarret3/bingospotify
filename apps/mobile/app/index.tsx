import { router, useLocalSearchParams } from "expo-router";
import { Link2, Music2, Users } from "lucide-react-native";
import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import QRCode from "react-native-qrcode-svg";
import { BingoCard } from "@/components/BingoCard";
import { BingoConfirmModal } from "@/components/BingoConfirmModal";
import { PlayerList } from "@/components/PlayerList";
import { AppBar, Badge, Button, colors, Field, Panel, Screen } from "@/components/ui";
import { useRoomSocket } from "@/hooks/useRoomSocket";
import { ApiError, createRoom, leaveRoom, resetRoom, startRoom } from "@/lib/api";

import { useSessionStore } from "@/store/sessionStore";
import { CARD_CELL_COUNT } from "@musical-bingo/shared";

type HomeMode = "home" | "create";

export default function Home() {
  const [mode, setMode] = useState<HomeMode>("home");
  const params = useLocalSearchParams<{ create?: string }>();
  const snapshot = useSessionStore((state) => state.snapshot);

  useEffect(() => {
    if (params.create === "1") {
      setMode("create");
    }
  }, [params.create]);

  if (snapshot?.room.status === "lobby") {
    return <LobbyScreen />;
  }
  if (snapshot?.room.status === "playing") {
    return <GameScreen />;
  }
  if (snapshot?.room.status === "finished") {
    return <ResultsScreen />;
  }
  if (mode === "create") {
    return <CreateRoomScreen onBack={() => setMode("home")} />;
  }
  return <HomeScreen onCreate={() => setMode("create")} />;
}

function HomeScreen({ onCreate }: { onCreate: () => void }) {
  const [code, setCode] = useState("");

  return (
    <Screen>
      <View style={styles.hero}>
        <View style={styles.logo}>
          <Music2 color="#fff" size={34} strokeWidth={2.6} />
        </View>
        <Text style={styles.heroTitle}>Musical Bingo</Text>
        <Text style={styles.heroCopy}>
          Pega una playlist de Spotify y deja que cada invitado marque sus canciones desde el móvil.
        </Text>
      </View>

      <Panel>
        <Button label="Crear partida" onPress={onCreate} />
        <View style={styles.dividerRow}>
          <View style={styles.divider} />
          <Text style={styles.dividerText}>o entra con código</Text>
          <View style={styles.divider} />
        </View>
        <Field
          autoCapitalize="characters"
          maxLength={6}
          placeholder="XK93PL"
          value={code}
          onChangeText={setCode}
        />
        <Button
          label="Unirme a una partida"
          onPress={() => router.push(`/join/${code.trim().toUpperCase()}`)}
          variant="secondary"
          disabled={code.trim().length < 6}
        />
      </Panel>
    </Screen>
  );
}

function CreateRoomScreen({ onBack }: { onBack: () => void }) {
  const [playlistUrl, setPlaylistUrl] = useState("");
  const [hostName, setHostName] = useState("Anfitrión");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const setSession = useSessionStore((state) => state.setSession);

  const handleCreate = async () => {
    try {
      setError(undefined);
      setLoading(true);
      const response = await createRoom(playlistUrl.trim(), hostName.trim() || "Anfitrión");
      setSession({ token: response.hostToken, role: "host", snapshot: response });
    } catch (err) {
      setError(
        err instanceof ApiError ? `[${err.code}] ${err.message}` : "No se pudo crear la sala"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen>
      <AppBar title="Crear partida" subtitle="Pega una playlist de Spotify" />
      <Panel>
        <View style={styles.inlineTitle}>
          <Link2 color={colors.ink} size={20} />
          <Text style={styles.panelTitle}>Playlist</Text>
        </View>
        <Field
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="https://open.spotify.com/playlist/..."
          value={playlistUrl}
          onChangeText={setPlaylistUrl}
        />
        <Field
          maxLength={20}
          placeholder="Nombre del anfitrión"
          value={hostName}
          onChangeText={setHostName}
        />
        <Text style={styles.helpText}>
          Funciona con playlists públicas de Spotify.
        </Text>
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        <Button
          label="Crear sala"
          onPress={handleCreate}
          loading={loading}
          disabled={playlistUrl.trim().length < 12}
        />
        <Button label="Volver" onPress={onBack} variant="secondary" />
      </Panel>
      <ScrollView contentContainerStyle={styles.stack}>
        <Panel compact>
          <Text style={styles.centerMuted}>
            El cartón necesita al menos 18 canciones visibles en la playlist.
          </Text>
        </Panel>
      </ScrollView>
    </Screen>
  );
}

function LobbyScreen() {
  const snapshot = useSessionStore((state) => state.snapshot)!;
  const token = useSessionStore((state) => state.token)!;
  const role = useSessionStore((state) => state.role);
  const setSnapshot = useSessionStore((state) => state.setSnapshot);
  const { connected } = useRoomSocket();
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string>();
  const inviteOrigin = globalThis.location?.origin ?? "http://localhost:8081";
  const inviteUrl = `${inviteOrigin}/join/${snapshot.room.code}`;
  const canStart = role === "host" && snapshot.players.length >= 2;

  const handleStart = async () => {
    try {
      setError(undefined);
      setLoading(true);
      setSnapshot(await startRoom(snapshot.room.id, token));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo empezar la partida");
    } finally {
      setLoading(false);
    }
  };

  const copyInvite = async () => {
    const clipboard = (globalThis.navigator as { clipboard?: { writeText: (value: string) => Promise<void> } } | undefined)?.clipboard;
    await clipboard?.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  };

  return (
    <Screen>
      <AppBar
        title="Lobby"
        subtitle={role === "host" ? snapshot.room.playlistName : "Esperando al anfitrión"}
        right={<Badge label={connected ? "WS activo" : "Reconectando"} tone={connected ? "green" : "orange"} />}
      />
      <Panel>
        <Text style={styles.roomCode}>{snapshot.room.code}</Text>
        <Text style={styles.centerMuted}>Comparte el código o enseña el QR</Text>
        <View style={styles.qrWrap}>
          <QRCode value={inviteUrl} size={190} backgroundColor="#ffffff" color="#18201c" />
        </View>
        <Button label={copied ? "Enlace copiado" : "Copiar enlace"} onPress={copyInvite} variant="secondary" />
      </Panel>
      <Panel>
        <View style={styles.panelTitleRow}>
          <View style={styles.inlineTitle}>
            <Users color={colors.ink} size={20} />
            <Text style={styles.panelTitle}>Jugadores</Text>
          </View>
          <Badge label={`${snapshot.players.length} jugadores`} />
        </View>
        <PlayerList players={snapshot.players} />
      </Panel>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      {role === "host" ? (
        <Button label="Empezar Bingo" onPress={handleStart} disabled={!canStart} loading={loading} />
      ) : (
        <Panel compact>
          <Text style={styles.centerMuted}>Esperando a que el anfitrión inicie el juego...</Text>
        </Panel>
      )}
    </Screen>
  );
}

function GameScreen() {
  const snapshot = useSessionStore((state) => state.snapshot)!;
  const { send } = useRoomSocket();
  const [showBingo, setShowBingo] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [leaveError, setLeaveError] = useState<string>();
  const card = snapshot.currentPlayer?.card;
  const token = useSessionStore((state) => state.token)!;
  const clear = useSessionStore((state) => state.clear);

  useEffect(() => {
    if (card?.markedCount === CARD_CELL_COUNT) {
      setShowBingo(true);
    }
  }, [card?.markedCount]);

  if (!card) {
    return (
      <Screen>
        <AppBar title="Preparando cartón" subtitle="Sincronizando con la sala" />
      </Screen>
    );
  }

  return (
    <Screen>
      <AppBar
        title="Bingo Musical"
        right={<Badge label={`${card.markedCount}/${CARD_CELL_COUNT}`} tone={card.markedCount === CARD_CELL_COUNT ? "green" : "neutral"} />}
      />
      <BingoCard
        card={card}
        style={{ flex: 1 }}
        onToggle={(row, col, marked) => send({ type: marked ? "mark_cell" : "unmark_cell", row, col })}
      />
      <Panel>
        <View style={styles.panelTitleRow}>
          <View style={styles.inlineTitle}>
            <Users color={colors.ink} size={20} />
            <Text style={styles.panelTitle}>Jugadores</Text>
          </View>
          <Badge label={`${snapshot.players.length} jugadores`} />
        </View>
        <PlayerList players={snapshot.players} />
        {leaveError ? <Text style={styles.errorText}>{leaveError}</Text> : null}
        <Button
          label="Salir de la sala"
          variant="danger"
          loading={leaving}
          onPress={async () => {
            try {
              setLeaveError(undefined);
              setLeaving(true);
              await leaveRoom(snapshot.room.id, token);
              clear();
            } catch (err) {
              setLeaveError(err instanceof ApiError ? err.message : "No se pudo salir de la sala");
            } finally {
              setLeaving(false);
            }
          }}
        />
      </Panel>
      <BingoConfirmModal
        visible={showBingo}
        onConfirm={() => {
          setShowBingo(false);
          send({ type: "confirm_bingo" });
        }}
        onDeny={() => {
          setShowBingo(false);
          send({ type: "deny_bingo" });
        }}
      />
    </Screen>
  );
}

function ResultsScreen() {
  const snapshot = useSessionStore((state) => state.snapshot)!;
  const role = useSessionStore((state) => state.role);
  const token = useSessionStore((state) => state.token)!;
  const setSnapshot = useSessionStore((state) => state.setSnapshot);
  const clear = useSessionStore((state) => state.clear);
  const winner = snapshot.winner ?? snapshot.players.find((player) => player.id === snapshot.room.winnerId);

  return (
    <Screen>
      <View style={styles.resultsHero}>
        <Text style={styles.confetti}>* * *</Text>
        <View style={styles.winnerAvatar}>
          <Text style={styles.winnerAvatarText}>{winner?.name.charAt(0).toUpperCase()}</Text>
        </View>
        <Text style={styles.resultsTitle}>¡{winner?.name} ha ganado!</Text>
        <Text style={styles.heroCopy}>{winner?.name} ha hecho BINGO musical.</Text>
      </View>
      {winner?.card ? <BingoCard card={winner.card} disabled style={{ maxHeight: 320 }} /> : null}
      {role === "host" ? (
        <Button label="Jugar otra vez" onPress={async () => setSnapshot(await resetRoom(snapshot.room.id, token))} />
      ) : null}
      <Button label="Salir" onPress={clear} variant="secondary" />
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    paddingTop: 38,
    paddingBottom: 18,
    gap: 14
  },
  logo: {
    width: 70,
    height: 70,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.green
  },
  heroTitle: {
    color: colors.ink,
    fontSize: 44,
    lineHeight: 48,
    fontWeight: "900"
  },
  heroCopy: {
    color: colors.muted,
    fontSize: 17,
    lineHeight: 24,
    fontWeight: "600"
  },
  helpText: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "700"
  },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  divider: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border
  },
  dividerText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "800"
  },
  stack: {
    gap: 10,
    paddingBottom: 12
  },
  errorText: {
    color: "#b93b2e",
    fontSize: 14,
    fontWeight: "800"
  },
  roomCode: {
    color: colors.ink,
    textAlign: "center",
    fontFamily: "monospace",
    fontSize: 40,
    lineHeight: 48,
    fontWeight: "900",
    letterSpacing: 0
  },
  centerMuted: {
    color: colors.muted,
    textAlign: "center",
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "700"
  },
  qrWrap: {
    alignSelf: "center",
    backgroundColor: "#fff",
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border
  },
  panelTitleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12
  },
  inlineTitle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  panelTitle: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: "900"
  },
  connectionLine: {
    flexDirection: "row",
    justifyContent: "flex-end"
  },
  resultsHero: {
    alignItems: "center",
    gap: 12,
    paddingTop: 24
  },
  confetti: {
    color: colors.yellow,
    fontSize: 34,
    fontWeight: "900"
  },
  winnerAvatar: {
    width: 92,
    height: 92,
    borderRadius: 46,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.green
  },
  winnerAvatarText: {
    color: "#fff",
    fontSize: 40,
    fontWeight: "900"
  },
  resultsTitle: {
    color: colors.ink,
    textAlign: "center",
    fontSize: 34,
    lineHeight: 40,
    fontWeight: "900"
  }
});
