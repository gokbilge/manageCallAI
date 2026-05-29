import { Link, useParams } from 'react-router-dom';
import { RefreshCcw } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { DataCard } from '@/components/data/data-card';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { paths } from '@/lib/routes/paths';
import { useRuntimeSessionReplay } from '@/lib/runtime/runtime-api';

export function RuntimeSessionDetailPage() {
  const { sessionId = '' } = useParams();
  const replayQuery = useRuntimeSessionReplay(sessionId);
  const replay = replayQuery.data;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Tenant Workspace"
        title={replay ? `Runtime Session ${replay.session.call_id}` : 'Runtime Session'}
        description="Replay the backend-resolved IVR session path without reading raw FreeSWITCH internals directly."
        actions={(
          <div className="flex flex-wrap gap-3">
            <Button onClick={() => replayQuery.refetch()} variant="secondary">
              <RefreshCcw className="size-4" aria-hidden="true" />
              Refresh
            </Button>
            <Link className="inline-flex items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 py-2 text-sm font-medium text-[var(--color-fg)] hover:bg-[var(--color-surface-muted)]" to={paths.tenant.runtimeSessions}>
              Back to sessions
            </Link>
          </div>
        )}
      />

      <DataCard title="Session Replay" description="Compatibility detail page for the shared router while the main replay surface lives inline in the Sessions page.">
        {replayQuery.isLoading ? (
          <p className="text-sm text-[var(--color-muted-fg)]">Loading session replay...</p>
        ) : replayQuery.isError ? (
          <div className="rounded-[var(--radius-lg)] border border-[var(--color-danger)]/20 bg-[var(--color-danger)]/10 px-4 py-4 text-sm text-[var(--color-danger)]">
            {replayQuery.error instanceof Error ? replayQuery.error.message : 'Unknown error'}
          </div>
        ) : replay ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <StatusBadge status={replay.session.status === 'failed' ? 'warning' : replay.session.status === 'running' ? 'active' : 'published'} />
              <span className="font-mono text-xs">{replay.session.call_id}</span>
            </div>
            <pre className="overflow-x-auto rounded-[var(--radius-md)] bg-[#0f172a] p-3 text-xs text-slate-100">
              <code>{JSON.stringify(replay, null, 2)}</code>
            </pre>
          </div>
        ) : (
          <p className="text-sm text-[var(--color-muted-fg)]">Session not found.</p>
        )}
      </DataCard>
    </div>
  );
}
