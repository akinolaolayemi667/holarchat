"use client";

import { IconButton } from "@/components/ui/IconButton";
import type { MessageReplyPreview } from "@/types/chat";

interface MessageComposerProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onAttach: () => void;
  notice: string | null;
  disabled?: boolean;
  replyTo?: MessageReplyPreview | null;
  onCancelReply?: () => void;
  placeholder?: string;
}

export function MessageComposer({
  value,
  onChange,
  onSend,
  onAttach,
  notice,
  disabled,
  replyTo,
  onCancelReply,
  placeholder = "Write a message",
}: MessageComposerProps) {
  return (
    <div className="border-t border-[var(--rc-border)] bg-[var(--rc-surface)] px-3 py-3 sm:px-5">
      {notice ? (
        <p className="mb-2 rounded-xl bg-[var(--rc-warning-soft)] px-3 py-2 text-xs text-[var(--rc-warning)]" role="status">
          {notice}
        </p>
      ) : null}

      {replyTo ? (
        <div className="mb-2 flex items-start gap-2 rounded-xl bg-[var(--rc-surface-2)] px-3 py-2">
          <div className="min-w-0 flex-1 border-l-2 border-[var(--rc-accent)] pl-2">
            <p className="text-xs font-semibold text-[var(--rc-ink)]">
              Replying to {replyTo.authorName}
            </p>
            <p className="truncate text-xs text-[var(--rc-muted)]">{replyTo.body}</p>
          </div>
          <button
            type="button"
            onClick={onCancelReply}
            className="text-xs text-[var(--rc-muted)] hover:text-[var(--rc-ink)]"
            aria-label="Cancel reply"
          >
            ✕
          </button>
        </div>
      ) : null}

      <form
        className="flex items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          onSend();
        }}
      >
        <IconButton label="Attach file (not available yet)" onClick={onAttach} disabled={disabled}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d="M16.5 7.5l-7.8 7.8a2.5 2.5 0 0 1-3.5-3.5l8.5-8.5a4 4 0 0 1 5.7 5.7l-9.2 9.2a5.5 5.5 0 0 1-7.8-7.8L11 2.8"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </IconButton>
        <label className="sr-only" htmlFor="message-input">
          Message
        </label>
        <textarea
          id="message-input"
          rows={1}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              onSend();
            }
            if (e.key === "Escape" && replyTo) {
              onCancelReply?.();
            }
          }}
          placeholder={placeholder}
          className="max-h-32 min-h-11 flex-1 resize-none rounded-2xl border border-[var(--rc-border)] bg-[var(--rc-surface-2)] px-4 py-2.5 text-sm text-[var(--rc-ink)] outline-none placeholder:text-[var(--rc-muted)] focus:border-[var(--rc-accent)] focus:ring-2 focus:ring-[var(--rc-accent-soft)] disabled:opacity-60"
        />
        <IconButton
          label="Send message"
          type="submit"
          tone="accent"
          disabled={disabled || !value.trim()}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d="M4 12l15-7-4 16-4-6-7-3Z"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinejoin="round"
            />
          </svg>
        </IconButton>
      </form>
      <p className="mt-1.5 text-[10px] text-[var(--rc-muted)]">
        Enter to send · Shift+Enter for new line · Esc cancels reply
      </p>
    </div>
  );
}
