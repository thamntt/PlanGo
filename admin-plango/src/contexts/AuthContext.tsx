import { createContext, useContext, useState, useCallback, useEffect } from "react";
import type { ReactNode } from "react";
import { apiRequest } from "../lib/api";

interface AdminUser {
  id: string;
  userName: string;
  email: string;
  role: string;
}

interface AuthContextValue {
  isAuthenticated: boolean;
  adminUser: AdminUser | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const AUTH_KEY = "plango_admin_auth";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [adminUser, setAdminUser] = useState<AdminUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Restore session from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(AUTH_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed?.role === "admin") {
          setAdminUser(parsed);
        }
      }
    } catch {
      localStorage.removeItem(AUTH_KEY);
    }
    setIsLoading(false);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await apiRequest("POST", "/api/auth/login", { email, password });
    
    // Check if the user has admin role
    if (res.role !== "admin") {
      throw new Error("Tài khoản không có quyền quản trị");
    }

    const user: AdminUser = {
      id: (res.userId || res.id)?.toString(),
      userName: res.userName || res.username || "",
      email: res.email || "",
      role: res.role,
    };

    setAdminUser(user);
    localStorage.setItem(AUTH_KEY, JSON.stringify(user));
  }, []);

  const logout = useCallback(() => {
    setAdminUser(null);
    localStorage.removeItem(AUTH_KEY);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated: !!adminUser,
        adminUser,
        isLoading,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
