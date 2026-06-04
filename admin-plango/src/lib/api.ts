import axios from "axios";

// ── Global loading indicator ──
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

// ── JWT token store (localStorage-backed) ──
const TOKEN_KEY = "plango_admin_jwt";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}
export function setToken(token: string | null): void {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

// ── Global unauthorized hook ──
type UnauthorizedListener = () => void;
const unauthorizedListeners = new Set<UnauthorizedListener>();
export function onUnauthorized(listener: UnauthorizedListener): () => void {
  unauthorizedListeners.add(listener);
  return () => {
    unauthorizedListeners.delete(listener);
  };
}

// ── Axios instance ──
export const api = axios.create({
  baseURL: "/",
  headers: {
    "Content-Type": "application/json",
    "Bypass-Tunnel-Reminder": "true",
  },
  withCredentials: true,
});

api.interceptors.request.use(
  (config) => {
    activeRequests++;
    notifyListeners();
    const token = getToken();
    if (token) {
      config.headers = config.headers ?? {};
      config.headers["Authorization"] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

api.interceptors.response.use(
  (response) => {
    activeRequests = Math.max(0, activeRequests - 1);
    notifyListeners();

    const json = response.data;
    if (json && typeof json === "object" && "status" in json && "data" in json) {
      return json.data;
    }
    return json;
  },
  (error) => {
    activeRequests = Math.max(0, activeRequests - 1);
    notifyListeners();
    if (error?.response?.status === 401) {
      unauthorizedListeners.forEach((l) => {
        try {
          l();
        } catch {
          /* ignore */
        }
      });
    }
    return Promise.reject(error);
  },
);

export async function apiRequest(method: string, route: string, data?: unknown): Promise<any> {
  return api({ method, url: route, data });
}
