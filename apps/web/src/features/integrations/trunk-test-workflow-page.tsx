import { useCallback, useRef, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle,
  HelpCircle,
  Loader2,
  PlayCircle,
  RefreshCcw,
  ShieldAlert,
  XCircle,
} from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { DataCard } from '@/components/data/data-card';
import { Button } from '@/components/ui/button';
import { useGatewayStatus, useSipTrunks } from '@/lib/sip-trunks/sip-trunks-api';

// ── Types ─────────────────────────────────────────────────────────────────────

type TestOutcome = 'passed' | 'failed' | 'in_progress' | 'unknown';

type TestRecord = {
  id: string;
  trunkId: string;
  trunkName: string;
  outcome: TestOutcome;
  gatewayState: string | null;
  testedAt: string;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function resolveOutcome(state: string | null | undefined): TestOutcome {
  if (!state) return 'unknown';
  const s = state.toUpperCase();
  if (s === 'REGED') return 'passed';
  if (s === 'DOWN' || s === 'FAILED') return 'failed';
  if (s === 'TRYING' || s === 'REGISTER') return 'in_progress';
  return 'unknown';
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  return `${Math.floor(m / 60)}h ago`;
}

function outcomeLabel(outcome: TestOutcome): string {
  return { passed: 'Passed', failed: 'Failed', in_progress: 'In progress', unknown: 'No data' }[outcome];
}

// ── Outcome icon ──────────────────────────────────────────────────────────────

function OutcomeIcon({ outcome }: { outcome: TestOutcome }) {
  if (outcome === 'passed') return <CheckCircle className="size-5 text-[var(--color-success)]" aria-hidden="true" />;
  if (outcome === 'failed') return <XCircle className="size-5 text-[var(--color-error)]" aria-hidden="true" />;
  if (outcome === 'in_progress') return <Loader2 className="size-5 animate-spin text-[var(--color-warning)]" aria-hidden="true" />;
  return <HelpCircle className="size-5 text-[var(--color-muted-fg)]" aria-hidden="true" />;
}

function outcomeColor(outcome: TestOutcome): string {
  if (outcome === 'passed') return 'text-[var(--color-success)]';
  if (outcome === 'failed') return 'text-[var(--color-error)]';
  if (outcome === 'in_progress') return 'text-[var(--color-warning)]';
  return 'text-[var(--color-muted-fg)]';
}

// ── Failure guidance ──────────────────────────────────────────────────────────

function FailureGuidance({ outcome, gatewayState }: { outcome: TestOutcome; gatewayState: string | null }) {
  if (outcome === 'passed') {
    return (
      <div className="rounded-[var(--radius-lg)] border border-[var(--color-success)]/30 bg-[var(--color-success)]/5 px-4 py-3 text-sm">
        <p className="font-medium text-[var(--color-success)]">Trunk is registered and reachable</p>
        <p className="mt-1 text-[var(--color-muted-fg)]">
          FreeSWITCH has an active registration with the carrier. Inbound and outbound call paths are ready.
        </p>
      </div>
    );
  }

  if (outcome === 'in_progress') {
    return (
      <div className="rounded-[var(--radius-lg)] border border-[var(--color-warning)]/30 bg-[var(--color-warning)]/5 px-4 py-3 text-sm">
        <p className="font-medium text-[var(--color-warning)]">Registration in progress ({gatewayState ?? 'TRYING'})</p>
        <ul className="mt-2 space-y-1 text-[var(--color-muted-fg)]">
          <li>· Wait 30 seconds and re-run the test — SIP REGISTER typically completes within 10 s.</li>
          <li>· If this persists, check the SIP proxy host and port are reachable from the FreeSWITCH server.</li>
          <li>· Review the Apply Request history on the SIP Trunks page for any gateway apply errors.</li>
        </ul>
      </div>
    );
  }

  if (outcome === 'failed') {
    return (
      <div className="rounded-[var(--radius-lg)] border border-[var(--color-error)]/30 bg-[var(--color-error)]/5 px-4 py-3 text-sm">
        <div className="flex items-start gap-2">
          <ShieldAlert className="mt-0.5 size-4 shrink-0 text-[var(--color-error)]" aria-hidden="true" />
          <div>
            <p className="font-medium text-[var(--color-error)]">Trunk is {gatewayState ?? 'DOWN'} — registration failed</p>
            <p className="mt-1 text-[var(--color-muted-fg)]">Possible causes and remediation steps:</p>
            <ul className="mt-2 space-y-1 text-[var(--color-muted-fg)]">
              <li>· Verify the realm, proxy host, and port match your carrier's SIP configuration.</li>
              <li>· Confirm auth username and password are correct — check the carrier portal for recently rotated credentials.</li>
              <li>· Ensure the FreeSWITCH server's public IP is allowed by the carrier's IP allowlist.</li>
              <li>· Check if NAT traversal is required and whether the <code>ext-rtp-ip</code> is configured correctly.</li>
              <li>· Review the Apply Request history on the SIP Trunks page — any recent apply failures indicate the gateway configuration was not pushed correctly.</li>
              <li>· Run <code>sofia status gateway &lt;trunk-name&gt;</code> on the FreeSWITCH console for the raw SIP trace.</li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-4 py-3 text-sm">
      <p className="font-medium text-[var(--color-fg)]">No runtime data for this trunk</p>
      <ul className="mt-2 space-y-1 text-[var(--color-muted-fg)]">
        <li>· Confirm the FreeSWITCH agent is running and reporting status snapshots to the API.</li>
        <li>· If the trunk was just created, allow 60 seconds for the gateway to appear in FreeSWITCH after the apply request completes.</li>
        <li>· Check the Apply Request history on the SIP Trunks page to ensure the gateway configuration was pushed successfully.</li>
      </ul>
    </div>
  );
}

// ── Test result card ──────────────────────────────────────────────────────────

function TestResultCard({ result }: { result: TestRecord }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3">
        <OutcomeIcon outcome={result.outcome} />
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-semibold ${outcomeColor(result.outcome)}`}>
            {outcomeLabel(result.outcome)}
          </p>
          <p className="text-xs text-[var(--color-muted-fg)]">
            Gateway state: <span className="font-mono font-medium">{result.gatewayState ?? 'no data'}</span>
            {' · '}tested {relativeTime(result.testedAt)}
          </p>
        </div>
      </div>
      <FailureGuidance outcome={result.outcome} gatewayState={result.gatewayState} />
    </div>
  );
}

// ── History table ─────────────────────────────────────────────────────────────

function HistoryTable({ records }: { records: TestRecord[] }) {
  if (records.length === 0) {
    return (
      <p className="text-sm text-[var(--color-muted-fg)]">No tests run yet in this session.</p>
    );
  }

  return (
    <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border)]">
      <table className="w-full text-left text-xs">
        <thead className="bg-[var(--color-surface-muted)] text-[var(--color-muted-fg)]">
          <tr>
            <th className="px-3 py-1.5 font-medium">Trunk</th>
            <th className="px-3 py-1.5 font-medium">Outcome</th>
            <th className="px-3 py-1.5 font-medium">Gateway state</th>
            <th className="px-3 py-1.5 font-medium">Tested</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--color-border)] bg-[var(--color-surface)]">
          {records.map((r) => (
            <tr key={r.id}>
              <td className="px-3 py-1.5 font-medium">{r.trunkName}</td>
              <td className={`px-3 py-1.5 font-semibold ${outcomeColor(r.outcome)}`}>
                <span className="flex items-center gap-1.5">
                  <OutcomeIcon outcome={r.outcome} />
                  {outcomeLabel(r.outcome)}
                </span>
              </td>
              <td className="px-3 py-1.5 font-mono text-[var(--color-muted-fg)]">{r.gatewayState ?? '—'}</td>
              <td className="px-3 py-1.5 text-[var(--color-muted-fg)]">{relativeTime(r.testedAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function TrunkTestWorkflowPage() {
  const trunksQuery = useSipTrunks();
  const gatewayQuery = useGatewayStatus();

  const [selectedTrunkId, setSelectedTrunkId] = useState<string>('');
  const [isRunning, setIsRunning] = useState(false);
  const [lastResult, setLastResult] = useState<TestRecord | null>(null);
  const [history, setHistory] = useState<TestRecord[]>([]);
  const idRef = useRef(0);

  const activeTrunks = (trunksQuery.data ?? []).filter(t => t.status === 'active');
  const selectedTrunk = activeTrunks.find(t => t.id === selectedTrunkId) ?? null;

  const runTest = useCallback(async () => {
    if (!selectedTrunk) return;
    setIsRunning(true);
    try {
      const result = await gatewayQuery.refetch();
      const entries = result.data ?? [];
      const trunkEntries = entries.filter(e => e.trunk_id === selectedTrunk.id);
      const latestState = trunkEntries[0]?.state ?? null;
      const record: TestRecord = {
        id: String(++idRef.current),
        trunkId: selectedTrunk.id,
        trunkName: selectedTrunk.name,
        outcome: resolveOutcome(latestState),
        gatewayState: latestState,
        testedAt: new Date().toISOString(),
      };
      setLastResult(record);
      setHistory(prev => [record, ...prev].slice(0, 20));
    } finally {
      setIsRunning(false);
    }
  }, [selectedTrunk, gatewayQuery]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Integrations"
        title="Carrier & Trunk Test Workflow"
        description="Run connectivity checks against registered SIP trunks. Results reflect the live FreeSWITCH gateway state and include actionable remediation guidance for each failure mode."
        actions={
          <Button variant="secondary" onClick={() => void gatewayQuery.refetch()}>
            <RefreshCcw className="size-4" aria-hidden="true" />
            Refresh states
          </Button>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[1fr_1.4fr]">
        {/* Trunk selector + run panel */}
        <DataCard
          title="Select trunk to test"
          description="Choose an active SIP trunk and run the first-party connectivity check. The test reads the live FreeSWITCH gateway registration state."
        >
          <div className="space-y-4">
            {trunksQuery.isLoading ? (
              <p className="text-sm text-[var(--color-muted-fg)]">Loading trunks…</p>
            ) : trunksQuery.isError ? (
              <p className="text-sm text-[var(--color-error)]">Could not load SIP trunks.</p>
            ) : activeTrunks.length === 0 ? (
              <div className="rounded-[var(--radius-lg)] bg-[var(--color-surface-muted)] px-4 py-6 text-center text-sm text-[var(--color-muted-fg)]">
                <p className="font-medium text-[var(--color-fg)]">No active trunks</p>
                <p className="mt-2">Create and activate a SIP trunk before running connectivity tests.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {activeTrunks.map(trunk => {
                  const entries = (gatewayQuery.data ?? []).filter(e => e.trunk_id === trunk.id);
                  const state = entries[0]?.state ?? null;
                  const outcome = resolveOutcome(state);
                  const isSelected = selectedTrunkId === trunk.id;

                  return (
                    <button
                      key={trunk.id}
                      type="button"
                      onClick={() => setSelectedTrunkId(trunk.id)}
                      className={`w-full rounded-[var(--radius-lg)] border px-4 py-3 text-left transition ${
                        isSelected
                          ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/5'
                          : 'border-[var(--color-border)] bg-[var(--color-surface-muted)] hover:border-[var(--color-primary)]/40'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{trunk.name}</p>
                          <p className="mt-0.5 text-xs text-[var(--color-muted-fg)] font-mono">{trunk.realm}</p>
                        </div>
                        <span className={`text-xs font-semibold shrink-0 ${outcomeColor(outcome)}`}>
                          {state ?? 'no data'}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            <Button
              onClick={() => void runTest()}
              disabled={!selectedTrunk || isRunning || trunksQuery.isLoading}
              className="w-full"
            >
              {isRunning ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  Running test…
                </>
              ) : (
                <>
                  <PlayCircle className="size-4" aria-hidden="true" />
                  Run connectivity test
                </>
              )}
            </Button>

            {selectedTrunk && (
              <p className="text-xs text-[var(--color-muted-fg)] text-center">
                Testing: <span className="font-medium">{selectedTrunk.name}</span>
                {' · '}{selectedTrunk.direction} · {selectedTrunk.realm}
              </p>
            )}
          </div>
        </DataCard>

        {/* Result panel */}
        <DataCard
          title="Test result"
          description="Live gateway registration state from FreeSWITCH runtime. REGED means the trunk is registered and calls can flow; all other states require investigation."
        >
          {!lastResult ? (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <Activity className="size-8 text-[var(--color-muted-fg)]" aria-hidden="true" />
              <p className="text-sm text-[var(--color-muted-fg)]">
                Select a trunk and run a test to see the connectivity result and failure guidance here.
              </p>
            </div>
          ) : (
            <TestResultCard result={lastResult} />
          )}
        </DataCard>
      </div>

      {/* Gateway state summary */}
      {!gatewayQuery.isLoading && !gatewayQuery.isError && (gatewayQuery.data?.length ?? 0) > 0 && (
        <DataCard
          title="Live gateway state"
          description="Current registration state for all trunks across FreeSWITCH nodes. Auto-refreshes every 30 s."
        >
          <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border)]">
            <table className="w-full text-left text-sm">
              <thead className="bg-[var(--color-surface-muted)] text-[var(--color-muted-fg)]">
                <tr>
                  <th className="px-3 py-2 font-medium">Trunk</th>
                  <th className="px-3 py-2 font-medium">Node</th>
                  <th className="px-3 py-2 font-medium">State</th>
                  <th className="px-3 py-2 font-medium">Last seen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)] bg-[var(--color-surface)]">
                {gatewayQuery.data!.map((entry) => {
                  const outcome = resolveOutcome(entry.state);
                  return (
                    <tr key={`${entry.trunk_id}-${entry.node_id}`}>
                      <td className="px-3 py-2 font-medium">{entry.trunk_name}</td>
                      <td className="px-3 py-2 font-mono text-xs text-[var(--color-muted-fg)]">
                        {entry.node_id.slice(0, 8)}…
                      </td>
                      <td className={`px-3 py-2 font-semibold text-sm ${outcomeColor(outcome)}`}>
                        {entry.state}
                      </td>
                      <td className="px-3 py-2 text-sm text-[var(--color-muted-fg)]">
                        {relativeTime(entry.queried_at)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </DataCard>
      )}

      {/* Test history */}
      <DataCard
        title="Test history"
        description="Results from connectivity tests run in this session. History resets on page reload."
      >
        <HistoryTable records={history} />
      </DataCard>

      {/* Operator guidance card */}
      <DataCard
        title="Carrier test checklist"
        description="Pre-production validation steps from the carrier interoperability evidence guide."
      >
        <div className="space-y-3 text-sm text-[var(--color-muted-fg)]">
          {[
            { ok: true, label: 'sip_register', detail: 'Trunk shows REGED in FreeSWITCH gateway state.' },
            { ok: null, label: 'inbound_call', detail: 'Carrier sends a test call to the inbound DID and it reaches an extension.' },
            { ok: null, label: 'outbound_call', detail: 'Outbound route with this trunk delivers a call to an external number.' },
            { ok: null, label: 'dtmf_rfc2833', detail: 'DTMF digits are received correctly in an IVR flow.' },
            { ok: null, label: 'tls_or_documented_exception', detail: 'TLS transport is enabled or a risk exception is recorded.' },
            { ok: null, label: 'nat_media_path', detail: 'Media flows cleanly through NAT without one-way audio.' },
          ].map(({ ok, label, detail }) => (
            <div key={label} className="flex items-start gap-3">
              {ok === true ? (
                <CheckCircle className="mt-0.5 size-4 shrink-0 text-[var(--color-success)]" aria-hidden="true" />
              ) : (
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-[var(--color-muted-fg)]" aria-hidden="true" />
              )}
              <div>
                <p className="font-mono font-medium text-[var(--color-fg)]">{label}</p>
                <p className="mt-0.5">{detail}</p>
              </div>
            </div>
          ))}
        </div>
      </DataCard>
    </div>
  );
}
