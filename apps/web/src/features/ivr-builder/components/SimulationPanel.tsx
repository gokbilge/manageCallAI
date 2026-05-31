import { useState } from 'react';
import { ArrowRight, CheckCircle2, FlaskConical, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { FlowSimulationResponse } from '@/lib/ivr-flows/ivr-flows-api';

export type SimulationScenario = {
  digits: string;
  callerNumber: string;
  now: string;
  forceTimeout: boolean;
  forceInvalid: boolean;
};

type Props = {
  result: FlowSimulationResponse | null;
  isLoading: boolean;
  canSimulate: boolean;
  onSimulate: (scenario: SimulationScenario) => void;
  highlightedPath: string[];
};

const DEFAULT_SCENARIO: SimulationScenario = {
  digits: '1',
  callerNumber: '+905551112233',
  now: new Date().toISOString().slice(0, 16),
  forceTimeout: false,
  forceInvalid: false,
};

export function SimulationPanel({ result, isLoading, canSimulate, onSimulate, highlightedPath }: Props) {
  const [scenario, setScenario] = useState<SimulationScenario>(DEFAULT_SCENARIO);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSimulate(scenario);
  };

  return (
    <div className="space-y-5">
      <form onSubmit={handleSubmit} aria-label="Simulation scenario">
        <fieldset disabled={!canSimulate || isLoading} className="space-y-4">
          <legend className="mb-3 text-xs uppercase tracking-[0.1em] text-[var(--color-muted-fg)]">
            Simulation inputs
          </legend>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="DTMF digits" htmlFor="sim-digits">
              <input
                id="sim-digits"
                className={inputCls}
                value={scenario.digits}
                onChange={(e) => setScenario((s) => ({ ...s, digits: e.target.value }))}
                placeholder="1"
                aria-describedby="sim-digits-hint"
              />
              <span id="sim-digits-hint" className="sr-only">Comma-separated digits, e.g. 1,2,3</span>
            </Field>

            <Field label="Caller number" htmlFor="sim-caller">
              <input
                id="sim-caller"
                className={inputCls}
                value={scenario.callerNumber}
                onChange={(e) => setScenario((s) => ({ ...s, callerNumber: e.target.value }))}
                placeholder="+905551112233"
                type="tel"
              />
            </Field>

            <Field label="Scenario time" htmlFor="sim-now" className="sm:col-span-2">
              <input
                id="sim-now"
                className={inputCls}
                value={scenario.now}
                onChange={(e) => setScenario((s) => ({ ...s, now: e.target.value }))}
                type="datetime-local"
              />
            </Field>
          </div>

          <div className="flex flex-wrap gap-4">
            <label className="flex cursor-pointer items-center gap-2 text-sm text-[var(--color-fg)]">
              <input
                type="checkbox"
                checked={scenario.forceTimeout}
                onChange={(e) => setScenario((s) => ({ ...s, forceTimeout: e.target.checked }))}
                className="h-4 w-4 rounded accent-[var(--color-primary)]"
              />
              Force timeout
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-sm text-[var(--color-fg)]">
              <input
                type="checkbox"
                checked={scenario.forceInvalid}
                onChange={(e) => setScenario((s) => ({ ...s, forceInvalid: e.target.checked }))}
                className="h-4 w-4 rounded accent-[var(--color-primary)]"
              />
              Force invalid input
            </label>
          </div>

          <Button
            type="submit"
            disabled={!canSimulate || isLoading}
            aria-disabled={!canSimulate || isLoading}
          >
            <FlaskConical className="size-4" aria-hidden="true" />
            {isLoading ? 'Simulating…' : 'Run Simulation'}
          </Button>

          {!canSimulate && (
            <p className="text-sm text-[var(--color-muted-fg)]" role="note">
              You do not have permission to simulate flows.
            </p>
          )}
        </fieldset>
      </form>

      {result && <SimulationResult result={result} highlightedPath={highlightedPath} />}
    </div>
  );
}

function SimulationResult({
  result,
  highlightedPath,
}: {
  result: FlowSimulationResponse;
  highlightedPath: string[];
}) {
  const passed = result.outcome.status === 'passed';
  const errors = result.outcome.errors as Array<{ field: string; message: string }>;

  return (
    <div className="space-y-4" aria-live="polite">
      <div
        className={`flex items-center gap-3 rounded-[var(--radius-lg)] px-4 py-3 text-sm font-medium ${
          passed
            ? 'bg-[var(--color-success)]/10 text-[var(--color-success)]'
            : 'bg-[var(--color-danger)]/10 text-[var(--color-danger)]'
        }`}
        role="status"
      >
        {passed
          ? <CheckCircle2 className="size-4 shrink-0" aria-hidden="true" />
          : <XCircle className="size-4 shrink-0" aria-hidden="true" />}
        {passed ? 'Simulation passed' : 'Simulation failed'}
      </div>

      {highlightedPath.length > 0 && (
        <div>
          <p className="mb-2 text-xs uppercase tracking-[0.1em] text-[var(--color-muted-fg)]">
            Execution path
          </p>
          <ol className="flex flex-wrap items-center gap-2 text-sm" aria-label="Simulated node path">
            {highlightedPath.map((nodeId, idx) => (
              <li key={`${nodeId}-${idx}`} className="flex items-center gap-2">
                <span className="rounded-full bg-[var(--color-primary)]/10 px-2.5 py-1 font-mono text-xs text-[var(--color-primary)] font-medium">
                  {nodeId}
                </span>
                {idx < highlightedPath.length - 1 && (
                  <ArrowRight className="size-3 shrink-0 text-[var(--color-muted-fg)]" aria-hidden="true" />
                )}
              </li>
            ))}
          </ol>
        </div>
      )}

      {result.outcome.final_action && (
        <div>
          <p className="mb-2 text-xs uppercase tracking-[0.1em] text-[var(--color-muted-fg)]">
            Final action
          </p>
          <pre className="overflow-x-auto rounded-[var(--radius-md)] bg-[#0f172a] p-3 text-xs text-slate-100">
            <code>{JSON.stringify(result.outcome.final_action, null, 2)}</code>
          </pre>
        </div>
      )}

      {errors.length > 0 && (
        <div>
          <p className="mb-2 text-xs uppercase tracking-[0.1em] text-[var(--color-danger)]">
            Simulation errors
          </p>
          <ul className="space-y-2" aria-label="Simulation errors">
            {errors.map((err, idx) => (
              <li
                key={idx}
                className="rounded-[var(--radius-md)] bg-[var(--color-danger)]/8 px-3 py-2 text-sm"
              >
                <p className="font-medium text-[var(--color-danger)]">{err.message}</p>
                {err.field && (
                  <p className="mt-0.5 font-mono text-xs text-[var(--color-muted-fg)]">{err.field}</p>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  htmlFor,
  children,
  className = '',
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label htmlFor={htmlFor} className={`block space-y-1.5 ${className}`}>
      <span className="text-xs uppercase tracking-[0.1em] text-[var(--color-muted-fg)]">{label}</span>
      {children}
    </label>
  );
}

const inputCls =
  'w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm outline-none transition focus:border-[var(--color-focus)] focus:ring-2 focus:ring-[var(--color-focus)]/20 disabled:opacity-50 disabled:cursor-not-allowed';
