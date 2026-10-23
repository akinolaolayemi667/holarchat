export function Spinner({ label = "Loading" }: { label?: string }) {
  return (
    <div className="flex flex-col items-center gap-3 text-[var(--rc-muted)]" role="status">
      <span className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--rc-border)] border-t-[var(--rc-accent)]" />
      <span className="text-sm">{label}</span>
    </div>
  );
}
