import { Modal, StyleSheet, Text, View } from "react-native";
import { Button, colors } from "./ui";

export function BingoConfirmModal({
  visible,
  onConfirm,
  onDeny
}: {
  visible: boolean;
  onConfirm: () => void;
  onDeny: () => void;
}) {
  return (
    <Modal animationType="fade" transparent visible={visible}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.emoji}>♪</Text>
          <Text style={styles.title}>¡Bingo!</Text>
          <Text style={styles.copy}>¿Has completado todas las canciones?</Text>
          <Button label="¡Sí, he ganado!" onPress={onConfirm} />
          <Button label="Ops, me equivoqué" onPress={onDeny} variant="secondary" />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(8, 2, 22, 0.72)",
    padding: 18
  },
  card: {
    width: "100%",
    maxWidth: 360,
    borderRadius: 22,
    backgroundColor: "#2b0f55",
    borderWidth: 2,
    borderColor: "rgba(255, 210, 63, 0.7)",
    padding: 22,
    gap: 12,
    alignItems: "stretch"
  },
  emoji: {
    color: colors.yellow,
    textAlign: "center",
    fontSize: 64,
    lineHeight: 70,
    fontWeight: "900"
  },
  title: {
    color: colors.ink,
    textAlign: "center",
    fontSize: 30,
    lineHeight: 36,
    fontWeight: "900"
  },
  copy: {
    color: colors.muted,
    textAlign: "center",
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "700",
    marginBottom: 8
  }
});
