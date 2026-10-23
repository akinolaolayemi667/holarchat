import { IconButton } from "@/components/ui/IconButton";
import { ConversationList } from "@/features/chat/ConversationList";
import { ProfileNav } from "@/features/chat/ProfileNav";
import { SearchConversations } from "@/features/chat/SearchConversations";
import type { ConversationSummary } from "@/types/chat";
import type { UserProfile } from "@/types/user";
import type { WorkspaceView } from "@/types/ui";

interface SidebarProps {
  user: UserProfile;
  conversations: ConversationSummary[];
  selectedId: string | null;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  onSelect: (id: string) => void;
  activeView: WorkspaceView;
  onNavigate: (view: WorkspaceView) => void;
  onSignOut?: () => void;
  onNewConversation?: () => void;
  subtitle?: string;
}

export function Sidebar({
  user,
  conversations,
  selectedId,
  searchQuery,
  onSearchChange,
  onSelect,
  activeView,
  onNavigate,
  onSignOut,
  onNewConversation,
  subtitle = "Guest preview · local fixtures",
}: SidebarProps) {
  return (
    <aside className="relative flex h-full min-h-0 w-full flex-col border-r border-[var(--rc-border)] bg-[var(--rc-surface)]">
      <div className="flex items-start gap-2 px-4 pt-5 pb-3">
        <div className="min-w-0 flex-1">
          <p className="font-[family-name:var(--font-display)] text-2xl font-semibold tracking-tight text-[var(--rc-ink)]">
            Relay<span className="text-[var(--rc-accent)]">Chat</span>
          </p>
          <p className="mt-1 text-xs text-[var(--rc-muted)]">{subtitle}</p>
        </div>
        {onNewConversation ? (
          <IconButton label="New conversation" tone="accent" onClick={onNewConversation}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </IconButton>
        ) : null}
      </div>
      <SearchConversations value={searchQuery} onChange={onSearchChange} />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <ConversationList
          conversations={conversations}
          selectedId={selectedId}
          onSelect={onSelect}
          searching={searchQuery.trim().length > 0}
        />
      </div>
      <ProfileNav
        user={user}
        activeView={activeView}
        onNavigate={onNavigate}
        onSignOut={onSignOut}
      />
    </aside>
  );
}
