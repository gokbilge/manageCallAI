import { BrainCircuit, FileText, ShieldAlert, Sparkles } from 'lucide-react';
import { StatusBadge } from '@/components/ui/status-badge';
import type { SummaryReview } from '@/lib/ai/summary-review-api';
import { outputStatusLabel, reasonLabel, sourceModeLabel, statusLabel } from '@/lib/ai/summary-review-api';

export function SummaryReviewPanel({
  review,
  isLoading,
  error,
  emptyMessage,
}: {
  review: SummaryReview | null | undefined;
  isLoading: boolean;
  error: string | null;
  emptyMessage: string;
}) {
  if (isLoading) {
    return <p className="text-sm text-[var(--color-muted-fg)]">Loading AI review...</p>;
  }

  if (error) {
    return (
      <div className="rounded-[var(--radius-lg)] border border-[var(--color-error)]/20 bg-[var(--color-error)]/10 px-4 py-4 text-sm text-[var(--color-error)]">
        {error}
      </div>
    );
  }

  if (!review) {
    return <p className="text-sm text-[var(--color-muted-fg)]">{emptyMessage}</p>;
  }

  const transcriptMessage = review.transcript_access === 'restricted'
    ? 'Transcript access requires compliance scope.'
    : review.transcript_access === 'unavailable'
      ? 'Transcript text is not available for review.'
      : null;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Fact label="AI review state" value={statusLabel(review)} icon={BrainCircuit} />
        <Fact label="Summary source" value={sourceModeLabel(review)} icon={Sparkles} />
        <Fact label="Summary lifecycle" value={outputStatusLabel(review.summary_status)} icon={Sparkles} />
        <Fact label="Transcript lifecycle" value={outputStatusLabel(review.transcript_status)} icon={FileText} />
        <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-4 py-3">
          <p className="text-xs text-[var(--color-muted-fg)]">Transcript access</p>
          <div className="mt-2 flex items-center justify-between gap-3">
            <p className="text-sm font-medium capitalize">{review.transcript_access}</p>
            <StatusBadge
              status={review.transcript_access === 'granted' ? 'active' : review.transcript_access === 'restricted' ? 'inactive' : 'pending'}
            />
          </div>
        </div>
      </div>

      {reasonLabel(review.reason) ? (
        <div className="rounded-[var(--radius-lg)] border border-[var(--color-warning)]/20 bg-[var(--color-warning)]/10 px-4 py-4 text-sm text-[var(--color-warning)]">
          {reasonLabel(review.reason)}
        </div>
      ) : null}

      <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-4 py-4">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Sparkles className="size-4 text-[var(--color-tenant)]" aria-hidden="true" />
          Summary
        </div>
        <p className="mt-3 text-sm leading-6 text-[var(--color-fg)]">
          {review.summary_text ?? 'No summary is currently available for this recording or voicemail path.'}
        </p>
      </div>

      <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-4 py-4">
        <div className="flex items-center gap-2 text-sm font-medium">
          <FileText className="size-4 text-[var(--color-info)]" aria-hidden="true" />
          Transcript
        </div>
        {review.transcript_text ? (
          <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-[var(--color-fg)]">{review.transcript_text}</p>
        ) : (
          <div className="mt-3 flex items-start gap-2 text-sm text-[var(--color-muted-fg)]">
            <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span>{transcriptMessage ?? 'No transcript is currently available for this review.'}</span>
          </div>
        )}
      </div>
    </div>
  );
}

function Fact({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: typeof BrainCircuit;
}) {
  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-4 py-3">
      <div className="flex items-center gap-2 text-xs text-[var(--color-muted-fg)]">
        <Icon className="size-4" aria-hidden="true" />
        {label}
      </div>
      <p className="mt-2 text-sm font-medium">{value}</p>
    </div>
  );
}
