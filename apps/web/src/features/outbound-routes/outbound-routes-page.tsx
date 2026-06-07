import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, ArrowUpRight, CheckCircle, Info, Plus, RefreshCcw, ShieldAlert, XCircle } from 'lucide-react';
import { useForm } from 'react-hook-form';
import type { ReactNode } from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { DataCard } from '@/components/data/data-card';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { apiRequest, ApiError } from '@/lib/api/client';
import { useAuth } from '@/lib/auth/use-auth';

type OutboundRoute = {
  id: string;
  name: string;
  status: 'draft' | 'active' | 'inactive';
  match_prefix: string;
  priority: number;
  sip_trunk_id: string;
  fallback_sip_trunk_id: string | null;
  max_calls_per_minute: number | null;
  created_at: string;
};

type EnterpriseConflict = {
  code: string;
  severity: 'info' | 'warning' | 'error';
  scope: 'route' | 'site' | 'numbering_plan' | 'calling_policy' | 'schedule' | 'trunk_group' | 'failover';
  message: string;
};

type EnterpriseSimulationStep = {
  category: 'site' | 'schedule' | 'numbering' | 'policy' | 'route' | 'failover';
  status: 'ok' | 'warning' | 'blocked';
  title: string;
  detail: string;
};

type EnterpriseCheck = {
  validation: {
    target_type: 'outbound_route';
    target_id: string;
    target_name: string;
    validation_status: 'passed' | 'failed';
    blocking_issues: EnterpriseConflict[];
    advisory_issues: EnterpriseConflict[];
    checked_at: string;
    summary: string;
  };
  simulation: {
    target_type: 'outbound_route';
    target_id: string;
    dial_string: string;
    site_id: string | null;
    site_name: string | null;
    schedule_id: string | null;
    schedule_name: string | null;
    call_type: string | null;
    matched_rule_name: string | null;
    policy_name: string | null;
    schedule_state: 'in_hours' | 'out_of_hours' | 'not_checked' | 'missing';
    outcome: 'routed_primary' | 'routed_fallback' | 'blocked_by_policy' | 'out_of_hours' | 'no_available_trunks' | 'schedule_missing';
    selected_trunk_id: string | null;
    selected_trunk_name: string | null;
    steps: EnterpriseSimulationStep[];
    summary: string;
    is_advisory: true;
    simulated_at: string;
  };
};

type CreateRouteForm = {
  name: string;
  match_prefix: string;
  sip_trunk_id: string;
  priority: number;
  start_as_draft: boolean;
};

function validationStatusColor(status: 'passed' | 'failed') {
  return status === 'failed' ? 'text-[var(--color-danger)]' : 'text-[var(--color-success)]';
}

function severityIcon(severity: 'info' | 'warning' | 'error') {
  if (severity === 'error') return <XCircle className="size-3.5 shrink-0 text-[var(--color-danger)]" aria-hidden="true" />;
  if (severity === 'warning') return <AlertTriangle className="size-3.5 shrink-0 text-[var(--color-warning)]" aria-hidden="true" />;
  return <Info className="size-3.5 shrink-0 text-[var(--color-info)]" aria-hidden="true" />;
}

