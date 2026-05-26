import type { PropsWithChildren } from 'react';

type DataCardProps = PropsWithChildren<{
  title: string;
  description?: string;
}>;

export function DataCard({ title, description, children }: DataCardProps) {
  return (
    <section className="rounded-[var(--radius-2xl)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-card)]">
      <div className="mb-4">
        <h2 className="text-base font-semibold">{title}</h2>
        {description ? <p className="mt-1 text-sm text-[var(--color-muted-fg)]">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}
