import { NavLink, type NavLinkRenderProps } from 'react-router-dom';
import {
  Activity,
  Building2,
  GitBranch,
  Hash,
  LayoutDashboard,
  Phone,
  PhoneCall,
  RadioTower,
  TestTube2,
  Workflow,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { Workspace } from '@/lib/routes/workspace';
import { cn } from '@/lib/cn';
import { useAuth } from '@/lib/auth/use-auth';
import { type Capability, CAPABILITIES, hasCapability } from '@/lib/permissions/capabilities';

type AppSidebarProps = {
  workspace: Workspace;
  pathname: string;
};

type NavItem = {
  to: string;
  label: string;
  icon: LucideIcon;
  capability?: Capability;
};

const platformNav: NavItem[] = [
  { to: '/platform', label: 'Overview', icon: LayoutDashboard },
  { to: '/platform/tenants', label: 'Tenants', icon: Building2 },
  { to: '/platform/runtime', label: 'Runtime', icon: RadioTower },
];

const tenantNav: NavItem[] = [
  { to: '/tenant/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/tenant/extensions', label: 'Extensions', icon: Phone },
  { to: '/tenant/numbers', label: 'Phone Numbers', icon: Hash, capability: CAPABILITIES.TENANT_PHONE_NUMBERS_VIEW },
  { to: '/tenant/routes/inbound', label: 'Inbound Routes', icon: GitBranch, capability: CAPABILITIES.TENANT_INBOUND_ROUTES_VIEW },
  { to: '/tenant/ivr-flows', label: 'IVR Flows', icon: Workflow, capability: CAPABILITIES.TENANT_IVR_FLOWS_VIEW },
  { to: '/tenant/calls', label: 'Call Events', icon: PhoneCall },
  { to: '/tenant/integrations/directory-smoke-test', label: 'Smoke Test', icon: TestTube2 },
];

export function AppSidebar({ workspace }: AppSidebarProps) {
  const { session } = useAuth();
  const role = session?.claims.role;
  const canAccessPlatform = hasCapability(role, CAPABILITIES.PLATFORM_TENANTS_VIEW);

  const items = workspace === 'platform'
    ? (canAccessPlatform ? platformNav : [])
    : tenantNav.filter((item) => !item.capability || hasCapability(role, item.capability));
  const workspaceTitle = workspace === 'platform' ? 'Platform Workspace' : 'Tenant Workspace';

  return (
    <aside className="rounded-[var(--radius-2xl)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-card)]">
      <div className="border-b border-[var(--color-border)] pb-4">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-muted-fg)]">{workspaceTitle}</p>
        <p className="mt-2 text-sm text-[var(--color-muted-fg)]">
          Navigation is permission-driven and workspace-explicit from the first MVP screens.
        </p>
      </div>
      <nav className="mt-4 space-y-1">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }: NavLinkRenderProps) =>
              cn(
                'flex items-center gap-3 rounded-[var(--radius-md)] px-3 py-2 text-sm transition-colors',
                isActive
                  ? workspace === 'platform'
                    ? 'bg-[var(--color-platform)]/10 text-[var(--color-platform)]'
                    : 'bg-[var(--color-tenant)]/10 text-[var(--color-tenant)]'
                  : 'text-[var(--color-muted-fg)] hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-fg)]',
              )
            }
          >
            <item.icon className="size-4" aria-hidden="true" />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
      <div className="mt-6 rounded-[var(--radius-lg)] bg-[var(--color-surface-muted)] p-4">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Activity className="size-4 text-[var(--color-info)]" aria-hidden="true" />
          Runtime posture
        </div>
        <p className="mt-2 text-xs leading-5 text-[var(--color-muted-fg)]">
          Keep validation, simulation, and publish state visible instead of burying production risk behind generic save buttons.
        </p>
      </div>
    </aside>
  );
}
