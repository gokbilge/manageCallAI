import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle, Loader2, Search, XCircle } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { DataCard } from '@/components/data/data-card';
import { Button } from '@/components/ui/button';
import { apiRequest, ApiError } from '@/lib/api/client';
import { useAuth } from '@/lib/auth/use-auth';

type ReportFilter = { dimension: string; value: string };
type ReportCallRow = { call_id: string; event_type: string; event_time: string; source: string | null };
type NlQueryResult = {
  question: string;
  applied_filters: ReportFilter[];
  explanation: string;
  result_count: number;
  results: ReportCallRow[];
  is_advisory: true;
  queried_at: string;
};

const EXAMPLE_QUESTIONS = [
  'show failed calls today',
  'how many outbound calls last week',
  'show inbound calls last hour',
  'count failed outbound calls',
  'show completed calls yesterday',
  'show active calls',
];

function FilterChip({ filter }: { filter: ReportFilter }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-surface-muted)] border border-[var(--color-border)] px-2.5 py-1 text-xs font-medium text-[var(--color-fg)]">
      <span className="text-[var(--color-muted-fg)]">{filter.dimension}:</span>
      {filter.value}
    </span>
  );
}

export function ReportingPage() {
  const { session } = useAuth();
  const [question, setQuestion] = useState('');

  const queryMutation = useMutation({
    mutationFn: (q: string) =>
      apiRequest<{ data: NlQueryResult }>('/reporting/nl-query', {
        method: 'POST',
        accessToken: session!.token,
        body: JSON.stringify({ question: q }),
      }),
  });

  function handleSubmit(q: string) {
    if (!q.trim()) return;
    queryMutation.mutate(q.trim());
  }

  const result = queryMutation.data?.data;
  const isUnsupported = queryMutation.isError && queryMutation.error instanceof ApiError && queryMutation.error.status === 400;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Tenant Workspace"
        title="Natural-Language Reporting"
        description="Ask a question about your calls in plain language. Queries are compiled to bounded filters — no raw data access."
      />

      <DataCard title="Ask a question" description="Describe what you want to see. Supported topics: call direction, status, and time range.">
        <div className="space-y-4">
          <div className="flex gap-2">
            <input
              className="flex-1 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm outline-none transition focus:border-[var(--color-focus)] focus:ring-2 focus:ring-[var(--color-focus)]/20"
              placeholder="e.g. show failed outbound calls today"
              value={question}
              onChange={e => setQuestion(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSubmit(question)}
              aria-label="Reporting question"
            />
            <Button
              onClick={() => handleSubmit(question)}
              disabled={queryMutation.isPending || !question.trim()}
              aria-label="Run query"
            >
              {queryMutation.isPending
                ? <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                : <Search className="size-4" aria-hidden="true" />}
              {queryMutation.isPending ? 'Running…' : 'Run'}
            </Button>
          </div>

          <div className="flex flex-wrap gap-2">
            {EXAMPLE_QUESTIONS.map(ex => (
              <button
                key={ex}
                className="rounded-full border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3 py-1 text-xs text-[var(--color-muted-fg)] hover:border-[var(--color-focus)] hover:text-[var(--color-fg)] transition"
                onClick={() => { setQuestion(ex); handleSubmit(ex); }}
                aria-label={`Example: ${ex}`}
              >
                {ex}
              </button>
            ))}
          </div>
        </div>
      </DataCard>

      {isUnsupported && (
        <div className="rounded-[var(--radius-lg)] border border-[var(--color-warning)]/30 bg-[var(--color-warning)]/10 px-4 py-4 text-sm">
          <div className="flex items-center gap-2 font-semibold text-[var(--color-warning)]">
            <AlertTriangle className="size-4" aria-hidden="true" />
            Question not supported
          </div>
          <p className="mt-1 text-[var(--color-muted-fg)]">
            {(queryMutation.error as ApiError).message}
          </p>
          <p className="mt-2 text-xs text-[var(--color-muted-fg)]">
            Try one of the example questions above.
          </p>
        </div>
      )}

      {queryMutation.isError && !isUnsupported && (
        <div className="rounded-[var(--radius-lg)] border border-[var(--color-danger)]/20 bg-[var(--color-danger)]/10 px-4 py-4 text-sm text-[var(--color-danger)]">
          <div className="flex items-center gap-2 font-semibold">
            <XCircle className="size-4" aria-hidden="true" />
            Query failed
          </div>
          <p className="mt-1">{queryMutation.error instanceof Error ? queryMutation.error.message : 'Unknown error'}</p>
        </div>
      )}

      {result && (
        <DataCard title="Result" description={result.explanation}>
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2 items-center">
              <span className="text-xs font-medium text-[var(--color-muted-fg)]">Applied filters:</span>
              {result.applied_filters.length > 0
                ? result.applied_filters.map(f => <FilterChip key={`${f.dimension}-${f.value}`} filter={f} />)
                : <span className="text-xs text-[var(--color-muted-fg)]">none (default 24h window)</span>
              }
            </div>

            <div className="flex items-center gap-2 text-sm">
              <CheckCircle className="size-4 text-[var(--color-success)]" aria-hidden="true" />
              <span className="font-medium">{result.result_count}</span>
              <span className="text-[var(--color-muted-fg)]">matching event(s)</span>
            </div>

            {result.results.length > 0 ? (
              <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border)]">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[var(--color-surface-muted)] text-[var(--color-muted-fg)]">
                    <tr>
                      <th className="px-3 py-2 font-medium">Call ID</th>
                      <th className="px-3 py-2 font-medium">Event type</th>
                      <th className="px-3 py-2 font-medium">Time</th>
                      <th className="px-3 py-2 font-medium">Source</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--color-border)] bg-[var(--color-surface)]">
                    {result.results.map((row, i) => (
                      <tr key={`${row.call_id}-${i}`}>
                        <td className="px-3 py-2 font-mono">{row.call_id.slice(0, 12)}…</td>
                        <td className="px-3 py-2 text-[var(--color-muted-fg)]">{row.event_type}</td>
                        <td className="px-3 py-2 text-[var(--color-muted-fg)]">{new Date(row.event_time).toLocaleString()}</td>
                        <td className="px-3 py-2 text-[var(--color-muted-fg)]">{row.source ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-[var(--color-muted-fg)]">No matching events found for this query.</p>
            )}

            <p className="text-[10px] text-[var(--color-muted-fg)]">
              Advisory only — results are read-only and bounded to approved reporting dimensions.
              Queried at {new Date(result.queried_at).toLocaleString()}.
            </p>
          </div>
        </DataCard>
      )}
    </div>
  );
}
