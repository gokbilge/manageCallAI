import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError, apiRequest } from '@/lib/api/client';
import { useAuth } from '@/lib/auth/use-auth';

export type RouteVersionState =
  | 'draft'
  | 'validated'
  | 'simulated'
  | 'published'
  | 'superseded'
  | 'rolled_back';

export type RouteVersion = {
  id: string;
  route_id: string;
  version_number: number;
  state: RouteVersionState;
  definition: Record<string, unknown>;
  created_at: string;
  validated_at: string | null;
  published_at: string | null;
};

export type InboundRoute = {
  id: string;
  name: string;
  match_type: 'did' | 'trunk' | 'pattern';
  match_value: string;
  target_type: 'flow' | 'extension';
  target_id: string | null;
  status: 'draft' | 'active' | 'inactive';
  draft_version_id: string | null;
  active_version_id: string | null;
  created_at: string;
  updated_at: string;
};

export type InboundRouteWithVersions = InboundRoute & { versions: RouteVersion[] };

function noRetryOnAuthError(failureCount: number, error: unknown): boolean {
  if (error instanceof ApiError && (error.status === 401 || error.status === 403)) return false;
  return failureCount < 1;
}

export function useInboundRoutes() {
  const { session } = useAuth();
  return useQuery({
    queryKey: ['inbound-routes'],
    queryFn: async () => {
      const r = await apiRequest<{ data: InboundRoute[] }>('/inbound-routes', { accessToken: session?.token });
      return r.data;
    },
    enabled: Boolean(session?.token),
    retry: noRetryOnAuthError,
  });
}

export function useInboundRoute(id: string) {
  const { session } = useAuth();
  return useQuery({
    queryKey: ['inbound-routes', id],
    queryFn: async () => {
      const r = await apiRequest<{ data: InboundRouteWithVersions }>(`/inbound-routes/${id}`, { accessToken: session?.token });
      return r.data;
    },
    enabled: Boolean(session?.token && id),
    retry: noRetryOnAuthError,
  });
}

export function useCreateInboundRoute() {
  const { session } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: {
      name: string;
      match_type: 'did' | 'trunk' | 'pattern';
      match_value: string;
      target_type: 'flow' | 'extension';
      target_id?: string;
    }) => {
      const r = await apiRequest<{ data: InboundRouteWithVersions }>('/inbound-routes', {
        method: 'POST',
        body: JSON.stringify(body),
        accessToken: session?.token,
      });
      return r.data;
    },
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['inbound-routes'] }); },
  });
}

export function useValidateRouteVersion(routeId: string) {
  const { session } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (versionId: string) => {
      const r = await apiRequest<{ data: { version: RouteVersion; outcome: { status: string; errors: unknown[] } } }>(
        `/inbound-routes/${routeId}/versions/${versionId}/validate`,
        { method: 'POST', accessToken: session?.token },
      );
      return r.data;
    },
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['inbound-routes', routeId] }); },
  });
}

export function usePublishRouteVersion(routeId: string) {
  const { session } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (versionId: string) => {
      const r = await apiRequest<{ data: InboundRoute }>(
        `/inbound-routes/${routeId}/versions/${versionId}/publish`,
        { method: 'POST', accessToken: session?.token },
      );
      return r.data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['inbound-routes'] });
      void qc.invalidateQueries({ queryKey: ['inbound-routes', routeId] });
    },
  });
}

export function useRollbackRoute(routeId: string) {
  const { session } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const r = await apiRequest<{ data: InboundRoute }>(
        `/inbound-routes/${routeId}/rollback`,
        { method: 'POST', accessToken: session?.token },
      );
      return r.data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['inbound-routes'] });
      void qc.invalidateQueries({ queryKey: ['inbound-routes', routeId] });
    },
  });
}

export function useActivateRoute() {
  const { session } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const r = await apiRequest<{ data: InboundRoute }>(`/inbound-routes/${id}/activate`, {
        method: 'POST',
        accessToken: session?.token,
      });
      return r.data;
    },
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['inbound-routes'] }); },
  });
}

export function useDeactivateRoute() {
  const { session } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const r = await apiRequest<{ data: InboundRoute }>(`/inbound-routes/${id}/deactivate`, {
        method: 'POST',
        accessToken: session?.token,
      });
      return r.data;
    },
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['inbound-routes'] }); },
  });
}
