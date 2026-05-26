import { Building2, RadioTower, ShieldCheck } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { StatCard } from '@/components/data/stat-card';

export function PlatformHomePage() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Platform Workspace"
        title="Platform Management"
        description="Global operator surface for tenants, runtime health, and platform-level policies."
      />
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard title="Managed Tenants" value="12" icon={Building2} tone="platform" />
        <StatCard title="Runtime Nodes" value="3" icon={RadioTower} tone="platform" />
        <StatCard title="Audit Coverage" value="100%" icon={ShieldCheck} tone="platform" />
      </div>
    </div>
  );
}
