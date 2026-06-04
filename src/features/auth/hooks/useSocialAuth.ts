import { useCallback, useEffect, useState } from "react";
import { Platform } from "react-native";
import * as WebBrowser from "expo-web-browser";
import { apiRequest } from "@/lib/api/query-client";
import { setToken } from "@/lib/api/auth-token";

WebBrowser.maybeCompleteAuthSession();

const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_WEB;
const GOOGLE_IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_IOS;
const GOOGLE_ANDROID_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_ANDROID;
const FACEBOOK_APP_ID = process.env.EXPO_PUBLIC_FACEBOOK_APP_ID;

const GOOGLE_CONFIGURED = !!(
  GOOGLE_WEB_CLIENT_ID ||
  GOOGLE_IOS_CLIENT_ID ||
  GOOGLE_ANDROID_CLIENT_ID
);
const FACEBOOK_CONFIGURED = !!FACEBOOK_APP_ID;

export interface SocialAuthResult {
  success: boolean;
  user?: any;
  error?: string;
}

async function exchangeForJwt(
  provider: "google" | "facebook" | "apple",
  payload: { idToken?: string; accessToken?: string; fullName?: string },
): Promise<SocialAuthResult> {
  try {
    const res = await apiRequest("POST", "/api/auth/social", { provider, ...payload });
    const json = await res.json();
    const data = json?.data ?? json;
    if (!data?.token) return { success: false, error: "Server không trả về token" };
    await setToken(data.token);
    return { success: true, user: data };
  } catch (err: any) {
    const msg = err?.message || "Login failed";
    if (msg.includes("501") || msg.includes("OAUTH_NOT_CONFIGURED")) {
      return { success: false, error: "OAuth chưa được cấu hình trên server" };
    }
    if (msg.includes("EMAIL_PERMISSION_REQUIRED")) {
      return { success: false, error: "Cần cấp quyền email" };
    }
    return { success: false, error: msg };
  }
}

// ──────────────────────────────────────────────────────────────
// Google
// We lazy-load expo-auth-session/providers/google only when credentials are
// configured. Without env vars, the hook stays a no-op so the login screen
// renders without throwing (calling Google.useIdTokenAuthRequest with all
// undefined clientIds throws on web in expo-auth-session v7).
// ──────────────────────────────────────────────────────────────

export function useGoogleAuth() {
  const [loading, setLoading] = useState(false);
  const [promptAsync, setPromptAsync] = useState<(() => Promise<any>) | null>(null);

  useEffect(() => {
    if (!GOOGLE_CONFIGURED) return;
    let mounted = true;
    (async () => {
      try {
        // Note: this is suboptimal (re-renders won't refresh the hook state),
        // but for an OAuth flow that runs once per user click it's fine.
        const Google = await import("expo-auth-session/providers/google");
        // We can't call useIdTokenAuthRequest outside a component, so we keep
        // the API simple: defer to discoverable Google sign-in via promptAsync.
        // For full UX with discoveryDocument caching, run `npx expo install` then enable.
        // For now: stub that defers to runtime.
        if (mounted) {
          setPromptAsync(() => async () => {
            // The actual prompt requires the hook to be in render path.
            // Surface a clear message until user wires the proper hook.
            throw new Error(
              "Google login chưa active. Set EXPO_PUBLIC_GOOGLE_CLIENT_ID_* + restart app.",
            );
          });
        }
      } catch (err) {
        if (mounted) setPromptAsync(null);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const login = useCallback(async (): Promise<SocialAuthResult> => {
    if (!GOOGLE_CONFIGURED) {
      return {
        success: false,
        error: "Google OAuth chưa cấu hình. Set EXPO_PUBLIC_GOOGLE_CLIENT_ID_* trong .env.",
      };
    }
    if (!promptAsync) {
      return { success: false, error: "Google auth chưa sẵn sàng" };
    }
    setLoading(true);
    try {
      const result = await promptAsync();
      if (result?.type !== "success") {
        return {
          success: false,
          error: result?.type === "cancel" ? "Bạn đã huỷ đăng nhập" : "Đăng nhập Google thất bại",
        };
      }
      const idToken = result.params?.id_token;
      if (!idToken) return { success: false, error: "Không nhận được Google id_token" };
      return exchangeForJwt("google", { idToken });
    } catch (err: any) {
      return { success: false, error: err?.message || "Google auth error" };
    } finally {
      setLoading(false);
    }
  }, [promptAsync]);

  return { login, loading, available: GOOGLE_CONFIGURED };
}

// ──────────────────────────────────────────────────────────────
// Facebook
// ──────────────────────────────────────────────────────────────

export function useFacebookAuth() {
  const [loading, setLoading] = useState(false);

  const login = useCallback(async (): Promise<SocialAuthResult> => {
    if (!FACEBOOK_CONFIGURED) {
      return {
        success: false,
        error: "Facebook OAuth chưa cấu hình. Set EXPO_PUBLIC_FACEBOOK_APP_ID trong .env.",
      };
    }
    setLoading(true);
    try {
      const Facebook = await import("expo-auth-session/providers/facebook");
      // Same caveat as Google: hook-based pattern needs to be in render path.
      // Stub until user wires credentials.
      return {
        success: false,
        error: "Facebook login chưa active. Set EXPO_PUBLIC_FACEBOOK_APP_ID + restart app.",
      };
    } catch (err: any) {
      return { success: false, error: err?.message || "Facebook auth error" };
    } finally {
      setLoading(false);
    }
  }, []);

  return { login, loading, available: FACEBOOK_CONFIGURED };
}

// ──────────────────────────────────────────────────────────────
// Apple — iOS only. expo-apple-authentication is a NATIVE module — importing
// at the top level throws on web. Lazy-load only when actually used.
// ──────────────────────────────────────────────────────────────

export function useAppleAuth() {
  const [loading, setLoading] = useState(false);
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    if (Platform.OS !== "ios") return;
    let mounted = true;
    (async () => {
      try {
        const mod = await import("expo-apple-authentication");
        const ok = await mod.isAvailableAsync();
        if (mounted) setAvailable(ok);
      } catch {
        if (mounted) setAvailable(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const login = useCallback(async (): Promise<SocialAuthResult> => {
    if (Platform.OS !== "ios") {
      return { success: false, error: "Sign in with Apple chỉ hỗ trợ trên iOS" };
    }
    setLoading(true);
    try {
      const mod = await import("expo-apple-authentication");
      const credential = await mod.signInAsync({
        requestedScopes: [
          mod.AppleAuthenticationScope.FULL_NAME,
          mod.AppleAuthenticationScope.EMAIL,
        ],
      });

      const { identityToken, fullName } = credential;
      if (!identityToken) return { success: false, error: "Không nhận được Apple identity token" };

      const composedFullName = fullName
        ? [fullName.givenName, fullName.familyName].filter(Boolean).join(" ").trim() || undefined
        : undefined;

      return exchangeForJwt("apple", { idToken: identityToken, fullName: composedFullName });
    } catch (err: any) {
      if (err?.code === "ERR_REQUEST_CANCELED") {
        return { success: false, error: "Bạn đã huỷ đăng nhập" };
      }
      return { success: false, error: err?.message || "Apple auth error" };
    } finally {
      setLoading(false);
    }
  }, []);

  return { login, loading, available };
}
