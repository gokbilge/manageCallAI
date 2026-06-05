import { NavLink, type NavLinkRenderProps } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  Asterisk,
  Building2,
  CalendarClock,
  ClipboardCheck,
  Download,
  FileAudio,
  GitBranch,
  Hash,
  HeartPulse,
  LayoutDashboard,
  Mic,
  MonitorPlay,
  Phone,
  PhoneCall,
  RadioTower,
  ScanEye,
  PauseCircle,
  Server,
  Shield,
  ShieldCheck,
  TestTube2,
  UserCog,
  Users,
  Workflow,
  Zap,
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
  { to: '/tenant/cockpit', label: 'Live Cockpit', icon: ScanEye, capability: CAPABILITIES.TENANT_DASHBOARD_VIEW },
  { to: '/tenant/extensions', label: 'Extensions', icon: Phone },
  { to: '/tenant/numbers', label: 'Phone Numbers', icon: Hash, capability: CAPABILITIES.TENANT_PHONE_NUMBERS_VIEW },
  { to: '/tenant/routes/inbound', label: 'Inbound Routes', icon: GitBranch, capability: CAPABILITIES.TENANT_INBOUND_ROUTES_VIEW },
  { to: '/tenant/routes/outbound', label: 'Outbound Routes', icon: ArrowUpRight, capability: CAPABILITIES.TENANT_OUTBOUND_ROUTES_VIEW },
  { to: '/tenant/outbound-calls', label: 'Outbound Calls', icon: PhoneCall, capability: CAPABILITIES.TENANT_OUTBOUND_CALLS_VIEW },
  { to: '/tenant/ivr-flows', label: 'IVR Flows', icon: Workflow, capability: CAPABILITIES.TENANT_IVR_FLOWS_VIEW },
  { to: '/tenant/approvals', label: 'Approvals', icon: ClipboardCheck, capability: CAPABILITIES.TENANT_APPROVALS_VIEW },
  { to: '/tenant/prompts', label: 'Prompts', icon: Mic, capability: CAPABILITIES.TENANT_PROMPTS_VIEW },
  { to: '/tenant/runtime/sessions', label: 'Sessions', icon: MonitorPlay, capability: CAPABILITIES.TENANT_IVR_FLOWS_VIEW },
  { to: '/tenant/calls', label: 'Call Events', icon: PhoneCall },
  { to: '/tenant/recordings', label: 'Recordings', icon: FileAudio, capability: CAPABILITIES.TENANT_RECORDINGS_VIEW },
  { to: '/tenant/schedules', label: 'Schedules', icon: CalendarClock, capability: CAPABILITIES.TENANT_SCHEDULES_VIEW },
  { to: '/tenant/conference-rooms', label: 'Conference Rooms', icon: Users, capability: CAPABILITIES.TENANT_CONFERENCE_ROOMS_VIEW },
  { to: '/tenant/feature-codes', label: 'Feature Codes', icon: Asterisk, capability: CAPABILITIES.TENANT_FEATURE_CODES_VIEW },
  { to: '/tenant/trunks', label: 'SIP Trunks', icon: Server, capability: CAPABILITIES.TENANT_SIP_TRUNKS_VIEW },
  { to: '/tenant/parking-lots', label: 'Parking Lots', icon: PauseCircle, capability: CAPABILITIES.TENANT_PARKING_LOTS_VIEW },
  { to: '/tenant/webhooks', label: 'Webhooks', icon: Zap, capability: CAPABILITIES.TENANT_AUTOMATION_WEBHOOKS_VIEW },
  { to: '/tenant/security-alerts', label: 'Security Alerts', icon: AlertTriangle, capability: CAPABILITIES.TENANT_SECURITY_ALERTS_VIEW },
  { to: '/tenant/compliance', label: 'Compliance', icon: ShieldCheck, capability: CAPABILITIES.TENANT_COMPLIANCE_ADMIN },
  { to: '/tenant/integrations/carrier-health', label: 'Carrier Health', icon: HeartPulse, capability: CAPABILITIES.TENANT_SIP_TRUNKS_VIEW },
  { to: '/tenant/integrations/directory-smoke-test', label: 'Smoke Test', icon: TestTube2 },
  { to: '/tenant/integrations/trunk-test-workflow', label: 'Trunk Test', icon: Activity, capability: CAPABILITIES.TENANT_SIP_TRUNKS_TEST },
  { to: '/tenant/audit', label: 'Audit Log', icon: Shield, capability: CAPABILITIES.TENANT_AUDIT_LOG_VIEW },
  { to: '/tenant/export', label: 'Export Data', icon: Download, capability: CAPABILITIES.TENANT_EXPORT_RUN },
  { to: '/tenant/me', label: 'My Settings', icon: UserCog },
];

const endUserNav: NavItem[] = [
  { to: '/tenant/me', label: 'My Settings', icon: UserCog },
];

export function AppSidebar({ workspace }: AppSidebarProps) {
  const { session } = useAuth();
  const role = session?.claims.role;
  const canAccessPlatform = hasCapability(role, CAPABILITIES.PLATFORM_TENANTS_VIEW);

  const items = workspace === 'platform'
    ? (canAccessPlatform ? platformNav : [])
    : role === 'end_user'
      ? endUserNav
      : tenantNav.filter((item) => !item.capability || hasCapability(role, item.capability));
  const workspaceTitle = workspace === 'platform'
    ? 'Platform Workspace'
    : role === 'end_user'
      ? 'Self-Service Workspace'
      : 'Tenant Workspace';

  return (
    <aside className="rounded-[var(--radius-2xl)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-card)]">
      <div className="border-b border-[var(--color-border)] pb-4">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-muted-fg)]">{workspaceTitle}</p>
        <p className="mt-2 text-sm text-[var(--color-muted-fg)]">
          {role === 'end_user'
            ? 'Your access is limited to your own extension, voicemail, call history, and SIP settings.'
            : 'Navigation is permission-driven and workspace-explicit from the first MVP screens.'}
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
