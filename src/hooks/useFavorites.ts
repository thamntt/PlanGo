/**
 * Favorites/wishlist storage — MVP uses AsyncStorage (per-device).
 * Phase 2: move to backend table `user_favorites (userId, destinationId, createdAt)`
 * with API endpoints + sync across devices.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { Platform } from "react-native";

const STORAGE_KEY = "plango.favorites.v1";
const QUERY_KEY = ["favorites"] as const;

async function readFavorites(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeFavorites(ids: string[]) {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
}

export function useFavorites() {
  const qc = useQueryClient();

  const { data: favorites = [] } = useQuery<string[]>({
    queryKey: QUERY_KEY,
    queryFn: readFavorites,
    staleTime: Infinity,
    gcTime: Infinity,
  });

  const toggleMutation = useMutation({
    mutationFn: async (destinationId: string) => {
      const current = await readFavorites();
      const next = current.includes(destinationId)
        ? current.filter((id) => id !== destinationId)
        : [...current, destinationId];
      await writeFavorites(next);
      return { next, wasAdded: !current.includes(destinationId) };
    },
    onSuccess: ({ next, wasAdded }) => {
      qc.setQueryData(QUERY_KEY, next);
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(
          wasAdded
            ? Haptics.NotificationFeedbackType.Success
            : Haptics.NotificationFeedbackType.Warning,
        );
      }
    },
  });

  return {
    favorites,
    favoritesCount: favorites.length,
    isFavorite: (destinationId: string) => favorites.includes(destinationId),
    toggleFavorite: (destinationId: string) => toggleMutation.mutate(destinationId),
    isToggling: toggleMutation.isPending,
  };
}
