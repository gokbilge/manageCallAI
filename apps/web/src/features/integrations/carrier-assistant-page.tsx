import { useState } from 'react';
import { Bot, Loader2, RefreshCcw, ServerCog } from 'lucide-react';
import { DataCard } from '@/components/data/data-card';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { useCarrierAssistantSuggestion } from '@/lib/sip-trunks/carrier-assistant-api';
import { useSipTrunks } from '@/lib/sip-trunks/sip-trunks-api';

export function CarrierAssistantPage() {
  const trunksQuery = useSipTrunks();
  const assistantMutation = useCarrierAssistantSuggestion();
  const [trunkId, setTrunkId] = useState('');
  const [intent, setIntent] = useState('');

  const suggestion = assistantMutation.data?.data ?? null;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Integrations"
        title="Carrier Configuration Assistant"
        description="Generate a draft-only SIP trunk suggestion from a carrier brief. The assistant never saves secrets, never applies changes, and always routes the operator back through the standard trunk lifecycle."
        actions={
          <Button variant="secondary" onClick={() => trunksQuery.refetch()}>
            <RefreshCcw className="size-4" aria-hidden="true" />
            Refresh trunks
          </Button>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[24rem_minmax(0,1fr)]">
        <DataCard title="Carrier brief" description="Describe the carrier requirements or select an existing trunk to update.">
          <div className="space-y-4">
            <select
              value={trunkId}
              onChange={(event) => setTrunkId(event.target.value)}
              className="w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-tenant)]"
            >
              <option value="">Create a new draft</option>
              {(trunksQuery.data ?? []).map((trunk) => (
                <option key={trunk.id} value={trunk.id}>{trunk.name}</option>
              ))}
            </select>
            <textarea
              value={intent}
              onChange={(event) => setIntent(event.target.value)}
              placeholder="Set up a Telnyx TLS trunk on port 5061 using sip.telnyx.example and auth username ops-carrier"
              className="min-h-36 w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-tenant)]"
            />
            <Button
              onClick={() => assistantMutation.mutate({ intent, trunk_id: trunkId || undefined })}
              disabled={intent.trim().length === 0 || assistantMutation.isPending}
              className="w-full"
            >
              {assistantMutation.isPending ? <><Loader2 className="size-4 animate-spin" aria-hidden="true" /> Generating draft…</> : <><Bot className="size-4" aria-hidden="true" /> Suggest draft</>}
            </Button>
            {assistantMutation.isError && (
              <p className="text-sm text-[var(--color-danger)]">
                {assistantMutation.error instanceof Error ? assistantMutation.error.message : 'Could not build a carrier draft.'}
              </p>
            )}
          </div>
        </DataCard>

        <DataCard title="Draft suggestion" description="Review assumptions, missing fields, validation errors, and next steps before using the normal SIP trunk workflow.">
          {suggestion ? <SuggestionDetail /> : (
            <div className="flex flex-col items-center gap-3 py-10 text-center">
              <ServerCog className="size-8 text-[var(--color-muted-fg)]" aria-hidden="true" />
              <p className="text-sm text-[var(--color-muted-fg)]">Ask for a carrier draft to see the suggested configuration, gaps, and validation checklist here.</p>
            </div>
          )}
        </DataCard>
      </div>
    </div>
  );

  function SuggestionDetail() {
    if (!suggestion) return null;

    return (
      <div className="space-y-4">
        {suggestion.matched_template && (
          <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-[var(--color-muted-fg)]">Matched template</p>
            <p className="mt-2 text-sm font-medium">{suggestion.matched_template}</p>
          </div>
        )}
        <div className="grid gap-3 md:grid-cols-2">
          {Object.entries(suggestion.suggested_config).map(([key, value]) => (
            <div key={key} className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3 py-3">
              <p className="text-xs text-[var(--color-muted-fg)]">{key}</p>
              <p className="mt-1 text-sm font-medium">{Array.isArray(value) ? value.join(', ') : value ?? '—'}</p>
            </div>
          ))}
        </div>

        <Section title="Missing fields" items={suggestion.missing_fields.map((item) => `${item.field}: ${item.reason}`)} empty="No missing fields beyond the operator-entered secret." />
        <Section title="Assumptions" items={suggestion.assumptions} empty="No additional assumptions were needed." />
        <Section title="Warnings" items={suggestion.warnings} empty="No extra warnings were raised." />
        <Section title="Validation errors" items={suggestion.validation_errors} empty="No validation errors beyond operator-entered secrets." />
        <Section title="Validation checks" items={suggestion.validation_checks.map((item) => `${item.code}: ${item.description} (${item.status})`)} empty="No validation checks returned." />
        <Section title="Next steps" items={suggestion.next_steps} empty="No next steps returned." />

        {suggestion.runtime_hint && (
          <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-4">
            <p className="text-sm font-medium">Runtime hint</p>
            <p className="mt-2 text-sm text-[var(--color-muted-fg)]">
              Gateway state: {suggestion.runtime_hint.gateway_state ?? 'no data'} · latest apply: {suggestion.runtime_hint.latest_apply_status ?? 'none'}
            </p>
            {suggestion.runtime_hint.latest_apply_error && (
              <p className="mt-2 text-sm text-[var(--color-danger)]">{suggestion.runtime_hint.latest_apply_error}</p>
            )}
          </div>
        )}
      </div>
    );
  }
}

function Section({ title, items, empty }: { title: string; items: string[]; empty: string }) {
  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <p className="text-sm font-medium">{title}</p>
      {items.length === 0 ? (
        <p className="mt-2 text-sm text-[var(--color-muted-fg)]">{empty}</p>
      ) : (
        <div className="mt-3 space-y-2">
          {items.map((item) => (
            <div key={item} className="rounded-[var(--radius-md)] bg-[var(--color-surface-muted)] px-3 py-2 text-sm text-[var(--color-muted-fg)]">
              {item}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
