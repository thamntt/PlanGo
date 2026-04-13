import axios from 'axios';

// Simple event system for global loading state
type LoadingListener = (isLoading: boolean) => void;
const listeners = new Set<LoadingListener>();
let activeRequests = 0;

function notifyListeners() {
  const isLoading = activeRequests > 0;
  listeners.forEach(l => l(isLoading));
}

export const subscribeToLoading = (l: LoadingListener) => {
  listeners.add(l);
  l(activeRequests > 0);
  return () => listeners.delete(l);
};

// Since we have Vite proxy configured, we can just hit /api directly
export const api = axios.create({
  baseURL: '/', // Resolves to /api/ via proxy if we use API paths
  headers: {
    'Content-Type': 'application/json',
    'Bypass-Tunnel-Reminder': 'true'
  },
  withCredentials: true,
});

// Request interceptor to track start of request
api.interceptors.request.use(
  (config) => {
    activeRequests++;
    notifyListeners();
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to track end of request
api.interceptors.response.use(
  (response) => {
    activeRequests = Math.max(0, activeRequests - 1);
    notifyListeners();
    
    const json = response.data;
    if (json && typeof json === 'object' && 'status' in json && 'data' in json) {
      return json.data;
    }
    return json;
  },
  (error) => {
    activeRequests = Math.max(0, activeRequests - 1);
    notifyListeners();
    return Promise.reject(error);
  }
);

// We define a helper that mimics apiRequest from mobile to easily drop in
export async function apiRequest(method: string, route: string, data?: unknown): Promise<any> {
    const res = await api({
        method,
        url: route,
        data,
    });
    return res;
}
