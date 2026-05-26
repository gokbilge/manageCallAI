import { Bot, Clock3, ShieldAlert } from 'lucide-react';
import type { Workspace } from '@/lib/routes/workspace';
import { DataCard } from '@/components/data/data-card';

type InspectorPanelProps = {
  workspace: Workspace;
};

export function InspectorPanel({ workspace }: InspectorPanelProps) {
  return (
    <aside className="space-y-4">
      <DataCard
        title="Context Inspector"
        description={workspace === 'platform' ? 'Global operator context' : 'Tenant operator context'}
      >
        <div className="space-y-3 text-sm text-[var(--color-muted-fg)]">
          <div className="flex gap-3">
            <ShieldAlert className="mt-0.5 size-4 text-[var(--color-warning)]" aria-hidden="true" />
            <p>Publish, rollback, and token rotation should always surface impact and auditability before execution.</p>
          </div>
          <div className="flex gap-3">
            <Bot className="mt-0.5 size-4 text-[var(--color-info)]" aria-hidden="true" />
            <p>AI and workflow activity should remain visible as accountable actors, not hidden automation.</p>
          </div>
          <div className="flex gap-3">
            <Clock3 className="mt-0.5 size-4 text-[var(--color-success)]" aria-hidden="true" />
            <p>Runtime events belong in readable business timelines first, with raw payloads behind debug affordances.</p>
          </div>
        </div>
      </DataCard>
    </aside>
  );
}
