import type { ButtonHTMLAttributes, PropsWithChildren } from 'react';
import { cn } from '@/lib/cn';

type ButtonProps = PropsWithChildren<
  ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive';
  }
>;

const variants: Record<NonNullable<ButtonProps['variant']>, string> = {
  primary: 'bg-[var(--color-primary)] text-[var(--color-primary-fg)] hover:opacity-95',
  secondary: 'bg-[var(--color-surface-muted)] text-[var(--color-fg)] hover:bg-[var(--color-border)]',
  outline: 'border border-[var(--color-border)] bg-transparent text-[var(--color-fg)] hover:bg-[var(--color-surface-muted)]',
  ghost: 'bg-transparent text-[var(--color-muted-fg)] hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-fg)]',
  destructive: 'bg-[var(--color-danger)] text-white hover:opacity-95',
};

export function Button({ className, variant = 'primary', children, ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex items-center gap-2 rounded-[var(--radius-md)] px-4 py-2 text-sm font-medium shadow-none transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus)] focus-visible:ring-offset-2',
        variants[variant],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
