import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download, FileAudio, RefreshCcw } from 'lucide-react';
import { SummaryReviewPanel } from '@/components/ai/summary-review-panel';
import { PageHeader } from '@/components/layout/page-header';
import { DataCard } from '@/components/data/data-card';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { apiRequest } from '@/lib/api/client';
import { useRecordingSummaryReview } from '@/lib/ai/summary-review-api';
import { useAuth } from '@/lib/auth/use-auth';

type Recording = {
  id: string;
  call_id: string;
  duration_secs: number | null;
  size_bytes: number | null;
  status: 'pending' | 'available' | 'deleted';
  recorded_at: string;
  created_at: string;
};

export function RecordingsPage() {
  const { session } = useAuth();
  const [selectedRecordingId, setSelectedRecordingId] = useState<string | null>(null);

  const recordingsQuery = useQuery({
    queryKey: ['recordings', session?.claims.tenant_id],
    enabled: Boolean(session?.token),
    queryFn: async () => {
      const result = await apiRequest<{ data: Recording[] }>('/recordings', {
        accessToken: session!.token,
      });
      return result.data;
    },
  });

  useEffect(() => {
    if (!recordingsQuery.data?.length) {
      setSelectedRecordingId(null);
      return;
    }
    if (!selectedRecordingId || !recordingsQuery.data.some((recording) => recording.id === selectedRecordingId)) {
      setSelectedRecordingId(recordingsQuery.data[0]!.id);
    }
  }, [recordingsQuery.data, selectedRecordingId]);

  const summaryQuery = useRecordingSummaryReview(selectedRecordingId);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Tenant Workspace"
        title="Recordings"
        description="Tenant-owned call and voicemail recording metadata with playback links guarded by the recordings permission."
        actions={
          <Button onClick={() => recordingsQuery.refetch()} variant="secondary">
            <RefreshCcw className="size-4" aria-hidden="true" />
            Refresh
          </Button>
        }
      />

      <DataCard title="Recording Library" description="Recent voicemail and call recordings available for operator review.">
        {recordingsQuery.isLoading ? (
          <p className="text-sm text-[var(--color-muted-fg)]">Loading recordings...</p>
        ) : recordingsQuery.isError ? (
          <ErrorState
            title="Could not load recordings"
            message={recordingsQuery.error instanceof Error ? recordingsQuery.error.message : 'Unknown error'}
          />
        ) : recordingsQuery.data && recordingsQuery.data.length > 0 ? (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(22rem,1fr)]">
            <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border)]">
              <table className="w-full text-left text-sm">
                <thead className="bg-[var(--color-surface-muted)] text-[var(--color-muted-fg)]">
                  <tr>
                    <th className="px-3 py-2 font-medium">Call</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 font-medium">Duration</th>
                    <th className="px-3 py-2 font-medium">Recorded</th>
                    <th className="px-3 py-2 font-medium">Playback</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border)] bg-[var(--color-surface)]">
                  {recordingsQuery.data.map((recording) => (
                    <tr
                      key={recording.id}
                      className={`cursor-pointer ${recording.id === selectedRecordingId ? 'bg-[var(--color-surface-muted)]' : 'hover:bg-[var(--color-surface-muted)]'}`}
                      onClick={() => setSelectedRecordingId(recording.id)}
                    >
                      <td className="px-3 py-2">
                        <span className="flex items-center gap-2 font-mono text-xs">
                          <FileAudio className="size-3.5 text-[var(--color-muted-fg)]" aria-hidden="true" />
                          {recording.call_id}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <StatusBadge status={recording.status} />
                      </td>
                      <td className="px-3 py-2 text-xs text-[var(--color-muted-fg)]">
                        {recording.duration_secs === null ? 'Unknown' : `${recording.duration_secs}s`}
                      </td>
                      <td className="px-3 py-2 text-xs text-[var(--color-muted-fg)]">
                        {new Date(recording.recorded_at).toLocaleString()}
                      </td>
                      <td className="px-3 py-2">
                        {recording.status === 'available' ? (
                          <a
                            className="inline-flex items-center gap-2 text-sm font-medium text-[var(--color-tenant)] hover:underline"
                            href={`${apiBaseUrl()}/recordings/${recording.id}/playback`}
                            onClick={(event) => event.stopPropagation()}
                            rel="noreferrer"
                            target="_blank"
                          >
                            <Download className="size-4" aria-hidden="true" />
                            Open
                          </a>
                        ) : (
                          <span className="text-xs text-[var(--color-muted-fg)]">Unavailable</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <DataCard
              title="AI Review"
              description="Summary and transcript review for the selected recording. Voicemail-linked recordings use the same controls."
            >
              <SummaryReviewPanel
                review={summaryQuery.data}
                isLoading={summaryQuery.isLoading}
                error={summaryQuery.isError ? (summaryQuery.error instanceof Error ? summaryQuery.error.message : 'Could not load AI review.') : null}
                emptyMessage="Select a recording to inspect its summary and transcript state."
              />
            </DataCard>
          </div>
        ) : (
          <EmptyState
            title="No recordings yet"
            description="Voicemail and call recording metadata appears here after the runtime agent ingests completed media."
          />
        )}
      </DataCard>
    </div>
  );
}

function apiBaseUrl(): string {
  return import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000/api/v1';
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
