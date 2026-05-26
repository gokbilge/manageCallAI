import { Building2, ServerOff } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { DataCard } from '@/components/data/data-card';
import { StatusBadge } from '@/components/ui/status-badge';
import { ApiError } from '@/lib/api/client';
import { formatRelativeDate } from '@/lib/formatting/date';
import { usePlatformTenants } from '@/lib/platform/platform-api';

export function PlatformTenantsPage() {
  const { data: tenants, isLoading, error } = usePlatformTenants();

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Platform Workspace"
        title="Tenants"
        description="Platform-level tenant inventory from the control-plane database."
      />
      <DataCard
        title="Tenant Registry"
        description="All tenants registered in this control-plane instance."
      >
        {isLoading ? (
          <p className="text-sm text-[var(--color-muted-fg)]">Loading tenant list…</p>
        ) : error ? (
          <div className="flex items-start gap-3 rounded-[var(--radius-lg)] border border-[var(--color-danger)]/20 bg-[var(--color-danger)]/10 px-4 py-4 text-sm text-[var(--color-danger)]">
            <ServerOff className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
            <div>
              <p className="font-medium">
                {error instanceof ApiError && error.status === 403
                  ? 'Platform access required'
                  : 'Could not load tenants'}
              </p>
              <p className="mt-1 opacity-80">
                {error instanceof ApiError && error.status === 403
                  ? 'Your account is not in the PLATFORM_OPERATOR_EMAILS allowlist. Contact your administrator.'
                  : error instanceof Error ? error.message : 'Unexpected error'}
              </p>
            </div>
          </div>
        ) : !tenants || tenants.length === 0 ? (
          <p className="text-sm text-[var(--color-muted-fg)]">No tenants registered yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)] text-left text-xs font-semibold uppercase tracking-[0.1em] text-[var(--color-muted-fg)]">
                  <th className="pb-3 pr-6">Name</th>
                  <th className="pb-3 pr-6">Slug</th>
                  <th className="pb-3 pr-6">Directory Domain</th>
                  <th className="pb-3 pr-6">Status</th>
                  <th className="pb-3">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {tenants.map((tenant) => (
                  <tr key={tenant.id}>
                    <td className="py-3 pr-6">
                      <div className="flex items-center gap-2">
                        <Building2 className="size-4 shrink-0 text-[var(--color-platform)]" aria-hidden="true" />
                        <span className="font-medium">{tenant.name}</span>
                      </div>
                    </td>
                    <td className="py-3 pr-6 font-mono text-xs text-[var(--color-muted-fg)]">{tenant.slug}</td>
                    <td className="py-3 pr-6 font-mono text-xs text-[var(--color-muted-fg)]">{tenant.directory_domain}</td>
                    <td className="py-3 pr-6">
                      <StatusBadge status={tenant.status === 'active' ? 'active' : 'inactive'} />
                    </td>
                    <td className="py-3 text-xs text-[var(--color-muted-fg)]">
                      {formatRelativeDate(tenant.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </DataCard>
    </div>
  );
}
