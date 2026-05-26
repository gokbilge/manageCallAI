import { PhoneCall } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { DataCard } from '@/components/data/data-card';

const timeline = [
  'Incoming call from +90 555 010 100',
  'Matched inbound route: Main Number',
  'Entered flow: Main IVR v4',
  'Collected digit: 2',
  'Transferred to: Support Queue',
  'Hung up after 01:42',
];

export function CallsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Tenant Workspace"
        title="Call Events"
        description="Business-level call timelines should be primary; raw FreeSWITCH payloads stay secondary."
      />
      <DataCard title="Recent Timeline" description="Initial layout for the runtime observability surface described in the UX principles.">
        <ol className="space-y-3">
          {timeline.map((step, index) => (
            <li key={step} className="flex gap-3 rounded-[var(--radius-md)] bg-[var(--color-surface-muted)] px-4 py-3">
              <div className="mt-0.5 rounded-full bg-[var(--color-info)]/10 p-2 text-[var(--color-info)]">
                <PhoneCall className="size-4" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium">{step}</p>
                <p className="text-xs text-[var(--color-muted-fg)]">Step {index + 1} in the call lifecycle</p>
              </div>
            </li>
          ))}
        </ol>
      </DataCard>
    </div>
  );
}
