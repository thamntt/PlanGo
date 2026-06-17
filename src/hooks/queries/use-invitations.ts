import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api/query-client";
import type { TripInvitation } from "@/types";

async function unwrap<T>(res: Response): Promise<T> {
  const json = await res.json();
  if (json && typeof json === "object" && "data" in json && "status" in json)
    return json.data as T;
  return json as T;
}

function mapInvitation(i: any): TripInvitation {
  return {
    id: String(i.invitationId ?? i.id ?? ""),
    tripId: String(i.tripId ?? ""),
    inviterUserId: String(i.inviterUserId ?? ""),
    inviteeUserId: String(i.inviteeUserId ?? ""),
    role: (i.role as "viewer" | "editor") ?? "viewer",
    status: (i.status as TripInvitation["status"]) ?? "pending",
    message: i.message ?? null,
    createdAt: i.createdAt ?? new Date().toISOString(),
    respondedAt: i.respondedAt ?? null,
    tripTitle: i.tripTitle ?? null,
    tripStartDate: i.tripStartDate ?? null,
    tripEndDate: i.tripEndDate ?? null,
    tripStatus: i.tripStatus ?? null,
    tripInvitationToken: i.tripInvitationToken ?? null,
    inviterName: i.inviterName ?? null,
    inviterUserName: i.inviterUserName ?? null,
    inviterAvatarUrl: i.inviterAvatarUrl ?? null,
    inviteeName: i.inviteeName ?? null,
    inviteeUserName: i.inviteeUserName ?? null,
    inviteeAvatarUrl: i.inviteeAvatarUrl ?? null,
  };
}

const receivedKey = ["invitations", "received"] as const;
const sentKey = (tripId?: string | number) =>
  ["invitations", "sent", tripId ? String(tripId) : "all"] as const;

export function useReceivedInvitations() {
  return useQuery<TripInvitation[]>({
    queryKey: receivedKey,
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/invitations/received");
      const data = await unwrap<any[]>(res);
      return (data ?? []).map(mapInvitation);
    },
    staleTime: 30_000,
    refetchOnWindowFocus: "always",
  });
}

export function useSentInvitations(tripId?: string | number) {
  return useQuery<TripInvitation[]>({
    queryKey: sentKey(tripId),
    queryFn: async () => {
      const url = tripId
        ? `/api/invitations/sent?tripId=${tripId}`
        : "/api/invitations/sent";
      const res = await apiRequest("GET", url);
      const data = await unwrap<any[]>(res);
      return (data ?? []).map(mapInvitation);
    },
    staleTime: 30_000,
    refetchOnWindowFocus: "always",
  });
}

export function useSendInvitation(tripId: string | number) {
  const qc = useQueryClient();
  return useMutation<
    { alreadyMember?: boolean; alreadySent?: boolean; invitation?: TripInvitation | null },
    Error,
    { inviteeUserId: string | number; role?: "viewer" | "editor"; message?: string | null }
  >({
    mutationFn: async ({ inviteeUserId, role, message }) => {
      const res = await apiRequest("POST", `/api/trips/${tripId}/invitations`, {
        inviteeUserId: Number(inviteeUserId),
        role: role || "viewer",
        message: message ?? null,
      });
      const data = await unwrap<any>(res);
      return {
        alreadyMember: !!data?.alreadyMember,
        alreadySent: !!data?.alreadySent,
        invitation: data?.invitation ? mapInvitation(data.invitation) : null,
      };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: sentKey(tripId) });
      qc.invalidateQueries({ queryKey: sentKey() });
    },
  });
}

export function useAcceptInvitation() {
  const qc = useQueryClient();
  return useMutation<TripInvitation, Error, string | number>({
    mutationFn: async (id) => {
      const res = await apiRequest("POST", `/api/invitations/${id}/accept`);
      const data = await unwrap<any>(res);
      return mapInvitation(data);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: receivedKey });
      qc.invalidateQueries({ queryKey: ["trips"] });
    },
  });
}

export function useDeclineInvitation() {
  const qc = useQueryClient();
  return useMutation<TripInvitation, Error, string | number>({
    mutationFn: async (id) => {
      const res = await apiRequest("POST", `/api/invitations/${id}/decline`);
      const data = await unwrap<any>(res);
      return mapInvitation(data);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: receivedKey }),
  });
}

export function useCancelInvitation(tripId?: string | number) {
  const qc = useQueryClient();
  return useMutation<void, Error, string | number>({
    mutationFn: async (id) => {
      await apiRequest("DELETE", `/api/invitations/${id}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: sentKey(tripId) });
      qc.invalidateQueries({ queryKey: sentKey() });
    },
  });
}
