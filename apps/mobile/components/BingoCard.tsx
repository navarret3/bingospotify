import type { BingoCard as BingoCardModel, BingoCell as BingoCellModel } from "@musical-bingo/shared";
import { LinearGradient } from "expo-linear-gradient";
import { Check, Music2 } from "lucide-react-native";
import { Image, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";

export function BingoCard({
  card,
  disabled,
  onToggle,
  style
}: {
  card: BingoCardModel;
  disabled?: boolean;
  onToggle?: (row: number, col: number, marked: boolean) => void;
  style?: StyleProp<ViewStyle>;
}) {
  const totalRows = card.cells.length;
  return (
    <View style={[styles.grid, style]}>
      {card.cells.map((row, rowIndex) => (
        <View key={rowIndex} style={styles.row}>
          {row.map((cell, colIndex) => (
            <BingoCell
              key={`${cell.track.spotifyId}-${rowIndex}-${colIndex}`}
              cell={cell}
              isLastRow={rowIndex === totalRows - 1}
              isLastCol={colIndex === row.length - 1}
              disabled={disabled}
              onPress={() => onToggle?.(rowIndex, colIndex, !cell.marked)}
            />
          ))}
        </View>
      ))}
    </View>
  );
}

function BingoCell({
  cell,
  isLastRow,
  isLastCol,
  disabled,
  onPress
}: {
  cell: BingoCellModel;
  isLastRow: boolean;
  isLastCol: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  const backgroundUri = cell.track.artistImageUrl || cell.track.imageUrl;
  const hasRemoteImage = backgroundUri.startsWith("http");
  const artColor = albumColors[Math.abs(hashCode(cell.track.spotifyId)) % albumColors.length];

  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.cell,
        isLastRow && styles.cellLastRow,
        isLastCol && styles.cellLastCol,
        pressed && !disabled && styles.cellPressed
      ]}
    >
      <View style={StyleSheet.absoluteFill}>
        {hasRemoteImage ? (
          <Image source={{ uri: backgroundUri }} style={styles.cover} resizeMode="cover" />
        ) : (
          <View style={[styles.cover, styles.fallbackCover, { backgroundColor: artColor }]}>
            <Music2 color="rgba(255,255,255,0.22)" size={36} strokeWidth={1.5} />
          </View>
        )}
      </View>
      <LinearGradient
        colors={["transparent", "rgba(4,2,14,0.5)", "rgba(4,2,14,0.93)"]}
        style={styles.scrim}
      />
      <View style={styles.textContent}>
        <Text numberOfLines={2} style={styles.trackName}>
          {cell.track.name}
        </Text>
        <Text numberOfLines={1} style={styles.artistName}>
          {cell.track.artist}
        </Text>
      </View>
      {cell.marked ? (
        <View style={styles.markedOverlay}>
          <View style={styles.checkBadge}>
            <Check color="#fff" size={22} strokeWidth={3.5} />
          </View>
        </View>
      ) : null}
    </Pressable>
  );
}

const albumColors = [
  "#1db954", "#e8453c", "#2f80ed", "#8d5cf6",
  "#14b8a6", "#f59e0b", "#ec4899", "#0ea5e9",
  "#84cc16", "#f97316", "#6366f1", "#10b981"
];

function hashCode(value: string): number {
  return value.split("").reduce((hash, char) => (hash * 31 + char.charCodeAt(0)) | 0, 0);
}

const DIVIDER = "rgba(255, 215, 110, 0.55)";

const styles = StyleSheet.create({
  grid: {
    width: "100%",
    borderRadius: 18,
    borderWidth: 3,
    borderColor: "rgba(255, 215, 110, 0.92)",
    overflow: "hidden",
    backgroundColor: "#0e0509",
    shadowColor: "#000",
    shadowOpacity: 0.6,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 16 },
    elevation: 18
  },
  row: {
    flex: 1,
    flexDirection: "row",
    minHeight: 80
  },
  cell: {
    flex: 1,
    overflow: "hidden",
    borderRightWidth: 1.5,
    borderBottomWidth: 1.5,
    borderColor: DIVIDER
  },
  cellLastRow: { borderBottomWidth: 0 },
  cellLastCol: { borderRightWidth: 0 },
  cellPressed: { opacity: 0.75 },
  cover: { width: "100%", height: "100%" },
  fallbackCover: { alignItems: "center", justifyContent: "center" },
  scrim: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: "78%"
  },
  textContent: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 7,
    paddingBottom: 7,
    gap: 2
  },
  trackName: {
    color: "#ffffff",
    fontSize: 12,
    lineHeight: 15,
    fontWeight: "800",
    textShadowColor: "rgba(0,0,0,0.95)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 5
  },
  artistName: {
    color: "rgba(255, 225, 150, 0.95)",
    fontSize: 9.5,
    lineHeight: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    textShadowColor: "rgba(0,0,0,0.95)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4
  },
  markedOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(220, 40, 100, 0.5)",
    alignItems: "center",
    justifyContent: "center"
  },
  checkBadge: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#dc2864",
    borderWidth: 2.5,
    borderColor: "rgba(255,255,255,0.92)",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.45,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8
  }
});
