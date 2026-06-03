import { normalizeRoomCode } from "@musical-bingo/shared";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text } from "react-native";
import { AppBar, Button, Field, Panel, Screen } from "@/components/ui";
import { ApiError, joinRoom } from "@/lib/api";
import { useSessionStore } from "@/store/sessionStore";

export default function JoinRoomScreen() {
  const params = useLocalSearchParams<{ code: string }>();
  const code = normalizeRoomCode(params.code ?? "");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const setSession = useSessionStore((state) => state.setSession);

  const handleJoin = async () => {
    try {
      setError(undefined);
      setLoading(true);
      const response = await joinRoom(code, name.trim());
      setSession({ token: response.guestToken, role: "guest", snapshot: response });
      router.replace("/");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No pudimos entrar en la sala");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen>
      <AppBar title="Elige tu nombre" subtitle={`Sala ${code}`} />
      <Panel>
        <Field
          autoFocus
          maxLength={20}
          placeholder="Tu nombre"
          value={name}
          onChangeText={setName}
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Button label="Unirme" onPress={handleJoin} loading={loading} disabled={name.trim().length < 2 || code.length < 6} />
        <Button label="Volver" onPress={() => router.replace("/")} variant="secondary" />
      </Panel>
    </Screen>
  );
}

const styles = StyleSheet.create({
  error: {
    color: "#b93b2e",
    fontSize: 14,
    fontWeight: "800"
  }
});
