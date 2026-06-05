import { useState } from 'react';
import { Download, FileText } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { DataCard } from '@/components/data/data-card';
import { Button } from '@/components/ui/button';
import { apiRequest } from '@/lib/api/client';
import { useAuth } from '@/lib/auth/use-auth';

type ExportResult = {
  type: string;
  count: number;
  exportedAt: string;
  blob: Blob;
};

function todayMinus(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function downloadJson(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function ExportPage() {
  const { session } = useAuth();

  const [callSince, setCallSince] = useState(todayMinus(30));
  const [callUntil, setCallUntil] = useState(today());
  const [sessionSince, setSessionSince] = useState(todayMinus(30));
  const [sessionUntil, setSessionUntil] = useState(today());

  const [callLoading, setCallLoading] = useState(false);
  const [callError, setCallError] = useState<string | null>(null);
  const [sessionLoading, setSessionLoading] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);

  const [results, setResults] = useState<ExportResult[]>([]);

  async function exportCalls() {
    setCallLoading(true);
    setCallError(null);
    try {
      const params = new URLSearchParams({ since: callSince, until: callUntil, limit: '5000' });
      const data = await apiRequest<unknown[]>(`/export/call-events?${params}`, { accessToken: session?.token });
      const rows = Array.isArray(data) ? data : (data as { data: unknown[] }).data ?? [];
      const json = JSON.stringify(rows, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const result: ExportResult = {
        type: 'Call Events',
        count: rows.length,
        exportedAt: new Date().toISOString(),
        blob,
      };
      setResults(prev => [result, ...prev].slice(0, 10));
      downloadJson(blob, `call-events-${callSince}-${callUntil}.json`);
    } catch (err) {
      setCallError(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setCallLoading(false);
    }
  }

  async function exportSessions() {
    setSessionLoading(true);
    setSessionError(null);
    try {
      const params = new URLSearchParams({ since: sessionSince, until: sessionUntil, limit: '5000' });
      const data = await apiRequest<unknown[]>(`/export/sessions?${params}`, { accessToken: session?.token });
      const rows = Array.isArray(data) ? data : (data as { data: unknown[] }).data ?? [];
      const json = JSON.stringify(rows, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const result: ExportResult = {
        type: 'IVR Sessions',
        count: rows.length,
        exportedAt: new Date().toISOString(),
        blob,
      };
      setResults(prev => [result, ...prev].slice(0, 10));
      downloadJson(blob, `ivr-sessions-${sessionSince}-${sessionUntil}.json`);
    } catch (err) {
      setSessionError(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setSessionLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Tenant Workspace"
        title="Data Export"
        description="Export call events and IVR session logs as JSON. Exports download directly to your browser."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Call events export */}
        <DataCard
          title="Call Events"
          description="Export raw call event records for a date range. Includes start/end times, extension, destination, and disposition."
        >
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-[var(--color-muted-fg)] mb-1">From</label>
                <input
                  type="date"
                  value={callSince}
                  onChange={e => setCallSince(e.target.value)}
                  className="w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-tenant)]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--color-muted-fg)] mb-1">To</label>
                <input
                  type="date"
                  value={callUntil}
                  onChange={e => setCallUntil(e.target.value)}
                  className="w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-tenant)]"
                />
              </div>
            </div>
            {callError && <p className="text-sm text-[var(--color-error)]">{callError}</p>}
            <Button onClick={() => void exportCalls()} disabled={callLoading} className="w-full">
              <Download className="size-4" aria-hidden="true" />
              {callLoading ? 'Exporting…' : 'Export Call Events'}
            </Button>
          </div>
        </DataCard>

        {/* IVR sessions export */}
        <DataCard
          title="IVR Sessions"
          description="Export IVR flow session logs for a date range. Includes flow ID, execution path, and final disposition."
        >
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-[var(--color-muted-fg)] mb-1">From</label>
                <input
                  type="date"
                  value={sessionSince}
                  onChange={e => setSessionSince(e.target.value)}
                  className="w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-tenant)]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--color-muted-fg)] mb-1">To</label>
                <input
                  type="date"
                  value={sessionUntil}
                  onChange={e => setSessionUntil(e.target.value)}
                  className="w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-tenant)]"
                />
              </div>
            </div>
            {sessionError && <p className="text-sm text-[var(--color-error)]">{sessionError}</p>}
            <Button onClick={() => void exportSessions()} disabled={sessionLoading} className="w-full">
              <Download className="size-4" aria-hidden="true" />
              {sessionLoading ? 'Exporting…' : 'Export IVR Sessions'}
            </Button>
          </div>
        </DataCard>
      </div>

      {/* Export history */}
      <DataCard
        title="Export history"
        description="Recent exports from this session. Re-download by clicking the button next to each entry."
      >
        {results.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <FileText className="size-8 text-[var(--color-muted-fg)]" aria-hidden="true" />
            <p className="text-sm text-[var(--color-muted-fg)]">No exports yet. Run an export above to download data.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {results.map((r, i) => (
              <div key={i} className="flex items-center justify-between rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-4 py-3">
                <div>
                  <p className="text-sm font-medium">{r.type}</p>
                  <p className="text-xs text-[var(--color-muted-fg)]">
                    {r.count} records · {new Date(r.exportedAt).toLocaleTimeString()}
                  </p>
                </div>
                <Button
                  variant="secondary"
                  onClick={() => downloadJson(r.blob, `${r.type.toLowerCase().replace(' ', '-')}-redownload.json`)}
                >
                  <Download className="size-4" aria-hidden="true" />
                  Re-download
                </Button>
              </div>
            ))}
          </div>
        )}
      </DataCard>
    </div>
  );
}
