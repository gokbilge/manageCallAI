import type { LucideIcon } from 'lucide-react';
import { DataCard } from './data-card';
import { cn } from '@/lib/cn';

type StatCardProps = {
  title: string;
  value: string;
  icon: LucideIcon;
  tone?: 'platform' | 'tenant' | 'info' | 'success';
};

const toneClasses: Record<NonNullable<StatCardProps['tone']>, string> = {
  platform: 'bg-[var(--color-platform)]/10 text-[var(--color-platform)]',
  tenant: 'bg-[var(--color-tenant)]/10 text-[var(--color-tenant)]',
  info: 'bg-[var(--color-info)]/10 text-[var(--color-info)]',
  success: 'bg-[var(--color-success)]/10 text-[var(--color-success)]',
};

export function StatCard({ title, value, icon: Icon, tone = 'info' }: StatCardProps) {
  return (
    <DataCard title={title}>
      <div className="flex items-center justify-between gap-4">
        <p className="text-3xl font-semibold tracking-tight">{value}</p>
        <div className={cn('rounded-[var(--radius-lg)] p-3', toneClasses[tone])}>
          <Icon className="size-5" aria-hidden="true" />
        </div>
      </div>
    </DataCard>
  );
}
