import { AlertTriangle, X } from 'lucide-react';
import { useState } from 'react';

const DISMISSED_KEY = 'managecallai_alpha_banner_dismissed';

export function AlphaBanner() {
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(DISMISSED_KEY) === '1';
    } catch {
      return false;
    }
  });

  if (dismissed) return null;

  function dismiss() {
    try {
      localStorage.setItem(DISMISSED_KEY, '1');
    } catch {
      // ignore storage errors
    }
    setDismissed(true);
  }

  return (
    <div
      role="banner"
      aria-label="Alpha software notice"
      className="flex items-center justify-between gap-3 border-b border-[var(--color-warning)]/30 bg-[var(--color-warning)]/8 px-6 py-2 text-xs text-[var(--color-warning)]"
    >
      <div className="flex items-center gap-2">
        <AlertTriangle className="size-3.5 shrink-0" aria-hidden="true" />
        <span>
          <strong>Alpha software</strong> — not production-ready. Expect breaking changes.
          See{' '}
          <a
            href="docs/deployment/local-alpha.md"
            className="underline underline-offset-2 hover:opacity-80"
            target="_blank"
            rel="noopener noreferrer"
          >
            alpha limitations
          </a>
          .
        </span>
      </div>
      <button
        onClick={dismiss}
        aria-label="Dismiss alpha notice"
        className="shrink-0 rounded p-0.5 hover:opacity-70"
      >
        <X className="size-3.5" aria-hidden="true" />
      </button>
    </div>
  );
}
