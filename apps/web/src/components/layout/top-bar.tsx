import { Bell, Building2, ChevronDown, LogOut, Shield } from 'lucide-react';
import { WorkspaceBadge } from '@/components/ui/workspace-badge';
import type { Workspace } from '@/lib/routes/workspace';
import { useAuth } from '@/lib/auth/use-auth';
import { Button } from '@/components/ui/button';

type TopBarProps = {
  workspace: Workspace;
};

export function TopBar({ workspace }: TopBarProps) {
  const { session, signOut } = useAuth();

  return (
    <header className="sticky top-0 z-10 border-b border-[var(--color-border)] bg-[var(--color-surface)]/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-[112rem] items-center justify-between px-6">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-[var(--radius-lg)] bg-[var(--color-fg)] text-white">
            <Shield className="size-5" aria-hidden="true" />
          </div>
          <div>
            <p className="text-sm font-semibold">manageCallAI</p>
            <p className="text-xs text-[var(--color-muted-fg)]">AI-native telecom control plane</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <WorkspaceBadge workspace={workspace} />
          <button className="flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3 py-2 text-sm">
            <Building2 className="size-4" aria-hidden="true" />
            {session?.tenantName ?? session?.tenantSlug ?? 'Workspace'}
            <ChevronDown className="size-4" aria-hidden="true" />
          </button>
          <button
            aria-label="Notifications"
            className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-2"
          >
            <Bell className="size-4" aria-hidden="true" />
          </button>
          {session ? (
            <Button variant="ghost" onClick={signOut}>
              <LogOut className="size-4" aria-hidden="true" />
              Sign out
            </Button>
          ) : null}
        </div>
      </div>
    </header>
  );
}
