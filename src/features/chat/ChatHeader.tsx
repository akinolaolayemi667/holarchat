import { Avatar } from "@/components/ui/Avatar";
import { IconButton } from "@/components/ui/IconButton";
import { OnlineDot } from "@/components/ui/OnlineDot";
import type { ConversationSummary } from "@/types/chat";

interface ChatHeaderProps {
  conversation: ConversationSummary;
  connectionLabel?: string;
  onBack?: () => void;
  showBack?: boolean;
}

export function ChatHeader({
  conversation,
  connectionLabel,
  onBack,
  showBack,
}: ChatHeaderProps) {
  const title =
    conversation.peer?.displayName ??
    conversation.title ??
    (conversation.kind === "direct" ? "Direct chat" : "Group");
  const avatarId = conversation.peer?.id ?? conversation.id;
  const presence = conversation.peer?.presence;

  return (
    <header className="flex items-center gap-3 border-b border-[var(--rc-border)] px-3 py-3 sm:px-5">
      {showBack ? (
        <IconButton label="Back to conversations" onClick={onBack}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d="M15 5l-7 7 7 7"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </IconButton>
      ) : null}
      <div className="relative">
        <Avatar user={{ id: avatarId, displayName: title }} size="sm" />
        {presence ? (
          <span className="absolute right-0 bottom-0">
            <OnlineDot status={presence.status} />
          </span>
        ) : null}
      </div>
      <div className="min-w-0 flex-1">
        <h2 className="truncate font-semibold text-[var(--rc-ink)]">{title}</h2>
        <p className="truncate text-xs text-[var(--rc-muted)]">
          {presence?.simulated
            ? `Simulated · ${presence.status}`
            : (connectionLabel ?? "Conversation")}
        </p>
      </div>
    </header>
  );
}
