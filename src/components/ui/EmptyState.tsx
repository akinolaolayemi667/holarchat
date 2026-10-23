import type { ReactNode } from "react";

interface EmptyStateProps {
  title: string;
  description: string;
  action?: ReactNode;
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--rc-accent-soft)] text-[var(--rc-accent)]">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v7A2.5 2.5 0 0 1 17.5 16H9l-4 3.5V6.5Z"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      <h3 className="font-[family-name:var(--font-display)] text-lg font-semibold text-[var(--rc-ink)]">
        {title}
      </h3>
      <p className="max-w-sm text-sm leading-relaxed text-[var(--rc-muted)]">{description}</p>
      {action}
    </div>
  );
}
