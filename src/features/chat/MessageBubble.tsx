"use client";

import { formatMessageTime } from "@/lib/format";
import { statusLabel } from "@/lib/messages/status";
import type { ChatMessageView } from "@/types/chat";

const REACTION_OPTIONS = ["👍", "❤️", "😂", "🎉"] as const;

interface MessageBubbleProps {
  message: ChatMessageView;
  onReply?: (message: ChatMessageView) => void;
  onRetry?: (message: ChatMessageView) => void;
  onToggleReaction?: (message: ChatMessageView, emoji: string) => void;
}

export function MessageBubble({
  message,
  onReply,
  onRetry,
  onToggleReaction,
}: MessageBubbleProps) {
  const own = message.isOwn;
  const failed = message.status === "failed";

  return (
    <div className={`group flex flex-col gap-1 ${own ? "items-end" : "items-start"}`}>
      <div
        className={`max-w-[min(100%,28rem)] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
          own
            ? failed
              ? "rounded-br-md bg-[var(--rc-danger)] text-white"
              : "rounded-br-md bg-[var(--rc-accent)] text-white"
            : "rounded-bl-md bg-[var(--rc-surface)] text-[var(--rc-ink)] ring-1 ring-[var(--rc-border)]"
        }`}
      >
        {message.replyTo ? (
          <div
            className={`mb-2 rounded-xl border-l-2 px-2.5 py-1.5 text-xs ${
              own
                ? "border-white/50 bg-white/15 text-white/90"
                : "border-[var(--rc-accent)] bg-[var(--rc-surface-2)] text-[var(--rc-muted)]"
            }`}
          >
            <p className="font-semibold">{message.replyTo.authorName}</p>
            <p className="line-clamp-2">{message.replyTo.body}</p>
          </div>
        ) : null}

        <p className="whitespace-pre-wrap break-words">{message.body}</p>

        <div
          className={`mt-1 flex items-center justify-end gap-2 text-[10px] ${
            own ? "text-white/75" : "text-[var(--rc-muted)]"
          }`}
        >
          <time dateTime={message.createdAt}>{formatMessageTime(message.createdAt)}</time>
          {own ? (
            <span title="Delivery status (fixture until Realtime receipts exist)">
              {statusLabel(message.status)}
            </span>
          ) : null}
        </div>
      </div>

      {message.reactions.length > 0 ? (
        <div className="flex flex-wrap gap-1 px-1">
          {message.reactions.map((r) => (
            <button
              key={r.emoji}
              type="button"
              onClick={() => onToggleReaction?.(message, r.emoji)}
              className={`rounded-full px-2 py-0.5 text-xs ring-1 ${
                r.reactedByMe
                  ? "bg-[var(--rc-accent-soft)] ring-[var(--rc-accent)]"
                  : "bg-[var(--rc-surface)] ring-[var(--rc-border)]"
              }`}
              aria-label={`${r.emoji} reaction, ${r.count}`}
            >
              {r.emoji} {r.count}
            </button>
          ))}
        </div>
      ) : null}

      <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-within:opacity-100">
        {onReply ? (
          <button
            type="button"
            onClick={() => onReply(message)}
            className="rounded-lg px-2 py-1 text-[11px] text-[var(--rc-muted)] hover:bg-[var(--rc-surface-2)] hover:text-[var(--rc-ink)]"
          >
            Reply
          </button>
        ) : null}
        {REACTION_OPTIONS.map((emoji) => (
          <button
            key={emoji}
            type="button"
            onClick={() => onToggleReaction?.(message, emoji)}
            className="rounded-lg px-1.5 py-1 text-[11px] hover:bg-[var(--rc-surface-2)]"
            aria-label={`React with ${emoji}`}
          >
            {emoji}
          </button>
        ))}
        {failed && onRetry ? (
          <button
            type="button"
            onClick={() => onRetry(message)}
            className="rounded-lg px-2 py-1 text-[11px] font-medium text-[var(--rc-danger)] hover:bg-[var(--rc-danger-soft)]"
          >
            Retry
          </button>
        ) : null}
      </div>
    </div>
  );
}
