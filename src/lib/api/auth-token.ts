import AsyncStorage from "@react-native-async-storage/async-storage";

const TOKEN_KEY = "@plango_jwt_token";

let inMemoryToken: string | null = null;
let initialLoad: Promise<void> | null = null;

/**
 * In-memory + AsyncStorage-backed JWT token. `query-client` reads via `getToken()`
 * synchronously on every request (after initial load). `setToken` persists, `clearToken`
 * removes both.
 */
export function getToken(): string | null {
  return inMemoryToken;
}

export async function setToken(token: string | null): Promise<void> {
  inMemoryToken = token;
  if (token) {
    await AsyncStorage.setItem(TOKEN_KEY, token);
  } else {
    await AsyncStorage.removeItem(TOKEN_KEY);
  }
}

export async function clearToken(): Promise<void> {
  await setToken(null);
}

/** Load the persisted token into memory. Called once at app boot. */
export function loadToken(): Promise<void> {
  if (initialLoad) return initialLoad;
  initialLoad = (async () => {
    try {
      const stored = await AsyncStorage.getItem(TOKEN_KEY);
      inMemoryToken = stored;
    } catch {
      inMemoryToken = null;
    }
  })();
  return initialLoad;
}

// ── Unauthorized hook (called by query-client when server returns 401) ──

type UnauthorizedListener = () => void;
const listeners = new Set<UnauthorizedListener>();

export function onUnauthorized(listener: UnauthorizedListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function notifyUnauthorized(): void {
  listeners.forEach((l) => {
    try {
      l();
    } catch {
      /* listener errors shouldn't break request flow */
    }
  });
}
