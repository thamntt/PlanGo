import React, { createContext, useContext, useState, useEffect, useMemo, ReactNode } from "react";
import {
  getCurrentUser,
  setCurrentUser,
  getUsers,
  saveUsers,
  generateId,
  type UserData,
} from "@/lib/storage";
import { SEED_ADMIN } from "@/lib/seed-data";

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

  const loadUser = async () => {
    const saved = await getCurrentUser();
    if (saved) {
      const users = await getUsers();
      const fresh = users.find((u) => u.id === saved.id);
      if (fresh && !fresh.isLocked) {
        setUser(fresh);
        await setCurrentUser(fresh);
      } else {
        setUser(null);
        await setCurrentUser(null);
      }
    }
    setIsLoading(false);
  };

  useEffect(() => {
    initializeAndLoad();
  }, []);

  const initializeAndLoad = async () => {
    const users = await getUsers();
    if (users.length === 0) {
      const adminUser: UserData = {
        id: generateId(),
        username: SEED_ADMIN.username,
        password: SEED_ADMIN.password,
        email: SEED_ADMIN.email,
        fullName: SEED_ADMIN.fullName,
        phone: "",
        avatar: "",
        role: "admin",
        isLocked: false,
        preferences: [],
        createdAt: new Date().toISOString(),
      };
      await saveUsers([adminUser]);
    }
    await loadUser();
  };

  const login = async (username: string, password: string) => {
    const users = await getUsers();
    const found = users.find((u) => u.username === username && u.password === password);
    if (!found) return { success: false, error: "Invalid username or password" };
    if (found.isLocked) return { success: false, error: "Account is locked" };
    setUser(found);
    await setCurrentUser(found);
    return { success: true };
  };

  const register = async (data: { username: string; password: string; email: string; fullName: string }) => {
    const users = await getUsers();
    if (users.find((u) => u.username === data.username)) {
      return { success: false, error: "Username already exists" };
    }
    const newUser: UserData = {
      id: generateId(),
      username: data.username,
      password: data.password,
      email: data.email,
      fullName: data.fullName,
      phone: "",
      avatar: "",
      role: "user",
      isLocked: false,
      preferences: [],
      createdAt: new Date().toISOString(),
    };
    users.push(newUser);
    await saveUsers(users);
    setUser(newUser);
    await setCurrentUser(newUser);
    return { success: true };
  };

  const logout = async () => {
    setUser(null);
    await setCurrentUser(null);
  };

  const updateProfile = async (data: Partial<UserData>) => {
    if (!user) return;
    const users = await getUsers();
    const idx = users.findIndex((u) => u.id === user.id);
    if (idx === -1) return;
    const updated = { ...users[idx], ...data };
    users[idx] = updated;
    await saveUsers(users);
    setUser(updated);
    await setCurrentUser(updated);
  };

  const changePassword = async (currentPassword: string, newPassword: string) => {
    if (!user) return { success: false, error: "Not logged in" };
    const users = await getUsers();
    const idx = users.findIndex((u) => u.id === user.id);
    if (idx === -1) return { success: false, error: "User not found" };
    if (users[idx].password !== currentPassword) {
      return { success: false, error: "Wrong current password" };
    }
    users[idx].password = newPassword;
    await saveUsers(users);
    setUser(users[idx]);
    await setCurrentUser(users[idx]);
    return { success: true };
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
