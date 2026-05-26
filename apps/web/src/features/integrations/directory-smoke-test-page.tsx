import { AlertTriangle, ShieldCheck } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { DataCard } from '@/components/data/data-card';
import { Button } from '@/components/ui/button';

const exampleCurl = `curl "http://localhost:3000/api/v1/freeswitch/directory?user=200&domain=acme-demo.managecallai.local" \\
  -H "Authorization: Bearer <RUNTIME_API_TOKEN>"`;

export function DirectorySmokeTestPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Tenant Workspace"
        title="FreeSWITCH Directory Smoke Test"
        description="MVP helper surface for validating runtime token auth and XML directory lookup before deeper PBX features."
      />
      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <DataCard title="Recommended Runtime Auth" description="Use the runtime bearer token in headers whenever FreeSWITCH setup allows it.">
          <pre className="overflow-x-auto rounded-[var(--radius-md)] bg-[#0f172a] p-4 text-xs text-slate-100">
            <code>{exampleCurl}</code>
          </pre>
        </DataCard>
        <DataCard title="MVP Notes" description="The query-string fallback exists only for local development or constrained mod_xml_curl installations.">
          <div className="space-y-3 text-sm text-[var(--color-muted-fg)]">
            <div className="flex gap-3">
              <ShieldCheck className="mt-0.5 size-4 text-[var(--color-success)]" aria-hidden="true" />
              <p>Directory XML should include the extension ID and decrypted SIP password only at render time.</p>
            </div>
            <div className="flex gap-3">
              <AlertTriangle className="mt-0.5 size-4 text-[var(--color-warning)]" aria-hidden="true" />
              <p>Do not expose runtime tokens in general user-facing workflows or screenshots.</p>
            </div>
            <Button variant="secondary">Open Vertical Slice Guide</Button>
          </div>
        </DataCard>
      </div>
    </div>
  );
}
