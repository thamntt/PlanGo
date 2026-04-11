import React, { createContext, useContext, useState, useEffect, useMemo, ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { apiRequest } from "@/lib/query-client";
import { SEED_ADMIN } from "@/lib/seed-data";

// Keep UserData type compatible with server schema
export interface UserData {
  id: string;
  username: string;
  password: string;
  email: string;
  fullName: string;
  avatar: string;
  role: "user" | "admin";
  isLocked: boolean;
  preferences: string[];
  createdAt: string;
}

const CURRENT_USER_KEY = "@plango_current_user";

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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Map server response to UserData shape
  const mapUser = (u: any): UserData => {
    if (!u) return {} as UserData;
    return {
      id: (u.userId || u.id)?.toString() || "",
      username: u.userName || u.username || "",
      password: u.password || "",
      email: u.email || "",
      fullName: u.fullName || u.full_name || u.userName || "",
      avatar: u.avatar || "",
      role: u.role || "user",
      isLocked: u.status === "locked" || u.status === "banned" || u.isLocked || u.is_locked || false,
      preferences: u.preferences || [],
      createdAt: u.createdAt || u.created_at || new Date().toISOString(),
    };
  };

  const loadUser = async () => {
    try {
      const raw = await AsyncStorage.getItem(CURRENT_USER_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as UserData;
        // Re-fetch from server to get latest data
        try {
          const res = await apiRequest("GET", `/api/users/${saved.id}`);
          const json = await res.json();
          const fresh = mapUser(json);
          if (!fresh.isLocked) {
            setUser(fresh);
            await AsyncStorage.setItem(CURRENT_USER_KEY, JSON.stringify(fresh));
          } else {
            setUser(null);
            await AsyncStorage.removeItem(CURRENT_USER_KEY);
          }
        } catch {
          // Server unreachable, use cached data
          if (!saved.isLocked) {
            setUser(saved);
          }
        }
      }
    } catch {
      // ignore
    }
    setIsLoading(false);
  };

  useEffect(() => {
    initializeAndLoad();
  }, []);

  const initializeAndLoad = async () => {
    // Seed admin user if none exists
    try {
      const res = await apiRequest("GET", "/api/users");
      const userList = await res.json();
      if (Array.isArray(userList) && userList.length === 0) {
        await apiRequest("POST", "/api/auth/register", {
          userName: SEED_ADMIN.username, // Using userName to be explicit
          username: SEED_ADMIN.username,
          password: SEED_ADMIN.password,
          email: SEED_ADMIN.email,
          fullName: SEED_ADMIN.fullName,
        });
        // Set role to admin
        const loginRes = await apiRequest("POST", "/api/auth/login", {
          username: SEED_ADMIN.username,
          password: SEED_ADMIN.password,
        });
        const loginJson = await loginRes.json();
        const adminUser = mapUser(loginJson);
        await apiRequest("PUT", `/api/users/${adminUser.id}`, { role: "admin" });
      }
    } catch (err) {
      console.log("Seed error:", err);
    }
    await loadUser();
  };

  const login = async (username: string, password: string) => {
    try {
      const res = await apiRequest("POST", "/api/auth/login", { username, password });
      const json = await res.json();
      const found = mapUser(json);
      setUser(found);
      await AsyncStorage.setItem(CURRENT_USER_KEY, JSON.stringify(found));
      return { success: true };
    } catch (err: any) {
      const msg = err.message || "Login failed";
      if (msg.includes("401")) return { success: false, error: "Sai tên đăng nhập hoặc mật khẩu" };
      if (msg.includes("403")) return { success: false, error: "Tài khoản đã bị khóa" };
      return { success: false, error: msg };
    }
  };

  const register = async (data: { username: string; password: string; email: string; fullName: string }) => {
    try {
      const res = await apiRequest("POST", "/api/auth/register", data);
      const json = await res.json();
      const newUser = mapUser(json);
      setUser(newUser);
      await AsyncStorage.setItem(CURRENT_USER_KEY, JSON.stringify(newUser));
      return { success: true };
    } catch (err: any) {
      const msg = err.message || "Register failed";
      if (msg.includes("409")) return { success: false, error: "Tên đăng nhập đã tồn tại" };
      return { success: false, error: msg };
    }
  };

  const logout = async () => {
    setUser(null);
    await AsyncStorage.removeItem(CURRENT_USER_KEY);
  };

  const updateProfile = async (data: Partial<UserData>) => {
    if (!user) return;
    try {
      const res = await apiRequest("PUT", `/api/users/${user.id}`, data);
      const json = await res.json();
      const updated = mapUser(json);
      setUser(updated);
      await AsyncStorage.setItem(CURRENT_USER_KEY, JSON.stringify(updated));
    } catch {
      // ignore
    }
  };

  const changePassword = async (currentPassword: string, newPassword: string) => {
    if (!user) return { success: false, error: "Not logged in" };
    if (user.password !== currentPassword) {
      return { success: false, error: "Mật khẩu hiện tại không đúng" };
    }
    try {
      const res = await apiRequest("PUT", `/api/users/${user.id}`, { password: newPassword });
      const json = await res.json();
      const updated = mapUser(json);
      setUser(updated);
      await AsyncStorage.setItem(CURRENT_USER_KEY, JSON.stringify(updated));
      return { success: true };
    } catch {
      return { success: false, error: "Failed to change password" };
    }
  };

  const refreshUser = async () => {
    await loadUser();
  };

  const value = useMemo(
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
    [user, isLoading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
