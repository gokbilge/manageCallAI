import { Activity, Phone, Workflow } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { StatCard } from '@/components/data/stat-card';
import { DataCard } from '@/components/data/data-card';
import { useAuth } from '@/lib/auth/use-auth';

export function TenantDashboardPage() {
  const { session } = useAuth();

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Tenant Workspace"
        title="Tenant Dashboard"
        description={`Desired state, runtime activity, and publish lifecycle should all become visible from one calm operator surface for ${session?.tenantName ?? session?.tenantSlug ?? 'this tenant'}.`}
      />
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard title="Active Extensions" value="24" icon={Phone} tone="tenant" />
        <StatCard title="Flow Drafts" value="3" icon={Workflow} tone="tenant" />
        <StatCard title="Recent Call Events" value="128" icon={Activity} tone="info" />
      </div>
      <DataCard title="Lifecycle Emphasis" description="The tenant UI will make risky telecom changes visible as lifecycle states, not hidden configuration toggles.">
        <div className="grid gap-3 md:grid-cols-5">
          {['Draft', 'Validated', 'Simulated', 'Published', 'Rollback Available'].map((label) => (
            <div
              key={label}
              className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3 py-3 text-center text-xs font-medium text-[var(--color-muted-fg)]"
            >
              {label}
            </div>
          ))}
        </div>
      </DataCard>
    </div>
  );
}
