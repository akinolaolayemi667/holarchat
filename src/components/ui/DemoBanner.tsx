interface DemoBannerProps {
  text?: string;
}

export function DemoBanner({
  text = "Phase 1 visual prototype. Conversations and transfers below are demo data. Auth, live messaging, WebRTC, and file transfer are not connected yet.",
}: DemoBannerProps) {
  return (
    <div className="border-b border-[var(--rc-border)] bg-[var(--rc-accent-soft)] px-4 py-2 text-center text-xs leading-relaxed text-[var(--rc-ink)] sm:text-sm">
      {text}
    </div>
  );
}
