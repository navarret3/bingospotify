import { LinearGradient } from "expo-linear-gradient";
import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from "react-native";

export function Screen({ children }: { children: ReactNode }) {
  return (
    <LinearGradient colors={["#17072f", "#291052", "#071b3f"]} style={styles.stage}>
      <View style={[styles.glow, styles.glowPink]} />
      <View style={[styles.glow, styles.glowCyan]} />
      <View style={[styles.glow, styles.glowGold]} />
      <View style={styles.confettiOne} />
      <View style={styles.confettiTwo} />
      <View style={styles.confettiThree} />
      <View style={styles.screen}>{children}</View>
    </LinearGradient>
  );
}

export function AppBar({
  title,
  subtitle,
  right
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
}) {
  return (
    <View style={styles.appBar}>
      <View style={{ flex: 1 }}>
        <Text style={styles.appBarTitle}>{title}</Text>
        {subtitle ? <Text style={styles.appBarSubtitle}>{subtitle}</Text> : null}
      </View>
      {right}
    </View>
  );
}

export function Button({
  label,
  onPress,
  variant = "primary",
  disabled,
  loading
}: {
  label: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "danger";
  disabled?: boolean;
  loading?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        variant === "secondary" && styles.buttonSecondary,
        variant === "danger" && styles.buttonDanger,
        disabled && styles.buttonDisabled,
        pressed && !disabled && styles.buttonPressed
      ]}
    >
      <LinearGradient
        colors={buttonColors[variant]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.buttonGradient}
      >
        {loading ? (
          <ActivityIndicator color={variant === "secondary" ? colors.ink : "#fff"} />
        ) : (
          <Text style={[styles.buttonText, variant === "secondary" && styles.buttonTextSecondary]}>{label}</Text>
        )}
      </LinearGradient>
    </Pressable>
  );
}

export function Field(props: TextInputProps) {
  return <TextInput placeholderTextColor="#879188" {...props} style={[styles.field, props.style]} />;
}

export function Panel({ children, compact = false }: { children: ReactNode; compact?: boolean }) {
  return <View style={[styles.panel, compact && styles.panelCompact]}>{children}</View>;
}

export function Badge({ label, tone = "neutral" }: { label: string; tone?: "neutral" | "green" | "orange" }) {
  return (
    <View style={[styles.badge, tone === "green" && styles.badgeGreen, tone === "orange" && styles.badgeOrange]}>
      <Text style={styles.badgeText}>{label}</Text>
    </View>
  );
}

export const colors = {
  ink: "#fff7d6",
  muted: "#c9bde9",
  border: "rgba(255, 255, 255, 0.2)",
  surface: "rgba(30, 12, 63, 0.86)",
  green: "#18e287",
  darkGreen: "#069b67",
  coral: "#ff4f8b",
  yellow: "#ffd23f",
  cyan: "#25d7ff",
  purple: "#8d5cf6",
  navy: "#17072f"
};

const buttonColors = {
  primary: ["#ff4f8b", "#ffb000"],
  secondary: ["#fff7d6", "#a7f3ff"],
  danger: ["#ff355d", "#8d163f"]
} as const;

const styles = StyleSheet.create({
  stage: {
    flex: 1,
    overflow: "hidden"
  },
  screen: {
    flex: 1,
    width: "100%",
    maxWidth: 520,
    alignSelf: "center",
    paddingHorizontal: 18,
    paddingVertical: 16,
    gap: 16,
    zIndex: 2
  },
  glow: {
    position: "absolute",
    borderRadius: 999,
    opacity: 0.58
  },
  glowPink: {
    width: 260,
    height: 260,
    top: -86,
    right: -120,
    backgroundColor: "#ff4f8b"
  },
  glowCyan: {
    width: 220,
    height: 220,
    bottom: 90,
    left: -112,
    backgroundColor: "#25d7ff"
  },
  glowGold: {
    width: 150,
    height: 150,
    bottom: -58,
    right: 24,
    backgroundColor: "#ffd23f",
    opacity: 0.38
  },
  confettiOne: {
    position: "absolute",
    width: 54,
    height: 9,
    top: 92,
    left: 20,
    borderRadius: 9,
    backgroundColor: "#ffd23f",
    transform: [{ rotate: "-18deg" }]
  },
  confettiTwo: {
    position: "absolute",
    width: 42,
    height: 9,
    top: 210,
    right: 34,
    borderRadius: 9,
    backgroundColor: "#25d7ff",
    transform: [{ rotate: "24deg" }]
  },
  confettiThree: {
    position: "absolute",
    width: 46,
    height: 9,
    bottom: 170,
    right: 78,
    borderRadius: 9,
    backgroundColor: "#ff4f8b",
    transform: [{ rotate: "-32deg" }]
  },
  appBar: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    gap: 12
  },
  appBarTitle: {
    color: colors.ink,
    fontSize: 27,
    fontWeight: "900",
    lineHeight: 32
  },
  appBarSubtitle: {
    marginTop: 2,
    color: colors.muted,
    fontSize: 13,
    fontWeight: "800"
  },
  button: {
    minHeight: 52,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "rgba(255, 255, 255, 0.3)",
    overflow: "hidden"
  },
  buttonSecondary: {
    borderColor: "rgba(37, 215, 255, 0.72)"
  },
  buttonDanger: {
    borderColor: "rgba(255, 53, 93, 0.72)"
  },
  buttonDisabled: {
    opacity: 0.48
  },
  buttonPressed: {
    transform: [{ scale: 0.98 }]
  },
  buttonGradient: {
    width: "100%",
    minHeight: 52,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "900"
  },
  buttonTextSecondary: {
    color: "#17072f"
  },
  field: {
    minHeight: 56,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: "rgba(255, 210, 63, 0.55)",
    backgroundColor: "rgba(12, 5, 31, 0.72)",
    paddingHorizontal: 15,
    color: colors.ink,
    fontSize: 16,
    fontWeight: "900"
  },
  panel: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: colors.border,
    padding: 16,
    gap: 12
  },
  panelCompact: {
    padding: 12,
    gap: 8
  },
  badge: {
    borderRadius: 999,
    backgroundColor: "rgba(255, 247, 214, 0.16)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.22)",
    paddingHorizontal: 10,
    paddingVertical: 6
  },
  badgeGreen: {
    backgroundColor: "rgba(24, 226, 135, 0.22)",
    borderColor: "rgba(24, 226, 135, 0.6)"
  },
  badgeOrange: {
    backgroundColor: "rgba(255, 210, 63, 0.22)",
    borderColor: "rgba(255, 210, 63, 0.65)"
  },
  badgeText: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: "800"
  }
});
