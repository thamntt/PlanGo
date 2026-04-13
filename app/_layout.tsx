import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import { QueryClientProvider } from "@tanstack/react-query";
import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { queryClient } from "@/lib/query-client";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { DataProvider } from "@/contexts/DataContext";
import { SettingsProvider } from "@/contexts/SettingsContext";
import GlobalLoading from "@/components/GlobalLoading";

SplashScreen.preventAutoHideAsync();

// Global pending redirect — set by login/join screens, consumed by AuthGate
let _pendingRedirect: string | null = null;
export function setPendingRedirect(path: string | null) {
  // Only accept valid non-empty string paths
  _pendingRedirect = (path && typeof path === "string" && path.startsWith("/")) ? path : null;
}

function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, isLoading, isAdmin } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === "(auth)";
    const inJoinGroup = segments[0] === "join";

    if (!user && !inAuthGroup && !inJoinGroup) {
      router.replace("/(auth)/login");
    } else if (user && inAuthGroup) {
      // Check if there is a pending redirect (e.g. from /join/[code] → login → back to /join/[code])
      const redirect = _pendingRedirect;
      _pendingRedirect = null; // Always clear to prevent stale redirects
      if (redirect) {
        try {
          router.replace(redirect as any);
        } catch (e) {
          console.warn("[AuthGate] Redirect failed, going to tabs:", e);
          router.replace("/(tabs)");
        }
      } else {
        router.replace("/(tabs)");
      }
    }
  }, [user, isLoading, segments]);

  return <>{children}</>;
}

function RootLayoutNav() {
  return (
    <AuthGate>
      <Stack screenOptions={{ headerBackTitle: "Back" }}>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="destination/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="itinerary/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="itinerary/edit" options={{ title: "Edit Itinerary", headerShown: true }} />
        <Stack.Screen name="create-trip" options={{ headerShown: false }} />
        <Stack.Screen name="notifications" options={{ headerShown: false }} />
        <Stack.Screen name="admin" options={{ headerShown: false }} />
        <Stack.Screen name="join/[code]" options={{ headerShown: false }} />
        <Stack.Screen name="+not-found" />
      </Stack>
    </AuthGate>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <GestureHandlerRootView>
          <KeyboardProvider>
            <SettingsProvider>
              <AuthProvider>
                <DataProvider>
                  <GlobalLoading />
                  <RootLayoutNav />
                </DataProvider>
              </AuthProvider>
            </SettingsProvider>
          </KeyboardProvider>
        </GestureHandlerRootView>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
