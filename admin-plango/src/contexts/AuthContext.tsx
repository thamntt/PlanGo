import { createContext, useContext, useState, useCallback, useEffect } from "react";
import type { ReactNode } from "react";
import { apiRequest, getToken, setToken, onUnauthorized } from "../lib/api";

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
const USER_KEY = "plango_admin_user";

function mapAdmin(res: any): AdminUser {
  return {
    id: (res.userId || res.id)?.toString() ?? "",
    userName: res.userName || res.username || "",
    email: res.email || "",
    role: res.role,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [adminUser, setAdminUser] = useState<AdminUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const logout = useCallback(() => {
    setAdminUser(null);
    setToken(null);
    localStorage.removeItem(USER_KEY);
  }, []);

  // Restore session: if we have a token AND cached user with admin role, trust it.
  // (We don't currently have an /api/admin/me check; rely on the token for actual API auth.)
  useEffect(() => {
    const unsubscribe = onUnauthorized(() => {
      logout();
    });
    try {
      const token = getToken();
      const stored = localStorage.getItem(USER_KEY);
      if (token && stored) {
        const parsed = JSON.parse(stored);
        if (parsed?.role === "admin") setAdminUser(parsed);
      }
    } catch {
      localStorage.removeItem(USER_KEY);
    }
    setIsLoading(false);
    return unsubscribe;
  }, [logout]);

  const login = useCallback(async (email: string, password: string) => {
    const res = await apiRequest("POST", "/api/auth/login", { email, password });

    if (res?.role !== "admin") {
      throw new Error("Tài khoản không có quyền quản trị");
    }
    if (!res?.token) {
      throw new Error("Server không trả về token");
    }

    const user = mapAdmin(res);
    setToken(res.token);
    setAdminUser(user);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
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
