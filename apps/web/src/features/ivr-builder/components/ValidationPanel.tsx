import { AlertTriangle, CheckCircle2, Info } from 'lucide-react';
import type { FlowValidationResponse } from '@/lib/ivr-flows/ivr-flows-api';

type Props = {
  result: FlowValidationResponse | null;
  isLoading: boolean;
};

type Issue = { field: string; message: string };

export function ValidationPanel({ result, isLoading }: Props) {
  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-[var(--color-muted-fg)]" aria-live="polite">
        <span className="size-4 animate-spin rounded-full border-2 border-[var(--color-border)] border-t-[var(--color-primary)]" aria-hidden="true" />
        Validating draft…
      </div>
    );
  }

  if (!result) {
    return (
      <p className="text-sm text-[var(--color-muted-fg)]">
        No validation result yet. Save the draft, then run <strong>Validate</strong>.
      </p>
    );
  }

  const { status, errors, warnings } = result.outcome;
  const passed = status === 'passed';
  const errorList = errors as Issue[];
  const warnList = (warnings ?? []) as Issue[];

  return (
    <div className="space-y-4" aria-live="polite">
      <div
        className={`flex items-center gap-3 rounded-[var(--radius-lg)] px-4 py-3 text-sm font-medium ${
          passed
            ? 'bg-[var(--color-success)]/10 text-[var(--color-success)]'
            : 'bg-[var(--color-danger)]/10 text-[var(--color-danger)]'
        }`}
        role="status"
        aria-label={passed ? 'Validation passed' : `Validation failed with ${errorList.length} error(s)`}
      >
        {passed ? <CheckCircle2 className="size-4 shrink-0" aria-hidden="true" /> : <AlertTriangle className="size-4 shrink-0" aria-hidden="true" />}
        {passed ? 'Validation passed' : `${errorList.length} error${errorList.length !== 1 ? 's' : ''} found`}
      </div>

      {errorList.length > 0 && (
        <IssueList issues={errorList} kind="error" />
      )}

      {warnList.length > 0 && (
        <IssueList issues={warnList} kind="warning" />
      )}

      {passed && errorList.length === 0 && warnList.length === 0 && (
        <p className="text-sm text-[var(--color-muted-fg)]">All checks passed. Flow is ready to simulate or publish.</p>
      )}
    </div>
  );
}

function IssueList({ issues, kind }: { issues: Issue[]; kind: 'error' | 'warning' }) {
  const isError = kind === 'error';
  const color = isError ? 'var(--color-danger)' : 'var(--color-warning)';
  const label = isError ? 'Errors' : 'Warnings';

  return (
    <div>
      <p
        className="mb-2 flex items-center gap-1.5 text-xs uppercase tracking-[0.1em]"
        style={{ color }}
      >
        {isError ? <AlertTriangle className="size-3" aria-hidden="true" /> : <Info className="size-3" aria-hidden="true" />}
        {label}
      </p>
      <ul className="space-y-2" aria-label={label}>
        {issues.map((issue, idx) => (
          <li
            key={`${kind}-${idx}`}
            className="rounded-[var(--radius-md)] border px-3 py-2 text-sm"
            style={{
              borderColor: `color-mix(in srgb, ${color} 25%, transparent)`,
              backgroundColor: `color-mix(in srgb, ${color} 8%, transparent)`,
            }}
          >
            <p
              className="font-medium"
              style={{ color }}
            >
              {issue.message}
            </p>
            {issue.field && (
              <p className="mt-0.5 font-mono text-xs text-[var(--color-muted-fg)]">{issue.field}</p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
