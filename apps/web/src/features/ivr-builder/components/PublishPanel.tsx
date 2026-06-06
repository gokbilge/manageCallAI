import { Clock, Rocket, RotateCcw, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { FlowPublishResponse, FlowSimulationResponse, FlowValidationResponse, FlowVersion } from '@/lib/ivr-flows/ivr-flows-api';

type Props = {
  draftVersion: FlowVersion | undefined;
  validationResult: FlowValidationResponse | null;
  simulationResult: FlowSimulationResponse | null;
  publishResult: FlowPublishResponse | null;
  rollbackResult: FlowPublishResponse | null;
  isPublishing: boolean;
  isRollingBack: boolean;
  canPublish: boolean;
  canRollback: boolean;
  hasActiveVersion: boolean;
  onPublish: () => void;
  onRollback: () => void;
};

export function PublishPanel({
  draftVersion,
  validationResult,
  simulationResult,
  publishResult,
  rollbackResult,
  isPublishing,
  isRollingBack,
  canPublish,
  canRollback,
  hasActiveVersion,
  onPublish,
  onRollback,
}: Props) {
  const draftState = draftVersion?.state;
  const isPublishable = draftState === 'validated' || draftState === 'simulated';
  const validationPassed = validationResult?.outcome.status === 'passed';
  const simulationPassed = simulationResult?.outcome.status === 'passed';
  const aiSuggested = readAiLineage(draftVersion?.metadata);

  const publishBlocked = !isPublishable;
  const publishDisabled = !canPublish || publishBlocked || isPublishing;

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <p className="text-xs uppercase tracking-[0.1em] text-[var(--color-muted-fg)]">Pre-publish checklist</p>

        <ChecklistItem
          done={validationPassed}
          pending={!validationResult}
          label="Graph validation"
          hint={!validationResult ? 'Run Validate to check the draft.' : undefined}
        />
        <ChecklistItem
          done={simulationPassed}
          pending={!simulationResult}
          label="Simulation run"
          hint={!simulationResult ? 'Run a simulation scenario first.' : undefined}
        />
        <ChecklistItem
          done={isPublishable}
          pending={!draftVersion}
          label={`Draft state: ${draftState ?? 'unknown'}`}
          hint={
            !isPublishable && draftState
              ? `Draft must be validated or simulated (current: ${draftState}).`
              : undefined
          }
        />
        {aiSuggested ? (
          <ChecklistItem
            done={false}
            pending={false}
            label="Human approval required for AI-suggested draft"
            hint="AI-originated changes always enter the approval queue before they can become active."
          />
        ) : null}
      </div>

      {publishResult?.status === 'pending_approval' ? (
        <div
          className="flex items-start gap-3 rounded-[var(--radius-lg)] bg-[var(--color-warning)]/10 px-4 py-3 text-sm"
          role="status"
          aria-live="polite"
        >
          <Clock className="mt-0.5 size-4 shrink-0 text-[var(--color-warning)]" aria-hidden="true" />
          <div>
            <p className="font-medium text-[var(--color-warning)]">Awaiting approval</p>
            <p className="mt-0.5 font-mono text-xs text-[var(--color-muted-fg)]">
              {publishResult.approval_request_id}
            </p>
            <p className="mt-1 text-[var(--color-muted-fg)]">
              A human approver must approve before this version becomes active.
            </p>
          </div>
        </div>
      ) : rollbackResult?.status === 'pending_approval' ? (
        <div
          className="flex items-start gap-3 rounded-[var(--radius-lg)] bg-[var(--color-warning)]/10 px-4 py-3 text-sm"
          role="status"
          aria-live="polite"
        >
          <Clock className="mt-0.5 size-4 shrink-0 text-[var(--color-warning)]" aria-hidden="true" />
          <div>
            <p className="font-medium text-[var(--color-warning)]">Rollback awaiting approval</p>
            <p className="mt-0.5 font-mono text-xs text-[var(--color-muted-fg)]">
              {rollbackResult.approval_request_id}
            </p>
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <Button
          onClick={onPublish}
          disabled={publishDisabled}
          aria-disabled={publishDisabled}
        >
          <Rocket className="size-4" aria-hidden="true" />
          {isPublishing ? 'Publishing…' : 'Publish Draft'}
        </Button>

        {hasActiveVersion && (
          <Button
            onClick={onRollback}
            disabled={!canRollback || isRollingBack}
            aria-disabled={!canRollback || isRollingBack}
            variant="secondary"
          >
            <RotateCcw className="size-4" aria-hidden="true" />
            {isRollingBack ? 'Rolling back…' : 'Rollback'}
          </Button>
        )}
      </div>

      {publishBlocked && draftVersion && (
        <div
          className="flex items-start gap-2 text-sm text-[var(--color-muted-fg)]"
          role="note"
          aria-label="Publish is blocked"
        >
          <ShieldAlert className="mt-0.5 size-4 shrink-0 text-[var(--color-warning)]" aria-hidden="true" />
          Validate and simulate the draft before publishing. Publish remains backend-enforced even if these checks are bypassed.
        </div>
      )}

      {!canPublish && (
        <p className="text-sm text-[var(--color-muted-fg)]" role="note">
          Your role does not have publish permission. An admin or operator must publish this flow.
        </p>
      )}
    </div>
  );
}

function readAiLineage(metadata: Record<string, unknown> | null | undefined) {
  const lineage = metadata?.ai_lineage;
  if (!lineage || typeof lineage !== 'object') {
    return null;
  }

  return (lineage as Record<string, unknown>).ai_assisted === true ? lineage : null;
}

function ChecklistItem({
  done,
  pending,
  label,
  hint,
}: {
  done: boolean;
  pending: boolean;
  label: string;
  hint?: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <span
        className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
          done
            ? 'bg-[var(--color-success)] text-white'
            : pending
              ? 'bg-[var(--color-border)] text-[var(--color-muted-fg)]'
              : 'bg-[var(--color-warning)]/20 text-[var(--color-warning)]'
        }`}
        aria-hidden="true"
      >
        {done ? '✓' : pending ? '–' : '!'}
      </span>
      <div>
        <p className={`text-sm ${done ? 'text-[var(--color-fg)]' : 'text-[var(--color-muted-fg)]'}`}>
          {label}
        </p>
        {hint && (
          <p className="mt-0.5 text-xs text-[var(--color-muted-fg)]">{hint}</p>
        )}
      </div>
    </div>
  );
}
