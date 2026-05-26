import { Bell, Building2, ChevronDown, Shield } from 'lucide-react';
import { WorkspaceBadge } from '@/components/ui/workspace-badge';
import type { Workspace } from '@/lib/routes/workspace';

type TopBarProps = {
  workspace: Workspace;
};

export function TopBar({ workspace }: TopBarProps) {
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
            Acme Demo
            <ChevronDown className="size-4" aria-hidden="true" />
          </button>
          <button
            aria-label="Notifications"
            className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-2"
          >
            <Bell className="size-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </header>
  );
}
