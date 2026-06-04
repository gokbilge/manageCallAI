import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError, apiRequest } from '@/lib/api/client';
import { useAuth } from '@/lib/auth/use-auth';

export type ParkingLot = {
  id: string;
  tenant_id: string;
  name: string;
  slot_range_start: number;
  slot_range_end: number;
  timeout_seconds: number;
  created_at: string;
  updated_at: string;
};

export type ParkedCallStatus = 'parked' | 'retrieved' | 'timed_out';

export type ParkedCall = {
  id: string;
  tenant_id: string;
  parking_lot_id: string;
  slot: number;
  call_id: string;
  parked_by: string | null;
  status: ParkedCallStatus;
  parked_at: string;
  timeout_at: string | null;
  retrieved_at: string | null;
  created_at: string;
  updated_at: string;
};

export type CreateParkingLotBody = {
  name: string;
  slot_range_start: number;
  slot_range_end: number;
  timeout_seconds: number;
};

export type UpdateParkingLotBody = Partial<CreateParkingLotBody>;

function noRetryOnAuth(failureCount: number, error: unknown): boolean {
  if (error instanceof ApiError && (error.status === 401 || error.status === 403)) return false;
  return failureCount < 1;
}

export function useParkingLots() {
  const { session } = useAuth();
  return useQuery({
    queryKey: ['parking-lots'],
    queryFn: async () => {
      const r = await apiRequest<{ data: ParkingLot[] }>('/parking-lots', { accessToken: session?.token });
      return r.data;
    },
    enabled: Boolean(session?.token),
    retry: noRetryOnAuth,
  });
}

export function useParkedCalls(lotId: string, enabled = true) {
  const { session } = useAuth();
  return useQuery({
    queryKey: ['parking-lots', lotId, 'parked-calls'],
    queryFn: async () => {
      const r = await apiRequest<{ data: ParkedCall[] }>(
        `/parking-lots/${lotId}/parked-calls`,
        { accessToken: session?.token },
      );
      return r.data;
    },
    enabled: Boolean(session?.token && lotId && enabled),
    retry: noRetryOnAuth,
    refetchInterval: 10_000,
  });
}

export function useCreateParkingLot() {
  const { session } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: CreateParkingLotBody) => {
      const r = await apiRequest<{ data: ParkingLot }>('/parking-lots', {
        method: 'POST',
        body: JSON.stringify(body),
        accessToken: session?.token,
      });
      return r.data;
    },
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['parking-lots'] }); },
  });
}

export function useUpdateParkingLot() {
  const { session } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, body }: { id: string; body: UpdateParkingLotBody }) => {
      const r = await apiRequest<{ data: ParkingLot }>(`/parking-lots/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
        accessToken: session?.token,
      });
      return r.data;
    },
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['parking-lots'] }); },
  });
}

export function useDeleteParkingLot() {
  const { session } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiRequest<void>(`/parking-lots/${id}`, {
        method: 'DELETE',
        accessToken: session?.token,
      });
    },
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['parking-lots'] }); },
  });
}
