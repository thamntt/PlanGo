import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { getToken, loadToken, notifyUnauthorized } from "./auth-token";

// ══════════════════════════════════════════════════════════════
// Base URL + headers
// ══════════════════════════════════════════════════════════════

/**
 * Gets the base URL for the Express API server (e.g., "http://192.168.1.20:5001")
 */
export function getApiUrl(): string {
  let host = process.env.EXPO_PUBLIC_DOMAIN;
  if (!host) throw new Error("EXPO_PUBLIC_DOMAIN is not set");

  host = host.replace(/^https?:\/\//, "");
  const isLocal =
    host.startsWith("localhost") ||
    host.startsWith("127.0.0.1") ||
    host.startsWith("10.") ||
    host.startsWith("192.168.") ||
    host.startsWith("172.");
  const protocol = isLocal ? "http" : "https";
  return new URL(`${protocol}://${host}`).href;
}

/** Common headers for every API request: tunnel-bypass + JWT auth (if logged in). */
export function getApiHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    "Bypass-Tunnel-Reminder": "true",
  };
  const token = getToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return headers;
}

console.log("[API] Base URL:", getApiUrl());

// ══════════════════════════════════════════════════════════════
// Request helpers
// ══════════════════════════════════════════════════════════════

async function handleResponseStatus(res: Response): Promise<void> {
  if (res.status === 401) {
    notifyUnauthorized();
  }
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(method: string, route: string, data?: unknown): Promise<Response> {
  // Block first-request races on app boot: the JWT lives in AsyncStorage and
  // takes a tick to hydrate into memory. Without this every request fired
  // during boot would go out token-less and get 401-ed.
  await loadToken();
  const baseUrl = getApiUrl();
  const url = new URL(route, baseUrl);
  const res = await fetch(url.toString(), {
    method,
    headers: {
      ...getApiHeaders(),
      ...(data ? { "Content-Type": "application/json" } : {}),
    },
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });
  await handleResponseStatus(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: { on401: UnauthorizedBehavior }) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    await loadToken();
    const baseUrl = getApiUrl();
    const url = new URL(queryKey.join("/") as string, baseUrl);
    const res = await fetch(url.toString(), {
      headers: getApiHeaders(),
      credentials: "include",
    });
    if (res.status === 401) {
      notifyUnauthorized();
      if (unauthorizedBehavior === "returnNull") return null;
    }
    await handleResponseStatus(res);
    const json = await res.json();
    if (
      json &&
      typeof json === "object" &&
      "status" in json &&
      "message" in json &&
      "data" in json
    ) {
      return json.data;
    }
    return json;
  };

// IG/FB/Threads pattern: show cached data instantly on re-navigation, refresh in
// background. Defaults below keep data in memory for 30 min and consider it fresh
// for 2 min — long enough that bouncing between tabs feels instant.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      refetchOnMount: false,
      staleTime: 2 * 60 * 1000,
      gcTime: 30 * 60 * 1000,
      retry: 1,
      retryDelay: (attempt) => Math.min(800 * 2 ** attempt, 4000),
    },
    mutations: {
      retry: false,
    },
  },
});
