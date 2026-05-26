import { CheckCircle2, CircleOff, Pencil, Rocket, ShieldCheck, TriangleAlert } from 'lucide-react';
import { cn } from '@/lib/cn';

type Status = 'active' | 'inactive' | 'draft' | 'published' | 'validated' | 'warning';

const map: Record<
  Status,
  {
    label: string;
    className: string;
    icon: typeof CheckCircle2;
  }
> = {
  active: {
    label: 'Active',
    className: 'bg-[var(--color-success)]/10 text-[var(--color-success)]',
    icon: CheckCircle2,
  },
  inactive: {
    label: 'Inactive',
    className: 'bg-[var(--color-muted)]/10 text-[var(--color-muted-fg)]',
    icon: CircleOff,
  },
  draft: {
    label: 'Draft',
    className: 'bg-[var(--color-warning)]/10 text-[var(--color-warning)]',
    icon: Pencil,
  },
  published: {
    label: 'Published',
    className: 'bg-[var(--color-info)]/10 text-[var(--color-info)]',
    icon: Rocket,
  },
  validated: {
    label: 'Validated',
    className: 'bg-[var(--color-success)]/10 text-[var(--color-success)]',
    icon: ShieldCheck,
  },
  warning: {
    label: 'Warning',
    className: 'bg-[var(--color-warning)]/10 text-[var(--color-warning)]',
    icon: TriangleAlert,
  },
};

export function StatusBadge({ status }: { status: Status | string }) {
  const item = map[(status as Status) ?? 'warning'] ?? {
    label: status,
    className: 'bg-[var(--color-muted)]/10 text-[var(--color-muted-fg)]',
    icon: TriangleAlert,
  };

  const Icon = item.icon;

  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium', item.className)}>
      <Icon className="size-3.5" aria-hidden="true" />
      {item.label}
    </span>
  );
}
