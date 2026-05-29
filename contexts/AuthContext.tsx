import React, { createContext, useContext, useState, useEffect, useMemo, useCallback, ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { apiRequest } from "@/lib/query-client";
import { setToken, clearToken, loadToken, onUnauthorized, getToken } from "@/lib/auth-token";

// User data shape exposed to the app. Never includes the password.
export interface UserData {
  id: string;
  username: string;
  email: string;
  fullName: string;
  avatar: string;
  role: "user" | "admin";
  isLocked: boolean;
  preferences: string[];
  createdAt: string;
}

const CACHED_USER_KEY = "@plango_cached_user";

interface AuthContextValue {
  user: UserData | null;
  isLoading: boolean;
  isAdmin: boolean;
  login: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (data: { username: string; password: string; email: string; fullName: string }) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  updateProfile: (data: Partial<UserData>) => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<{ success: boolean; error?: string }>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function unwrapResponse(res: Response): Promise<any> {
  const json = await res.json();
  if (json && typeof json === "object" && "data" in json && "status" in json) return json.data;
  return json;
}

function mapUser(u: any): UserData {
  if (!u) return {} as UserData;
  return {
    id: (u.userId || u.id)?.toString() || "",
    username: u.userName || u.username || "",
    email: u.email || "",
    fullName: u.fullName || u.full_name || u.userName || "",
    avatar: u.avatar || "",
    role: u.role || "user",
    isLocked: u.status === "locked" || u.status === "banned" || u.isLocked || u.is_locked || false,
    preferences: u.preferences || [],
    createdAt: u.createdAt || u.created_at || new Date().toISOString(),
  };
}

function extractErrorMessage(err: any): { code?: string; message: string } {
  if (!err) return { message: "Unknown error" };
  const msg = err.message || String(err);
  // Try to parse "STATUS: {json...}" produced by query-client
  const match = msg.match(/^\d+:\s*(\{.*\})$/s);
  if (match) {
    try {
      const body = JSON.parse(match[1]);
      return { code: body.code, message: body.message || msg };
    } catch { /* fall through */ }
  }
  return { message: msg };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const persistUser = useCallback(async (u: UserData | null) => {
    setUser(u);
    if (u) await AsyncStorage.setItem(CACHED_USER_KEY, JSON.stringify(u));
    else await AsyncStorage.removeItem(CACHED_USER_KEY);
  }, []);

  const logout = useCallback(async () => {
    await clearToken();
    await persistUser(null);
  }, [persistUser]);

  const loadCurrentUser = useCallback(async () => {
    if (!getToken()) {
      await persistUser(null);
      return;
    }
    try {
      const res = await apiRequest("GET", "/api/users/me");
      const data = await unwrapResponse(res);
      const fresh = mapUser(data);
      // Block admin role on mobile (admin uses admin-plango web)
      if (fresh.isLocked || fresh.role === "admin") {
        await logout();
        return;
      }
      await persistUser(fresh);
    } catch (err: any) {
      // 401 already triggers global onUnauthorized which clears token; for other errors fall back to cache.
      const msg = err?.message || "";
      if (msg.startsWith("401")) {
        await logout();
        return;
      }
      const cached = await AsyncStorage.getItem(CACHED_USER_KEY);
      if (cached) {
        try { setUser(JSON.parse(cached) as UserData); } catch { /* ignore */ }
      }
    }
  }, [logout, persistUser]);

  // Boot: load token from storage, then fetch /me. Also subscribe to global 401 handler.
  useEffect(() => {
    const unsubscribe = onUnauthorized(() => {
      // Server says token is invalid — force logout. Wrap in microtask to avoid
      // calling React state setters synchronously during a request response.
      Promise.resolve().then(() => { void logout(); });
    });

    (async () => {
      await loadToken();
      await loadCurrentUser();
      setIsLoading(false);
    })();

    return unsubscribe;
  }, [loadCurrentUser, logout]);

  const login = useCallback(async (username: string, password: string) => {
    try {
      const res = await apiRequest("POST", "/api/auth/login", { username, password });
      const data = await unwrapResponse(res);
      if (!data?.token) return { success: false, error: "Server không trả về token" };

      await setToken(data.token);
      const found = mapUser(data);
      if (found.role === "admin") {
        await logout();
        return { success: false, error: "Tài khoản hoặc mật khẩu không đúng" };
      }
      await persistUser(found);
      return { success: true };
    } catch (err: any) {
      const { code, message } = extractErrorMessage(err);
      if (code === "INVALID_CREDENTIALS" || message.includes("401")) {
        return { success: false, error: "Sai tên đăng nhập hoặc mật khẩu" };
      }
      if (code === "ACCOUNT_LOCKED" || message.includes("403")) {
        return { success: false, error: "Tài khoản đã bị khóa" };
      }
      if (code === "RATE_LIMITED" || message.includes("429")) {
        return { success: false, error: "Đăng nhập quá nhiều lần. Thử lại sau ít phút." };
      }
      return { success: false, error: message };
    }
  }, [logout, persistUser]);

  const register = useCallback(async (data: { username: string; password: string; email: string; fullName: string }) => {
    try {
      const res = await apiRequest("POST", "/api/auth/register", data);
      const respData = await unwrapResponse(res);
      if (!respData?.token) return { success: false, error: "Server không trả về token" };

      await setToken(respData.token);
      await persistUser(mapUser(respData));
      return { success: true };
    } catch (err: any) {
      const { code, message } = extractErrorMessage(err);
      if (code === "EMAIL_ALREADY_EXISTS" || message.includes("409")) {
        return { success: false, error: "Email đã được sử dụng" };
      }
      return { success: false, error: message };
    }
  }, [persistUser]);

  const updateProfile = useCallback(async (data: Partial<UserData>) => {
    if (!user) return;
    try {
      const res = await apiRequest("PUT", `/api/users/${user.id}`, data);
      const respData = await unwrapResponse(res);
      await persistUser(mapUser(respData));
    } catch {
      /* swallow — leave previous user state */
    }
  }, [user, persistUser]);

  const changePassword = useCallback(async (currentPassword: string, newPassword: string) => {
    if (!user) return { success: false, error: "Chưa đăng nhập" };
    try {
      await apiRequest("POST", "/api/auth/change-password", { currentPassword, newPassword });
      return { success: true };
    } catch (err: any) {
      const { code, message } = extractErrorMessage(err);
      if (code === "INVALID_CREDENTIALS") {
        return { success: false, error: "Mật khẩu hiện tại không đúng" };
      }
      if (code === "VALIDATION_ERROR") {
        return { success: false, error: "Mật khẩu mới phải có ít nhất 6 ký tự" };
      }
      return { success: false, error: message };
    }
  }, [user]);

  const refreshUser = useCallback(async () => {
    await loadCurrentUser();
  }, [loadCurrentUser]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isLoading,
      isAdmin: user?.role === "admin",
      login,
      register,
      logout,
      updateProfile,
      changePassword,
      refreshUser,
    }),
    [user, isLoading, login, register, logout, updateProfile, changePassword, refreshUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
