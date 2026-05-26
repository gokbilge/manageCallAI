import type { Workspace } from '@/lib/routes/workspace';
import { cn } from '@/lib/cn';

export function WorkspaceBadge({ workspace }: { workspace: Workspace }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em]',
        workspace === 'platform'
          ? 'bg-[var(--color-platform)]/10 text-[var(--color-platform)]'
          : 'bg-[var(--color-tenant)]/10 text-[var(--color-tenant)]',
      )}
    >
      {workspace}
    </span>
  );
}
