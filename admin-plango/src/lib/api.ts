import axios from 'axios';

// Since we have Vite proxy configured, we can just hit /api directly
export const api = axios.create({
  baseURL: '/', // Resolves to /api/ via proxy if we use API paths
  headers: {
    'Content-Type': 'application/json',
    'Bypass-Tunnel-Reminder': 'true'
  },
  withCredentials: true,
});

// Response interceptor to just return the data property if the standard format is used
api.interceptors.response.use(
  (response) => {
    const json = response.data;
    if (json && typeof json === 'object' && 'status' in json && 'data' in json) {
      return json.data;
    }
    return json;
  },
  (error) => {
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
