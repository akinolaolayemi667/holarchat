import { Avatar } from "@/components/ui/Avatar";
import { OnlineDot } from "@/components/ui/OnlineDot";
import { formatListTime } from "@/lib/format";
import type { ConversationSummary } from "@/types/chat";

interface ConversationItemProps {
  conversation: ConversationSummary;
  selected: boolean;
  onSelect: () => void;
}

export function ConversationItem({
  conversation,
  selected,
  onSelect,
}: ConversationItemProps) {
  const title =
    conversation.peer?.displayName ??
    conversation.title ??
    (conversation.kind === "direct" ? "Direct chat" : "Group");
  const avatarId = conversation.peer?.id ?? conversation.id;
  const presence = conversation.peer?.presence;

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex w-full items-start gap-3 rounded-2xl px-3 py-3 text-left transition ${
        selected
          ? "bg-[var(--rc-accent-soft)] ring-1 ring-[var(--rc-accent)]/30"
          : "hover:bg-[var(--rc-surface-2)]"
      }`}
    >
      <div className="relative shrink-0">
        <Avatar user={{ id: avatarId, displayName: title }} />
        {presence ? (
          <span className="absolute right-0 bottom-0">
            <OnlineDot status={presence.status} />
          </span>
        ) : null}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="truncate font-medium text-[var(--rc-ink)]">{title}</span>
          <time className="shrink-0 text-[11px] text-[var(--rc-muted)]">
            {formatListTime(conversation.lastMessageAt ?? conversation.updatedAt)}
          </time>
        </div>
        <div className="mt-0.5 flex items-center justify-between gap-2">
          <p className="truncate text-sm text-[var(--rc-muted)]">
            {conversation.lastMessagePreview}
          </p>
          {conversation.unreadCount > 0 ? (
            <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--rc-accent)] px-1.5 text-[11px] font-semibold text-white">
              {conversation.unreadCount}
            </span>
          ) : null}
        </div>
        {presence?.simulated ? (
          <p className="mt-0.5 text-[10px] text-[var(--rc-muted)]">
            Simulated presence · {presence.status}
          </p>
        ) : null}
      </div>
    </button>
  );
}
