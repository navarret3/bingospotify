import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import Head from "expo-router/head";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import { SafeAreaView, StyleSheet } from "react-native";

import { SITE_NAME } from "@/lib/site";

export default function RootLayout() {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaView style={styles.shell}>
        <Head>
          <title>{SITE_NAME}</title>
          <meta name="application-name" content={SITE_NAME} />
          <meta name="apple-mobile-web-app-title" content={SITE_NAME} />
          <meta name="theme-color" content="#17072f" />
          <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
          <link rel="manifest" href="/manifest.webmanifest" />
        </Head>
        <Stack screenOptions={{ headerShown: false }} />
        <StatusBar style="light" />
      </SafeAreaView>
    </QueryClientProvider>
  );
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    backgroundColor: "#17072f"
  }
});
