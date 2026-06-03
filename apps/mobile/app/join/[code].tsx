import { normalizeRoomCode } from "@musical-bingo/shared";
import { router, useLocalSearchParams } from "expo-router";
import Head from "expo-router/head";
import { useState } from "react";
import { StyleSheet, Text } from "react-native";
import { AppBar, Button, Field, Panel, Screen } from "@/components/ui";
import { SITE_NAME, SITE_URL } from "@/lib/site";
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
      <Head>
        <title>Unirse a una sala - {SITE_NAME}</title>
        <meta
          name="description"
          content="Únete a una sala de bingo musical con el código que te ha compartido el anfitrión."
        />
        <meta name="robots" content="noindex, nofollow" />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content={SITE_NAME} />
        <meta property="og:title" content={`Unirse a una sala - ${SITE_NAME}`} />
        <meta
          property="og:description"
          content="Únete a una sala de bingo musical con el código que te ha compartido el anfitrión."
        />
        <meta property="og:image" content={`${SITE_URL}/og-image.svg`} />
      </Head>
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
