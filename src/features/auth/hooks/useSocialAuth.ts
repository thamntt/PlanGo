import { useCallback, useState } from "react";
import { Platform } from "react-native";
import * as WebBrowser from "expo-web-browser";
import * as Google from "expo-auth-session/providers/google";
import * as Facebook from "expo-auth-session/providers/facebook";
import * as AppleAuthentication from "expo-apple-authentication";
import { apiRequest } from "@/lib/api/query-client";
import { setToken } from "@/lib/api/auth-token";

WebBrowser.maybeCompleteAuthSession();

const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_WEB;
const GOOGLE_IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_IOS;
const GOOGLE_ANDROID_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_ANDROID;
const FACEBOOK_APP_ID = process.env.EXPO_PUBLIC_FACEBOOK_APP_ID;

/**
 * Exchanges a provider's token for our JWT via BE's social-auth endpoint.
 * BE validates the provider token, finds/creates user, returns JWT + user object.
 */
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
    const res = await apiRequest("POST", "/api/auth/social", {
      provider,
      ...payload,
    });
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
// ──────────────────────────────────────────────────────────────

export function useGoogleAuth() {
  const [_, response, promptAsync] = Google.useIdTokenAuthRequest({
    webClientId: GOOGLE_WEB_CLIENT_ID,
    iosClientId: GOOGLE_IOS_CLIENT_ID,
    androidClientId: GOOGLE_ANDROID_CLIENT_ID,
  });
  const [loading, setLoading] = useState(false);

  const login = useCallback(async (): Promise<SocialAuthResult> => {
    if (!GOOGLE_WEB_CLIENT_ID && !GOOGLE_IOS_CLIENT_ID && !GOOGLE_ANDROID_CLIENT_ID) {
      return {
        success: false,
        error: "Google OAuth chưa cấu hình. Set EXPO_PUBLIC_GOOGLE_CLIENT_ID_* trong .env.",
      };
    }
    setLoading(true);
    try {
      const result = await promptAsync();
      if (result.type !== "success") {
        return {
          success: false,
          error: result.type === "cancel" ? "Bạn đã huỷ đăng nhập" : "Đăng nhập Google thất bại",
        };
      }
      const idToken = result.params.id_token;
      if (!idToken) return { success: false, error: "Không nhận được Google id_token" };
      return exchangeForJwt("google", { idToken });
    } catch (err: any) {
      return { success: false, error: err?.message || "Google auth error" };
    } finally {
      setLoading(false);
    }
  }, [promptAsync]);

  return { login, loading, response };
}

// ──────────────────────────────────────────────────────────────
// Facebook
// ──────────────────────────────────────────────────────────────

export function useFacebookAuth() {
  const [_, response, promptAsync] = Facebook.useAuthRequest({
    clientId: FACEBOOK_APP_ID ?? "",
    scopes: ["public_profile", "email"],
  });
  const [loading, setLoading] = useState(false);

  const login = useCallback(async (): Promise<SocialAuthResult> => {
    if (!FACEBOOK_APP_ID) {
      return {
        success: false,
        error: "Facebook OAuth chưa cấu hình. Set EXPO_PUBLIC_FACEBOOK_APP_ID trong .env.",
      };
    }
    setLoading(true);
    try {
      const result = await promptAsync();
      if (result.type !== "success") {
        return {
          success: false,
          error: result.type === "cancel" ? "Bạn đã huỷ đăng nhập" : "Đăng nhập Facebook thất bại",
        };
      }
      const accessToken = result.params.access_token;
      if (!accessToken) return { success: false, error: "Không nhận được Facebook access_token" };
      return exchangeForJwt("facebook", { accessToken });
    } catch (err: any) {
      return { success: false, error: err?.message || "Facebook auth error" };
    } finally {
      setLoading(false);
    }
  }, [promptAsync]);

  return { login, loading, response };
}

// ──────────────────────────────────────────────────────────────
// Apple — iOS only (native flow)
// ──────────────────────────────────────────────────────────────

export function useAppleAuth() {
  const [loading, setLoading] = useState(false);

  const login = useCallback(async (): Promise<SocialAuthResult> => {
    if (Platform.OS !== "ios") {
      return { success: false, error: "Sign in with Apple chỉ hỗ trợ trên iOS" };
    }
    setLoading(true);
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      const { identityToken, fullName } = credential;
      if (!identityToken) return { success: false, error: "Không nhận được Apple identity token" };

      const composedFullName = fullName
        ? [fullName.givenName, fullName.familyName].filter(Boolean).join(" ").trim() || undefined
        : undefined;

      return exchangeForJwt("apple", { idToken: identityToken, fullName: composedFullName });
    } catch (err: any) {
      if (err.code === "ERR_REQUEST_CANCELED") {
        return { success: false, error: "Bạn đã huỷ đăng nhập" };
      }
      return { success: false, error: err?.message || "Apple auth error" };
    } finally {
      setLoading(false);
    }
  }, []);

  // Detect availability (only iOS 13+, real device or simulator)
  const [available, setAvailable] = useState(false);
  if (Platform.OS === "ios") {
    AppleAuthentication.isAvailableAsync()
      .then(setAvailable)
      .catch(() => setAvailable(false));
  }

  return { login, loading, available };
}
