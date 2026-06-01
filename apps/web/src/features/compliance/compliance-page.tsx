import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Lock, Unlock, RefreshCcw, ShieldCheck } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '@/components/layout/page-header';
import { DataCard } from '@/components/data/data-card';
import { Button } from '@/components/ui/button';
import {
  useRetentionPolicy,
  useUpdateRetentionPolicy,
  useLegalHolds,
  useCreateLegalHold,
  useReleaseLegalHold,
  type LegalHold,
  type TenantRetentionPolicy,
  type CreateLegalHoldInput,
} from '@/lib/compliance/compliance-api';

const inputClass =
  'w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--color-tenant)]/40';

export function CompliancePage() {
  const qc = useQueryClient();
  const refreshMutation = useMutation({
    mutationFn: async () => {
      await qc.invalidateQueries({ queryKey: ['retention-policy'] });
      await qc.invalidateQueries({ queryKey: ['legal-holds'] });
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Tenant Workspace"
        title="Compliance & Retention"
        description="Configure data retention periods and manage legal holds. Legal holds prevent data purge regardless of retention schedule."
        actions={(
          <Button onClick={() => void refreshMutation.mutateAsync()} variant="secondary">
            <RefreshCcw className="size-4" aria-hidden="true" />
            Refresh
          </Button>
        )}
      />

      <div className="grid gap-6 xl:grid-cols-2">
        <RetentionPolicyCard />
        <LegalHoldsCard />
      </div>
    </div>
  );
}

function RetentionPolicyCard() {
  const policyQuery = useRetentionPolicy();
  const update = useUpdateRetentionPolicy();
  const form = useForm<{
    recording_retention_days: string;
    transcript_retention_days: string;
    cdr_retention_days: string;
  }>();

  function handleSubmit(data: { recording_retention_days: string; transcript_retention_days: string; cdr_retention_days: string }) {
    const parse = (v: string) => (v.trim() === '' ? null : Number.parseInt(v, 10));
    void update.mutateAsync({
      recording_retention_days: parse(data.recording_retention_days),
      transcript_retention_days: parse(data.transcript_retention_days),
      cdr_retention_days: parse(data.cdr_retention_days),
    });
  }

  function daysLabel(policy: TenantRetentionPolicy | null | undefined, field: keyof Pick<TenantRetentionPolicy, 'recording_retention_days' | 'transcript_retention_days' | 'cdr_retention_days'>) {
    const v = policy?.[field];
    return v == null ? 'Indefinite (keep forever)' : `${v} days`;
  }

  return (
    <DataCard
      title="Retention Policy"
      description="Set how long recordings, transcripts, and CDRs are retained. Leave empty for indefinite retention (safe compliance default)."
    >
      {policyQuery.isLoading ? (
        <p className="text-sm text-[var(--color-muted-fg)]">Loading policy…</p>
      ) : policyQuery.isError ? (
        <ErrorState message="Could not load retention policy." />
      ) : (
        <>
          {policyQuery.data && (
            <div className="mb-4 space-y-1 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3 py-3 text-xs text-[var(--color-muted-fg)]">
              <p>Recordings: <span className="font-medium text-[var(--color-fg)]">{daysLabel(policyQuery.data, 'recording_retention_days')}</span></p>
              <p>Transcripts: <span className="font-medium text-[var(--color-fg)]">{daysLabel(policyQuery.data, 'transcript_retention_days')}</span></p>
              <p>CDRs: <span className="font-medium text-[var(--color-fg)]">{daysLabel(policyQuery.data, 'cdr_retention_days')}</span></p>
            </div>
          )}

          <form
            onSubmit={(e) => { e.preventDefault(); void form.handleSubmit(handleSubmit)(e); }}
            className="space-y-3"
          >
            {([
              ['recording_retention_days', 'Recording retention (days)'],
              ['transcript_retention_days', 'Transcript retention (days)'],
              ['cdr_retention_days', 'CDR retention (days)'],
            ] as const).map(([field, label]) => (
              <div key={field}>
                <label className="mb-1 block text-xs font-medium text-[var(--color-muted-fg)]">{label}</label>
                <input
                  type="number"
                  min={1}
                  className={inputClass}
                  placeholder="Leave empty for indefinite"
                  {...form.register(field)}
                />
              </div>
            ))}
            <Button type="submit" disabled={update.isPending}>
              {update.isPending ? 'Saving…' : 'Save Policy'}
            </Button>
          </form>
        </>
      )}
    </DataCard>
  );
}

function LegalHoldsCard() {
  const [showForm, setShowForm] = useState(false);
  const holdsQuery = useLegalHolds('active');
  const create = useCreateLegalHold();
  const release = useReleaseLegalHold();
  const form = useForm<CreateLegalHoldInput>();

  function handleCreate(data: CreateLegalHoldInput) {
    void create.mutateAsync(data).then(() => {
      form.reset();
      setShowForm(false);
    });
  }

  return (
    <DataCard
      title="Legal Holds"
      description="Active holds prevent data purge even after the retention period expires."
    >
      <div className="mb-3 flex justify-between">
        <span className="text-xs text-[var(--color-muted-fg)]">Showing active holds</span>
        <Button variant="secondary" onClick={() => setShowForm((v) => !v)}>
          {showForm ? 'Cancel' : '+ New Hold'}
        </Button>
      </div>

      {showForm && (
        <form
          onSubmit={(e) => { e.preventDefault(); void form.handleSubmit(handleCreate)(e); }}
          className="mb-4 space-y-3 rounded-[var(--radius-lg)] border border-[var(--color-border)] p-4"
        >
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--color-muted-fg)]">Resource type</label>
            <select className={inputClass} {...form.register('resource_type', { required: true })}>
              <option value="recording">Recording</option>
              <option value="transcript">Transcript</option>
              <option value="cdr">CDR</option>
              <option value="all">All</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--color-muted-fg)]">Case reference</label>
            <input className={inputClass} placeholder="CASE-001 (optional)" {...form.register('case_reference')} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--color-muted-fg)]">Reason *</label>
            <input className={inputClass} placeholder="Regulatory hold…" {...form.register('reason', { required: true })} />
          </div>
          <Button type="submit" disabled={create.isPending}>
            {create.isPending ? 'Creating…' : 'Create Hold'}
          </Button>
        </form>
      )}

      {holdsQuery.isLoading ? (
        <p className="text-sm text-[var(--color-muted-fg)]">Loading holds…</p>
      ) : holdsQuery.isError ? (
        <ErrorState message="Could not load legal holds." />
      ) : holdsQuery.data && holdsQuery.data.length > 0 ? (
        <ul className="space-y-2">
          {holdsQuery.data.map((hold) => (
            <HoldRow
              key={hold.id}
              hold={hold}
              onRelease={() => void release.mutateAsync(hold.id)}
              isPending={release.isPending}
            />
          ))}
        </ul>
      ) : (
        <EmptyState
          title="No active holds"
          description="No legal holds are currently active. Create a hold to prevent data purge."
        />
      )}
    </DataCard>
  );
}

