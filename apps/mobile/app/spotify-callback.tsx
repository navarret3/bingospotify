import { router, useLocalSearchParams } from "expo-router";
import Head from "expo-router/head";
import { useEffect, useState } from "react";
import { StyleSheet, Text } from "react-native";
import { AppBar, Button, Panel, Screen } from "@/components/ui";
import { SITE_NAME, SITE_URL } from "@/lib/site";
import { completeSpotifyLogin } from "@/lib/spotifyAuth";

export default function SpotifyCallbackScreen() {
  const params = useLocalSearchParams<{ code?: string; state?: string; error?: string }>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (params.error) {
      setError("No pudimos conectar con Spotify. Inténtalo de nuevo.");
      return;
    }
    if (!params.code || !params.state) {
      setError("Spotify no devolvió un código válido.");
      return;
    }

    completeSpotifyLogin(params.code, params.state)
      .then(() => router.replace("/?create=1"))
      .catch((err) => setError(err instanceof Error ? err.message : "No pudimos conectar con Spotify."));
  }, [params.code, params.error, params.state]);

  return (
    <Screen>
      <Head>
        <title>Conectando Spotify - {SITE_NAME}</title>
        <meta
          name="description"
          content="Pantalla de retorno para completar la conexión con Spotify antes de crear una partida."
        />
        <meta name="robots" content="noindex, nofollow" />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content={SITE_NAME} />
        <meta property="og:title" content={`Conectando Spotify - ${SITE_NAME}`} />
        <meta
          property="og:description"
          content="Pantalla de retorno para completar la conexión con Spotify antes de crear una partida."
        />
        <meta property="og:image" content={`${SITE_URL}/og-image.svg`} />
      </Head>
      <AppBar title="Conectando Spotify" subtitle="Preparando tus playlists" />
      <Panel>
        {error ? (
          <>
            <Text style={styles.error}>{error}</Text>
            <Button label="Volver" onPress={() => router.replace("/?create=1")} variant="secondary" />
          </>
        ) : (
          <Text style={styles.copy}>Un momento...</Text>
        )}
      </Panel>
    </Screen>
  );
}

const styles = StyleSheet.create({
  copy: {
    color: "#fff7d6",
    fontSize: 16,
    fontWeight: "800",
    textAlign: "center"
  },
  error: {
    color: "#ff7a5c",
    fontSize: 15,
    fontWeight: "900",
    lineHeight: 21
  }
});