function EnterpriseCheckPanel({
  analysis,
  onClose,
}: {
  analysis: EnterpriseCheck;
  onClose: () => void;
}) {
  const issues = [...analysis.validation.blocking_issues, ...analysis.validation.advisory_issues];

  return (
    <div
      className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-4 space-y-3"
      role="region"
      aria-label="Enterprise check result"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <ShieldAlert className="size-4 text-[var(--color-muted-fg)]" aria-hidden="true" />
          <span className="text-sm font-semibold">Enterprise Check</span>
          <span className={`text-xs font-bold uppercase ${validationStatusColor(analysis.validation.validation_status)}`}>
            {analysis.validation.validation_status}
          </span>
        </div>
        <button
          className="text-xs text-[var(--color-muted-fg)] hover:text-[var(--color-fg)]"
          onClick={onClose}
          aria-label="Close enterprise check"
        >
          X
        </button>
      </div>

      <p className="text-xs text-[var(--color-muted-fg)]">{analysis.validation.summary}</p>

      {issues.length > 0 ? (
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-[var(--color-fg)]">Conflicts and advisories</p>
          {issues.map((issue) => (
            <div key={issue.code} className="flex items-start gap-1.5 text-xs">
              {severityIcon(issue.severity)}
              <span className="text-[var(--color-muted-fg)]">{issue.message}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex items-center gap-1.5 text-xs text-[var(--color-success)]">
          <CheckCircle className="size-3.5" aria-hidden="true" />
          No cross-object conflicts found.
        </div>
      )}

      <div className="space-y-1">
        <p className="text-xs font-medium text-[var(--color-fg)]">Simulation outcome</p>
        <p className="text-xs text-[var(--color-muted-fg)]">{analysis.simulation.summary}</p>
        <div className="flex flex-wrap gap-2 text-[10px] text-[var(--color-muted-fg)]">
          <span className="rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-1.5 py-0.5">{analysis.simulation.outcome}</span>
          {analysis.simulation.call_type ? <span className="rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-1.5 py-0.5">{analysis.simulation.call_type}</span> : null}
          {analysis.simulation.selected_trunk_name ? <span className="rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-1.5 py-0.5">{analysis.simulation.selected_trunk_name}</span> : null}
        </div>
      </div>

      <div className="space-y-1">
        <p className="text-xs font-medium text-[var(--color-fg)]">Decision path</p>
        {analysis.simulation.steps.map((step, index) => (
          <div key={`${step.category}-${index}`} className="flex items-start gap-2 text-xs text-[var(--color-muted-fg)]">
            <span className="rounded bg-[var(--color-surface)] border border-[var(--color-border)] px-1.5 py-0.5 font-mono">{step.category}</span>
            <span>{step.detail}</span>
          </div>
        ))}
      </div>

      <p className="text-[10px] text-[var(--color-muted-fg)]">Advisory only. Publish remains API-enforced and rejects blocking enterprise conflicts.</p>
    </div>
  );
}

export function OutboundRoutesPage() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const [riskTargetId, setRiskTargetId] = useState<string | null>(null);
  const [checkDialString, setCheckDialString] = useState('+15551212');
  const [checkSiteId, setCheckSiteId] = useState('');
  const [checkScheduleId, setCheckScheduleId] = useState('');
  const [submittedCheck, setSubmittedCheck] = useState<{ dialString: string; siteId: string; scheduleId: string }>({
    dialString: '+15551212',
    siteId: '',
    scheduleId: '',
  });
  const form = useForm<CreateRouteForm>({
    defaultValues: { name: '', match_prefix: '', sip_trunk_id: '', priority: 100, start_as_draft: false },
  });

  const routesQuery = useQuery({
    queryKey: ['outbound-routes', session?.claims.tenant_id],
    enabled: Boolean(session?.token),
    queryFn: async () => {
      const result = await apiRequest<{ data: OutboundRoute[] }>('/outbound-routes', {
        accessToken: session!.token,
      });
      return result.data;
    },
  });

  const riskQuery = useQuery({
    queryKey: ['enterprise-check', riskTargetId, submittedCheck.dialString, submittedCheck.siteId, submittedCheck.scheduleId],
    enabled: Boolean(session?.token && riskTargetId),
    queryFn: async () => {
      const result = await apiRequest<{ data: EnterpriseCheck }>(`/outbound-routes/${riskTargetId}/enterprise-check`, {
        method: 'POST',
        accessToken: session!.token,
        body: JSON.stringify({
          dial_string: submittedCheck.dialString,
          site_id: submittedCheck.siteId || null,
          schedule_id: submittedCheck.scheduleId || null,
        }),
      });
      return result.data;
    },
  });

  const createMutation = useMutation({
    mutationFn: (values: CreateRouteForm) =>
      apiRequest<{ data: OutboundRoute }>('/outbound-routes', {
        method: 'POST',
        accessToken: session!.token,
        body: JSON.stringify({
          name: values.name,
          match_prefix: values.match_prefix,
          sip_trunk_id: values.sip_trunk_id,
          priority: Number(values.priority),
          start_as_draft: values.start_as_draft,
        }),
      }),
    onSuccess: async () => {
      form.reset();
      await queryClient.invalidateQueries({ queryKey: ['outbound-routes', session?.claims.tenant_id] });
    },
  });

  const publishMutation = useMutation({
    mutationFn: (id: string) =>
      apiRequest<{ data: OutboundRoute }>(`/outbound-routes/${id}/publish`, {
        method: 'POST',
        accessToken: session!.token,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['outbound-routes', session?.claims.tenant_id] });
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: string) =>
      apiRequest<{ data: OutboundRoute }>(`/outbound-routes/${id}/deactivate`, {
        method: 'POST',
        accessToken: session!.token,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['outbound-routes', session?.claims.tenant_id] });
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Tenant Workspace"
        title="Outbound Routes"
        description="Desired-state dial rules that map number prefixes to SIP trunks. The backend selects the best route by longest-prefix match and priority."
        actions={
          <Button onClick={() => routesQuery.refetch()} variant="secondary">
            <RefreshCcw className="size-4" aria-hidden="true" />
            Refresh
          </Button>
        }
      />

      <div className="space-y-4">
        <div className="grid gap-6 xl:grid-cols-[1.35fr_0.85fr]">
          <DataCard title="Route Inventory" description="Draft, active, and inactive outbound routes ordered by priority. Publish a draft to start routing live calls.">
            {routesQuery.isLoading ? (
              <p className="text-sm text-[var(--color-muted-fg)]">Loading routes...</p>
            ) : routesQuery.isError ? (
              <ErrorState
                title="Could not load outbound routes"
                message={routesQuery.error instanceof Error ? routesQuery.error.message : 'Unknown error'}
              />
            ) : routesQuery.data && routesQuery.data.length > 0 ? (
              <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border)]">
                <table className="w-full text-left text-sm">
                  <thead className="bg-[var(--color-surface-muted)] text-[var(--color-muted-fg)]">
                    <tr>
                      <th className="px-3 py-2 font-medium">Name</th>
                      <th className="px-3 py-2 font-medium">Prefix</th>
                      <th className="px-3 py-2 font-medium">Priority</th>
                      <th className="px-3 py-2 font-medium">Trunk</th>
                      <th className="px-3 py-2 font-medium">Rate cap</th>
                      <th className="px-3 py-2 font-medium">Status</th>
                      <th className="px-3 py-2 font-medium"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--color-border)] bg-[var(--color-surface)]">
                    {routesQuery.data.map((route) => (
                      <tr key={route.id}>
                        <td className="px-3 py-2 font-medium">
                          <span className="flex items-center gap-2">
                            <ArrowUpRight className="size-3.5 text-[var(--color-muted-fg)]" aria-hidden="true" />
                            {route.name}
                          </span>
                        </td>
                        <td className="px-3 py-2 font-mono text-xs">{route.match_prefix}</td>
                        <td className="px-3 py-2 text-[var(--color-muted-fg)]">{route.priority}</td>
                        <td className="px-3 py-2 font-mono text-xs text-[var(--color-muted-fg)]">{route.sip_trunk_id.slice(0, 8)}...</td>
                        <td className="px-3 py-2 text-[var(--color-muted-fg)]">
                          {route.max_calls_per_minute ? `${route.max_calls_per_minute}/min` : '-'}
                        </td>
                        <td className="px-3 py-2">
                          <StatusBadge status={route.status} />
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-2">
                            <Button
                              variant="secondary"
                              onClick={() => {
                                if (riskTargetId === route.id) {
                                  setRiskTargetId(null);
                                  return;
                                }
                                const defaultDialString = route.match_prefix === '+' ? '+15551212' : `${route.match_prefix}5551212`;
                                setCheckDialString(defaultDialString);
                                setCheckSiteId('');
                                setCheckScheduleId('');
                                setSubmittedCheck({ dialString: defaultDialString, siteId: '', scheduleId: '' });
                                setRiskTargetId(route.id);
                              }}
                              aria-label={`Analyze risk for ${route.name}`}
                              aria-pressed={riskTargetId === route.id}
                            >
                              <ShieldAlert className="size-3.5" aria-hidden="true" />
                              Check
                            </Button>
                            {route.status === 'draft' && (
                              <Button
                                variant="secondary"
                                onClick={() => publishMutation.mutate(route.id)}
                                disabled={publishMutation.isPending}
                                aria-label={`Publish ${route.name}`}
                              >
                                Publish
                              </Button>
                            )}
                            {route.status === 'active' && (
                              <Button
                                variant="secondary"
                                onClick={() => deactivateMutation.mutate(route.id)}
                                disabled={deactivateMutation.isPending}
                                aria-label={`Deactivate ${route.name}`}
                              >
                                Deactivate
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState
                title="No outbound routes yet"
                description="Create an outbound route to define how calls are placed through SIP trunks."
              />
            )}
          </DataCard>

          <DataCard title="Create Route" description="Map a dial prefix to a SIP trunk. The backend uses longest-prefix match then priority to select routes.">
            <form className="space-y-4" onSubmit={form.handleSubmit((values) => createMutation.mutate(values))}>
              <Field label="Name">
                <input className={inputClass} {...form.register('name', { required: true })} />
              </Field>
              <Field label="Match prefix (e.g. +1 or 001)">
                <input className={inputClass} placeholder="+1" {...form.register('match_prefix', { required: true })} />
              </Field>
              <Field label="SIP trunk ID (UUID)">
                <input className={inputClass} {...form.register('sip_trunk_id', { required: true })} />
              </Field>
              <Field label="Priority (lower = higher priority)">
                <input className={inputClass} type="number" min={1} max={9999} {...form.register('priority', { required: true, valueAsNumber: true })} />
              </Field>

              {createMutation.isError ? (
                <div className="rounded-[var(--radius-md)] border border-[var(--color-danger)]/20 bg-[var(--color-danger)]/10 px-4 py-3 text-sm text-[var(--color-danger)]">
                  {createMutation.error instanceof ApiError ? createMutation.error.message : 'Could not create route'}
                </div>
              ) : null}

              <label className="flex items-center gap-3 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm">
                <input type="checkbox" {...form.register('start_as_draft')} />
                <div>
                  <p className="font-medium">Create as draft</p>
                  <p className="text-xs text-[var(--color-muted-fg)]">Route will not route calls until published.</p>
                </div>
              </label>

              <Button className="w-full" disabled={createMutation.isPending} type="submit">
                <Plus className="size-4" aria-hidden="true" />
                {createMutation.isPending ? 'Creating...' : 'Create Route'}
              </Button>
            </form>
          </DataCard>
        </div>

        {riskTargetId && (
          <div>
            <div className="mb-3 grid gap-3 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-3 md:grid-cols-[1.2fr_1fr_1fr_auto]">
              <label className="space-y-1 text-xs">
                <span className="font-medium text-[var(--color-fg)]">Dial string</span>
                <input className={inputClass} value={checkDialString} onChange={(event) => setCheckDialString(event.target.value)} />
              </label>
              <label className="space-y-1 text-xs">
                <span className="font-medium text-[var(--color-fg)]">Site ID</span>
                <input className={inputClass} value={checkSiteId} onChange={(event) => setCheckSiteId(event.target.value)} placeholder="Optional UUID" />
              </label>
              <label className="space-y-1 text-xs">
                <span className="font-medium text-[var(--color-fg)]">Schedule ID</span>
                <input className={inputClass} value={checkScheduleId} onChange={(event) => setCheckScheduleId(event.target.value)} placeholder="Optional UUID" />
              </label>
              <div className="flex items-end">
                <Button
                  variant="secondary"
                  onClick={() => setSubmittedCheck({ dialString: checkDialString, siteId: checkSiteId, scheduleId: checkScheduleId })}
                >
                  Refresh Check
                </Button>
              </div>
            </div>
            {riskQuery.isLoading && (
              <p className="text-sm text-[var(--color-muted-fg)]" role="status">Running enterprise check...</p>
            )}
            {riskQuery.isError && (
              <ErrorState
                title="Enterprise check failed"
                message={riskQuery.error instanceof Error ? riskQuery.error.message : 'Unknown error'}
              />
            )}
            {riskQuery.data && (
              <EnterpriseCheckPanel
                analysis={riskQuery.data}
                onClose={() => setRiskTargetId(null)}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-medium">{label}</span>
      {children}
    </label>
  );
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-[var(--radius-lg)] bg-[var(--color-surface-muted)] px-4 py-6 text-sm text-[var(--color-muted-fg)]">
      <p className="font-medium text-[var(--color-fg)]">{title}</p>
      <p className="mt-2">{description}</p>
    </div>
  );
}

function ErrorState({ title, message }: { title: string; message: string }) {
  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-danger)]/20 bg-[var(--color-danger)]/10 px-4 py-6 text-sm text-[var(--color-danger)]">
      <p className="font-medium">{title}</p>
      <p className="mt-2">{message}</p>
    </div>
  );
}

const inputClass =
  'w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm outline-none transition focus:border-[var(--color-focus)] focus:ring-2 focus:ring-[var(--color-focus)]/20';
