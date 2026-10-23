interface SearchConversationsProps {
  value: string;
  onChange: (value: string) => void;
}

export function SearchConversations({ value, onChange }: SearchConversationsProps) {
  return (
    <label className="relative block px-3 pb-3">
      <span className="sr-only">Search conversations</span>
      <svg
        className="pointer-events-none absolute top-1/2 left-6 -translate-y-1/2 text-[var(--rc-muted)]"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden
      >
        <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.6" />
        <path d="M16 16l4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search conversations"
        className="w-full rounded-xl border border-[var(--rc-border)] bg-[var(--rc-surface)] py-2.5 pr-3 pl-10 text-sm text-[var(--rc-ink)] outline-none placeholder:text-[var(--rc-muted)] focus:border-[var(--rc-accent)] focus:ring-2 focus:ring-[var(--rc-accent-soft)]"
      />
    </label>
  );
}
