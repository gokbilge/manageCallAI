import { Bot, RadioTower, Server } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { StatCard } from '@/components/data/stat-card';
import { DataCard } from '@/components/data/data-card';

export function RuntimeHealthPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Platform Workspace"
        title="Runtime Health"
        description="Track stock FreeSWITCH nodes, adapter agents, and runtime integration health."
      />
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard title="FreeSWITCH Nodes" value="1 / 1 healthy" icon={RadioTower} tone="platform" />
        <StatCard title="Go Agents" value="1 connected" icon={Bot} tone="platform" />
        <StatCard title="API Reachability" value="ok" icon={Server} tone="success" />
      </div>
      <DataCard
        title="MVP Runtime Focus"
        description="The first vertical slice proves encrypted SIP directory lookup and runtime event ingestion before broader PBX features."
      >
        <ul className="list-disc space-y-2 pl-5 text-sm text-[var(--color-muted-fg)]">
          <li>Directory XML lookup through runtime-authenticated API endpoints</li>
          <li>Event-socket ingestion through the Go adapter service</li>
          <li>Platform-visible runtime state without exposing raw ESL commands publicly</li>
        </ul>
      </DataCard>
    </div>
  );
}
