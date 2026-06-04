import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { getToken, notifyUnauthorized } from "./auth-token";

// ══════════════════════════════════════════════════════════════
// Global loading indicator
// ══════════════════════════════════════════════════════════════

type LoadingListener = (isLoading: boolean) => void;
const listeners = new Set<LoadingListener>();
let activeRequests = 0;

function notifyListeners() {
  const isLoading = activeRequests > 0;
  listeners.forEach((l) => l(isLoading));
}

export const subscribeToLoading = (l: LoadingListener) => {
  listeners.add(l);
  l(activeRequests > 0);
  return () => {
    listeners.delete(l);
  };
};

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
  activeRequests++;
  notifyListeners();

  try {
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
  } finally {
    activeRequests = Math.max(0, activeRequests - 1);
    notifyListeners();
  }
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: { on401: UnauthorizedBehavior }) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    activeRequests++;
    notifyListeners();

    try {
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
    } finally {
      activeRequests = Math.max(0, activeRequests - 1);
      notifyListeners();
    }
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
