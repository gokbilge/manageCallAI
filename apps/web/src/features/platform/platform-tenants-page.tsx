import { Building2, TriangleAlert } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { DataCard } from '@/components/data/data-card';
import { useAuth } from '@/lib/auth/use-auth';

export function PlatformTenantsPage() {
  const { session } = useAuth();

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Platform Workspace"
        title="Tenants"
        description="Platform tenant inventory is not exposed by the current backend yet, so this page shows the real MVP gap instead of fake multi-tenant data."
      />
      <DataCard
        title="Current Backend Reality"
        description="The only tenant context available today comes from the authenticated JWT used by the tenant workspace."
      >
        <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-5">
            <div className="flex items-start gap-3">
              <TriangleAlert className="mt-0.5 size-5 text-[var(--color-warning)]" aria-hidden="true" />
              <div className="space-y-2 text-sm text-[var(--color-muted-fg)]">
                <p className="font-medium text-[var(--color-fg)]">Missing platform tenant endpoint</p>
                <p>
                  A real platform tenant list requires a backend surface such as `GET /api/v1/platform/tenants` with
                  platform authorization and tenant summaries. That contract does not exist yet.
                </p>
                <p>
                  This page intentionally avoids inventing sample platform data so the UI reflects the real implementation boundary.
                </p>
              </div>
            </div>
          </div>
          <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-card)]">
            <div className="flex items-center gap-3">
              <div className="rounded-[var(--radius-lg)] bg-[var(--color-platform)]/10 p-3 text-[var(--color-platform)]">
                <Building2 className="size-5" aria-hidden="true" />
              </div>
              <div>
                <p className="text-sm font-semibold">{session?.tenantName ?? session?.tenantSlug ?? 'Current tenant'}</p>
                <p className="mt-1 text-xs font-mono text-[var(--color-muted-fg)]">{session?.claims.tenant_id}</p>
              </div>
            </div>
            <dl className="mt-4 space-y-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-[var(--color-muted-fg)]">Directory domain</dt>
                <dd className="font-mono text-xs">
                  {session?.tenantSlug ? `${session.tenantSlug}.managecallai.local` : 'unknown'}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-[var(--color-muted-fg)]">Workspace access</dt>
                <dd>Tenant</dd>
              </div>
            </dl>
          </div>
        </div>
      </DataCard>
    </div>
  );
}
