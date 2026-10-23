import { EmptyState } from "@/components/ui/EmptyState";
import type { UserProfile } from "@/types/user";
import type { WorkspaceView } from "@/types/ui";

interface SecondaryPanelProps {
  view: Exclude<WorkspaceView, "chat">;
  user: UserProfile;
  onBack: () => void;
}

export function SecondaryPanel({ view, user, onBack }: SecondaryPanelProps) {
  const title = view === "profile" ? "Profile" : "Settings";
  const description =
    view === "profile"
      ? `Showing demo profile for ${user.displayName} (${user.email}). Real account management arrives with Supabase Auth.`
      : "Subscription, TURN preferences, and privacy controls will live here. Stripe billing is planned for a later phase.";

  return (
    <div className="flex h-full flex-col bg-[var(--rc-canvas)]">
      <div className="flex items-center gap-3 border-b border-[var(--rc-border)] px-4 py-3">
        <button
          type="button"
          onClick={onBack}
          className="rounded-xl px-3 py-2 text-sm text-[var(--rc-muted)] hover:bg-[var(--rc-surface-2)] hover:text-[var(--rc-ink)]"
        >
          ← Back to chat
        </button>
        <h2 className="font-semibold text-[var(--rc-ink)]">{title}</h2>
      </div>
      <EmptyState
        title={`${title} coming soon`}
        description={description}
        action={
          <span className="rounded-full bg-[var(--rc-accent-soft)] px-3 py-1 text-xs font-medium text-[var(--rc-accent)]">
            Not implemented in Phase 1
          </span>
        }
      />
    </div>
  );
}
