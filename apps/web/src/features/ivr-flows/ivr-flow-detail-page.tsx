import type { ReactNode } from 'react';
import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { FlaskConical, RefreshCcw, Rocket, ShieldCheck, Workflow } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { DataCard } from '@/components/data/data-card';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import {
  useFlowVersions,
  useIvrFlow,
  usePublishFlowVersion,
  useRollbackFlow,
  useSimulateCurrentDraft,
  useValidateCurrentDraft,
} from '@/lib/ivr-flows/ivr-flows-api';
import { paths } from '@/lib/routes/paths';

export function IvrFlowDetailPage() {
  const { flowId = '' } = useParams();
  const flowQuery = useIvrFlow(flowId);
  const versionsQuery = useFlowVersions(flowId);
  const validateDraft = useValidateCurrentDraft(flowId);
  const simulateDraft = useSimulateCurrentDraft(flowId);
  const publishFlowVersion = usePublishFlowVersion(flowId);
  const rollbackFlow = useRollbackFlow(flowId);

  const draftVersion = useMemo(
    () => versionsQuery.data?.find((version) => version.id === flowQuery.data?.draft_version_id) ?? versionsQuery.data?.[0],
    [flowQuery.data?.draft_version_id, versionsQuery.data],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Tenant Workspace"
        title={flowQuery.data?.name ?? 'IVR Flow'}
        description="Inspect flow metadata, draft JSON, and validation state before publish. The visual builder comes after the simulation/runtime foundation."
        actions={(
          <div className="flex flex-wrap gap-3">
            <Button onClick={() => flowQuery.refetch()} variant="secondary">
              <RefreshCcw className="size-4" aria-hidden="true" />
              Refresh
            </Button>
            <Button
              disabled={!flowQuery.data?.draft_version_id || validateDraft.isPending}
              onClick={() => void validateDraft.mutateAsync()}
              variant="secondary"
            >
              <ShieldCheck className="size-4" aria-hidden="true" />
              {validateDraft.isPending ? 'Validating...' : 'Validate Draft'}
            </Button>
            <Button
              disabled={!flowQuery.data?.draft_version_id || simulateDraft.isPending}
              onClick={() => void simulateDraft.mutateAsync({ digits: ['1'] })}
              variant="secondary"
            >
              <FlaskConical className="size-4" aria-hidden="true" />
              {simulateDraft.isPending ? 'Simulating...' : 'Simulate Draft'}
            </Button>
            <Button
              disabled={!draftVersion || !['validated', 'simulated'].includes(draftVersion.state) || publishFlowVersion.isPending}
              onClick={() => draftVersion && void publishFlowVersion.mutateAsync(draftVersion.id)}
            >
              <Rocket className="size-4" aria-hidden="true" />
              {publishFlowVersion.isPending ? 'Publishing...' : 'Publish Draft'}
            </Button>
          </div>
        )}
      />

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="space-y-6">
          <DataCard title="Flow Metadata" description="Desired-state object metadata and current lifecycle pointers.">
            {flowQuery.isLoading ? (
              <p className="text-sm text-[var(--color-muted-fg)]">Loading flow...</p>
            ) : flowQuery.isError ? (
              <ErrorState message={flowQuery.error instanceof Error ? flowQuery.error.message : 'Unknown error'} />
            ) : flowQuery.data ? (
              <dl className="grid gap-3 text-sm sm:grid-cols-2">
                <MetaItem label="Name" value={flowQuery.data.name} />
                <MetaItem label="Status" value={<StatusBadge status={flowQuery.data.status} />} />
                <MetaItem label="Draft Version" value={flowQuery.data.draft_version_id ?? 'none'} mono />
                <MetaItem label="Active Version" value={flowQuery.data.active_version_id ?? 'none'} mono />
                <MetaItem label="Description" value={flowQuery.data.description ?? 'No description'} />
                <MetaItem
                  label="Rollback"
                  value={flowQuery.data.active_version_id ? (
                    <Button
                      disabled={rollbackFlow.isPending}
                      onClick={() => void rollbackFlow.mutateAsync()}
                      variant="secondary"
                    >
                      {rollbackFlow.isPending ? 'Rolling back...' : 'Rollback'}
                    </Button>
                  ) : 'Not available yet'}
                />
              </dl>
            ) : (
              <ErrorState message="Flow not found." />
            )}
          </DataCard>

          <DataCard title="Flow Versions" description="Immutable versions are the unit of validation, publish, and rollback.">
            {versionsQuery.isLoading ? (
              <p className="text-sm text-[var(--color-muted-fg)]">Loading versions...</p>
            ) : versionsQuery.isError ? (
              <ErrorState message={versionsQuery.error instanceof Error ? versionsQuery.error.message : 'Unknown error'} />
            ) : versionsQuery.data && versionsQuery.data.length > 0 ? (
              <ul className="space-y-3">
                {versionsQuery.data.map((version) => (
                  <li key={version.id} className="rounded-[var(--radius-lg)] border border-[var(--color-border)] p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium">Version {version.version_number}</p>
                        <p className="mt-1 font-mono text-xs text-[var(--color-muted-fg)]">{version.id}</p>
                      </div>
                      <StatusBadge status={version.state === 'published' ? 'published' : version.state} />
                    </div>
                    <div className="mt-2 flex flex-wrap gap-4 text-xs text-[var(--color-muted-fg)]">
                      <span>Validated: {version.validated_at ? 'yes' : 'no'}</span>
                      <span>Simulated: {version.simulated_at ? 'yes' : 'no'}</span>
                      <span>Published: {version.published_at ? 'yes' : 'no'}</span>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-[var(--color-muted-fg)]">No versions yet.</p>
            )}
          </DataCard>
        </div>

        <div className="space-y-6">
          <DataCard title="Draft Graph JSON" description="Current draft version rendered as JSON until the visual editor lands.">
            {draftVersion ? (
              <pre className="overflow-x-auto rounded-[var(--radius-md)] bg-[#0f172a] p-4 text-xs text-slate-100">
                <code>{JSON.stringify(draftVersion.graph_json, null, 2)}</code>
              </pre>
            ) : (
              <p className="text-sm text-[var(--color-muted-fg)]">No draft version found for this flow.</p>
            )}
          </DataCard>

          <DataCard title="Validation Result" description="MVP structural validation checks graph integrity before any publish operation.">
            {validateDraft.data ? (
              <div className="space-y-4 text-sm">
                <div className="flex items-center gap-3">
                  <StatusBadge status={validateDraft.data.outcome.status === 'passed' ? 'validated' : 'warning'} />
                  <span className="font-medium">
                    {validateDraft.data.outcome.status === 'passed' ? 'Draft validation passed' : 'Draft validation failed'}
                  </span>
                </div>
                {validateDraft.data.outcome.errors.length > 0 ? (
                  <ul className="space-y-2 text-[var(--color-danger)]">
                    {validateDraft.data.outcome.errors.map((error, index) => (
                      <li key={`${String((error as { field?: string }).field)}-${index}`} className="rounded-[var(--radius-md)] bg-[var(--color-danger)]/10 px-3 py-2">
                        {JSON.stringify(error)}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-[var(--color-muted-fg)]">No structural errors detected.</p>
                )}
                {validateDraft.data.outcome.warnings.length > 0 ? (
                  <ul className="space-y-2 text-[var(--color-warning)]">
                    {validateDraft.data.outcome.warnings.map((warning, index) => (
                      <li key={`${String((warning as { field?: string }).field)}-${index}`} className="rounded-[var(--radius-md)] bg-[var(--color-warning)]/10 px-3 py-2">
                        {JSON.stringify(warning)}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : (
              <p className="text-sm text-[var(--color-muted-fg)]">
                No validation result yet. Run validation on the current draft before publish.
              </p>
            )}
          </DataCard>

          <DataCard title="Simulation Result" description="Simulation follows a sample input path without mutating live runtime state.">
            {simulateDraft.data ? (
              <div className="space-y-4 text-sm">
                <div className="flex items-center gap-3">
                  <StatusBadge status={simulateDraft.data.outcome.status === 'passed' ? 'validated' : 'warning'} />
                  <span className="font-medium">
                    {simulateDraft.data.outcome.status === 'passed' ? 'Draft simulation passed' : 'Draft simulation failed'}
                  </span>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.1em] text-[var(--color-muted-fg)]">Path</p>
                  <p className="mt-1 font-mono text-xs text-[var(--color-fg)]">
                    {simulateDraft.data.outcome.path.length > 0 ? simulateDraft.data.outcome.path.join(' -> ') : 'No path produced'}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.1em] text-[var(--color-muted-fg)]">Final Action</p>
                  <pre className="mt-1 overflow-x-auto rounded-[var(--radius-md)] bg-[#0f172a] p-3 text-xs text-slate-100">
                    <code>{JSON.stringify(simulateDraft.data.outcome.final_action, null, 2)}</code>
                  </pre>
                </div>
                {simulateDraft.data.outcome.errors.length > 0 ? (
                  <ul className="space-y-2 text-[var(--color-danger)]">
                    {simulateDraft.data.outcome.errors.map((error, index) => (
                      <li key={`sim-${index}`} className="rounded-[var(--radius-md)] bg-[var(--color-danger)]/10 px-3 py-2">
                        {JSON.stringify(error)}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-[var(--color-muted-fg)]">No simulation errors detected.</p>
                )}
              </div>
            ) : (
              <p className="text-sm text-[var(--color-muted-fg)]">
                No simulation result yet. Run a draft simulation before publish when changing customer-facing call behavior.
              </p>
            )}
          </DataCard>

          <DataCard title="Publish State" description="Publish and rollback may be gated by approval policy depending on tenant rules.">
            {publishFlowVersion.data?.status === 'pending_approval' ? (
              <p className="text-sm text-[var(--color-warning)]">
                Publish request queued for approval: {publishFlowVersion.data.approval_request_id}
              </p>
            ) : rollbackFlow.data?.status === 'pending_approval' ? (
              <p className="text-sm text-[var(--color-warning)]">
                Rollback request queued for approval: {rollbackFlow.data.approval_request_id}
              </p>
            ) : (
              <p className="text-sm text-[var(--color-muted-fg)]">
                No pending approval request. Direct publish remains available when policy permits it.
              </p>
            )}
          </DataCard>

          <DataCard title="Next UI Slice" description="This foundation stays intentionally narrow until validation, simulation, and runtime resolver contracts are proven.">
            <p className="text-sm text-[var(--color-muted-fg)]">
              Visual builder will be added after validation, simulation, and runtime execution foundations are implemented.
            </p>
            <Link className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-[var(--color-tenant)] hover:underline" to={paths.tenant.ivrFlows}>
              <Workflow className="size-4" aria-hidden="true" />
              Back to IVR flow list
            </Link>
          </DataCard>
        </div>
      </div>
    </div>
  );
}

function MetaItem({ label, value, mono = false }: { label: string; value: ReactNode; mono?: boolean }) {
  return (
    <div className="space-y-1">
      <dt className="text-xs uppercase tracking-[0.1em] text-[var(--color-muted-fg)]">{label}</dt>
      <dd className={mono ? 'font-mono text-xs text-[var(--color-fg)]' : 'text-[var(--color-fg)]'}>{value}</dd>
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-danger)]/20 bg-[var(--color-danger)]/10 px-4 py-4 text-sm text-[var(--color-danger)]">
      {message}
    </div>
  );
}
