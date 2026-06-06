import { useEffect, useState } from 'react';
import { AlertTriangle, FileSearch, Loader2, RefreshCcw, Search } from 'lucide-react';
import { DataCard } from '@/components/data/data-card';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import {
  type IncidentInvestigation,
  useCreateIncidentInvestigation,
  useIncidentInvestigations,
} from '@/lib/ai/incident-investigation-api';

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

export function IncidentInvestigationPage() {
  const investigationsQuery = useIncidentInvestigations();
  const createMutation = useCreateIncidentInvestigation();
  const [question, setQuestion] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const investigations = investigationsQuery.data ?? [];
  const selected = investigations.find((item) => item.id === selectedId) ?? createMutation.data?.data ?? null;

  useEffect(() => {
    if (!selectedId && investigations[0]) setSelectedId(investigations[0].id);
  }, [investigations, selectedId]);

  async function submit() {
    try {
      const result = await createMutation.mutateAsync({ question });
      setQuestion('');
      setSelectedId(result.data.id);
    } catch {
      // Mutation state drives the visible error message.
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="AI Workspace"
        title="Incident Investigation Assistant"
        description="Read-only investigation over normalized call events, routes, gateway state, and recording evidence where your role allows it. Every answer is advisory and citation-backed."
        actions={
          <Button variant="secondary" onClick={() => investigationsQuery.refetch()}>
            <RefreshCcw className="size-4" aria-hidden="true" />
            Refresh
          </Button>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[24rem_minmax(0,1fr)]">
        <DataCard title="Ask a question" description="Prompt the assistant with a specific incident question. Responses cite stored product facts only.">
          <div className="space-y-4">
            <textarea
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              placeholder="Why are outbound calls failing for carrier A this morning?"
              className="min-h-32 w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-tenant)]"
            />
            <Button onClick={() => void submit()} disabled={question.trim().length === 0 || createMutation.isPending} className="w-full">
              {createMutation.isPending ? <><Loader2 className="size-4 animate-spin" aria-hidden="true" /> Investigating…</> : <><Search className="size-4" aria-hidden="true" /> Run investigation</>}
            </Button>
            {createMutation.isError && (
              <p className="text-sm text-[var(--color-danger)]">
                {createMutation.error instanceof Error ? createMutation.error.message : 'Could not run the investigation.'}
              </p>
            )}
          </div>
        </DataCard>

        <DataCard title="Investigation detail" description="Recent investigations are listed at left. Select one to inspect the answer and evidence.">
          {selected ? <InvestigationDetail investigation={selected} /> : (
            <div className="flex flex-col items-center gap-3 py-10 text-center">
              <FileSearch className="size-8 text-[var(--color-muted-fg)]" aria-hidden="true" />
              <p className="text-sm text-[var(--color-muted-fg)]">Run an investigation or pick a recent one to inspect the answer here.</p>
            </div>
          )}
        </DataCard>
      </div>

      <DataCard title="Recent investigations" description="Tenant-scoped investigation history. Results remain read-only and auditable.">
        {investigationsQuery.isLoading ? (
          <p className="text-sm text-[var(--color-muted-fg)]">Loading investigations…</p>
        ) : investigationsQuery.isError ? (
          <p className="text-sm text-[var(--color-danger)]">Could not load investigation history.</p>
        ) : investigations.length === 0 ? (
          <p className="text-sm text-[var(--color-muted-fg)]">No investigations yet. Ask the assistant a specific question to start a read-only analysis.</p>
        ) : (
          <div className="space-y-2">
            {investigations.map((investigation) => (
              <button
                key={investigation.id}
                type="button"
                onClick={() => setSelectedId(investigation.id)}
                className={`w-full rounded-[var(--radius-lg)] border px-4 py-3 text-left transition ${
                  selected?.id === investigation.id
                    ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/5'
                    : 'border-[var(--color-border)] bg-[var(--color-surface-muted)] hover:border-[var(--color-primary)]/40'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">{investigation.question}</p>
                    <p className="mt-1 text-xs text-[var(--color-muted-fg)]">
                      {investigation.citations.length} citation(s) · {investigation.data_sources.join(', ') || 'no sources'} · {formatDate(investigation.created_at)}
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </DataCard>
    </div>
  );
}

function InvestigationDetail({ investigation }: { investigation: IncidentInvestigation }) {
  return (
    <div className="space-y-4">
      <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-4">
        <p className="text-xs uppercase tracking-[0.16em] text-[var(--color-muted-fg)]">Question</p>
        <p className="mt-2 text-base font-medium">{investigation.question}</p>
        <p className="mt-2 text-xs text-[var(--color-muted-fg)]">Created {formatDate(investigation.created_at)}</p>
      </div>

      <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
        <p className="text-xs uppercase tracking-[0.16em] text-[var(--color-muted-fg)]">Answer</p>
        <pre className="mt-3 whitespace-pre-wrap text-sm text-[var(--color-fg)]">{investigation.answer ?? 'No answer returned.'}</pre>
      </div>

      <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
        <div className="flex items-center gap-2">
          <AlertTriangle className="size-4 text-[var(--color-warning)]" aria-hidden="true" />
          <p className="text-sm font-medium">Citations</p>
        </div>
        {investigation.citations.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--color-muted-fg)]">No citations were available for this investigation scope.</p>
        ) : (
          <div className="mt-3 space-y-3">
            {investigation.citations.map((citation) => (
              <div key={`${citation.source}-${citation.id}`} className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-3">
                <p className="text-xs uppercase tracking-[0.14em] text-[var(--color-muted-fg)]">{citation.source}</p>
                <p className="mt-1 text-sm font-medium">{citation.label}</p>
                <p className="mt-1 text-sm text-[var(--color-muted-fg)]">{citation.fact}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