function HoldRow({ hold, onRelease, isPending }: { hold: LegalHold; onRelease: () => void; isPending: boolean }) {
  return (
    <li className="flex items-start justify-between gap-2 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3 py-2 text-sm">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <Lock className="size-4 shrink-0 text-[var(--color-warning)]" aria-hidden="true" />
          <p className="truncate font-medium">{hold.case_reference ?? hold.reason}</p>
          <span className="rounded-full bg-[var(--color-warning)]/10 px-2 py-0.5 text-xs font-medium text-[var(--color-warning)]">
            {hold.resource_type}
          </span>
        </div>
        <p className="mt-0.5 text-xs text-[var(--color-muted-fg)]">
          {hold.reason} · Created {new Date(hold.created_at).toLocaleDateString()}
        </p>
      </div>
      {hold.status === 'active' && (
        <Button
          variant="secondary"
          disabled={isPending}
          onClick={onRelease}
          aria-label={`Release hold ${hold.case_reference ?? hold.id}`}
        >
          <Unlock className="size-3" aria-hidden="true" />
        </Button>
      )}
    </li>
  );
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-[var(--radius-lg)] bg-[var(--color-surface-muted)] px-4 py-6 text-sm text-[var(--color-muted-fg)]">
      <div className="flex items-center gap-2">
        <ShieldCheck className="size-4 text-[var(--color-success)]" aria-hidden="true" />
        <p className="font-medium text-[var(--color-fg)]">{title}</p>
      </div>
      <p className="mt-2">{description}</p>
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-danger)]/20 bg-[var(--color-danger)]/10 px-4 py-6 text-sm text-[var(--color-danger)]">
      {message}
    </div>
  );
}
