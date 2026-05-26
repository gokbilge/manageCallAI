import { Plus, ShieldCheck } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { DataCard } from '@/components/data/data-card';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';

const extensions = [
  {
    id: 'ext_001',
    number: '200',
    name: 'Reception',
    sipUsername: '200',
    status: 'active',
    destination: 'Main IVR',
  },
  {
    id: 'ext_002',
    number: '201',
    name: 'Support Desk',
    sipUsername: 'support-201',
    status: 'inactive',
    destination: 'Support Queue',
  },
];

export function ExtensionsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Tenant Workspace"
        title="Extensions"
        description="SIP credentials stay hidden, desired state stays explicit, and runtime-facing identifiers remain readable."
        actions={
          <Button>
            <Plus className="size-4" aria-hidden="true" />
            Create Extension
          </Button>
        }
      />
      <DataCard title="Extension Inventory" description="Placeholder data that matches the MVP extension and SIP credential model.">
        <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border)]">
          <table className="w-full text-left text-sm">
            <thead className="bg-[var(--color-surface-muted)] text-[var(--color-muted-fg)]">
              <tr>
                <th className="px-3 py-2 font-medium">Extension</th>
                <th className="px-3 py-2 font-medium">Display Name</th>
                <th className="px-3 py-2 font-medium">SIP Username</th>
                <th className="px-3 py-2 font-medium">Destination</th>
                <th className="px-3 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)] bg-[var(--color-surface)]">
              {extensions.map((extension) => (
                <tr key={extension.id}>
                  <td className="px-3 py-2 font-mono text-xs">{extension.number}</td>
                  <td className="px-3 py-2">{extension.name}</td>
                  <td className="px-3 py-2 font-mono text-xs text-[var(--color-muted-fg)]">{extension.sipUsername}</td>
                  <td className="px-3 py-2">{extension.destination}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <StatusBadge status={extension.status} />
                      <ShieldCheck className="size-4 text-[var(--color-success)]" aria-hidden="true" />
                    </div>
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
