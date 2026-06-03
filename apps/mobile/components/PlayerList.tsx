import type { Player } from "@musical-bingo/shared";
import { StyleSheet, Text, View } from "react-native";
import { Badge, colors } from "./ui";

export function PlayerList({ players }: { players: Player[] }) {
  return (
    <View style={styles.list}>
      {players.map((player) => (
        <View key={player.id} style={styles.row}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{player.name.charAt(0).toUpperCase()}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{player.name}</Text>
            <Text style={styles.role}>{player.isHost ? "Anfitrión" : "Jugador"}</Text>
          </View>
          <Badge label={player.connected ? "Conectado" : "Reconectando"} tone={player.connected ? "green" : "orange"} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: 10
  },
  row: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.14)",
    paddingBottom: 10
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.coral,
    borderWidth: 2,
    borderColor: "rgba(255, 255, 255, 0.55)"
  },
  avatarText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "900"
  },
  name: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: "800"
  },
  role: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "600"
  }
});
