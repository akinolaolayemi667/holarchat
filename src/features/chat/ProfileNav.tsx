import { Avatar } from "@/components/ui/Avatar";
import { IconButton } from "@/components/ui/IconButton";
import type { UserProfile } from "@/types/user";
import type { WorkspaceView } from "@/types/ui";

interface ProfileNavProps {
  user: UserProfile;
  activeView: WorkspaceView;
  onNavigate: (view: WorkspaceView) => void;
  onSignOut?: () => void;
}

export function ProfileNav({ user, activeView, onNavigate, onSignOut }: ProfileNavProps) {
  return (
    <div className="mt-auto border-t border-[var(--rc-border)] p-3">
      <div className="flex items-center gap-2 rounded-2xl bg-[var(--rc-surface-2)] px-3 py-2.5">
        <Avatar user={user} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-[var(--rc-ink)]">{user.displayName}</p>
          <p className="truncate text-xs text-[var(--rc-muted)]">Signed in</p>
        </div>
        <IconButton
          label="Profile"
          aria-pressed={activeView === "profile"}
          onClick={() => onNavigate("profile")}
          className={activeView === "profile" ? "bg-[var(--rc-surface)] text-[var(--rc-ink)]" : ""}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
            <circle cx="12" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.6" />
            <path
              d="M5 19c1.8-3 4.2-4.5 7-4.5S17.2 16 19 19"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
          </svg>
        </IconButton>
        <IconButton
          label="Settings"
          aria-pressed={activeView === "settings"}
          onClick={() => onNavigate("settings")}
          className={activeView === "settings" ? "bg-[var(--rc-surface)] text-[var(--rc-ink)]" : ""}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z"
              stroke="currentColor"
              strokeWidth="1.6"
            />
            <path
              d="M19.4 13.5a7.7 7.7 0 0 0 .1-1.5 7.7 7.7 0 0 0-.1-1.5l2-1.5-2-3.5-2.4 1a7.3 7.3 0 0 0-2.6-1.5L14 2h-4l-.4 2.5a7.3 7.3 0 0 0-2.6 1.5l-2.4-1-2 3.5 2 1.5a7.7 7.7 0 0 0-.1 1.5c0 .5 0 1 .1 1.5l-2 1.5 2 3.5 2.4-1a7.3 7.3 0 0 0 2.6 1.5L10 22h4l.4-2.5a7.3 7.3 0 0 0 2.6-1.5l2.4 1 2-3.5-2-1.5Z"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinejoin="round"
            />
          </svg>
        </IconButton>
        {onSignOut ? (
          <IconButton label="Sign out" onClick={onSignOut} tone="danger">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M10 7V5.5A1.5 1.5 0 0 1 11.5 4h7A1.5 1.5 0 0 1 20 5.5v13a1.5 1.5 0 0 1-1.5 1.5h-7A1.5 1.5 0 0 1 10 18.5V17"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
              <path
                d="M4 12h10M10 8l4 4-4 4"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </IconButton>
        ) : null}
      </div>
    </div>
  );
}
