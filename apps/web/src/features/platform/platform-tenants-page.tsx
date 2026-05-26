import { PageHeader } from '@/components/layout/page-header';
import { DataCard } from '@/components/data/data-card';
import { StatusBadge } from '@/components/ui/status-badge';

const tenants = [
  { id: 'tenant_001', name: 'Acme Telecom', domain: 'acme.managecallai.local', status: 'active' },
  { id: 'tenant_002', name: 'Northwind CX', domain: 'northwind.managecallai.local', status: 'active' },
];

export function PlatformTenantsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Platform Workspace"
        title="Tenants"
        description="Platform operators manage tenant availability, domain mapping, and runtime posture here."
      />
      <DataCard title="Tenant Inventory" description="Initial platform list scaffolded from the UI architecture docs.">
        <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border)]">
          <table className="w-full text-left text-sm">
            <thead className="bg-[var(--color-surface-muted)] text-[var(--color-muted-fg)]">
              <tr>
                <th className="px-3 py-2 font-medium">Name</th>
                <th className="px-3 py-2 font-medium">Directory Domain</th>
                <th className="px-3 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)] bg-[var(--color-surface)]">
              {tenants.map((tenant) => (
                <tr key={tenant.id}>
                  <td className="px-3 py-2">{tenant.name}</td>
                  <td className="px-3 py-2 font-mono text-xs text-[var(--color-muted-fg)]">{tenant.domain}</td>
                  <td className="px-3 py-2">
                    <StatusBadge status={tenant.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </DataCard>
    </div>
  );
}
