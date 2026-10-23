"use client";

import { useEffect, useRef } from "react";
import { EmptyState } from "@/components/ui/EmptyState";
import { Spinner } from "@/components/ui/Spinner";
import type { ChatMessageView } from "@/types/chat";
import { MessageBubble } from "./MessageBubble";

interface MessageListProps {
  messages: ChatMessageView[];
  loading?: boolean;
  loadingOlder?: boolean;
  hasMore?: boolean;
  onLoadOlder?: () => void;
  error?: string | null;
  onReply?: (message: ChatMessageView) => void;
  onRetry?: (message: ChatMessageView) => void;
  onToggleReaction?: (message: ChatMessageView, emoji: string) => void;
}

export function MessageList({
  messages,
  loading,
  loadingOlder,
  hasMore,
  onLoadOlder,
  error,
  onReply,
  onRetry,
  onToggleReaction,
}: MessageListProps) {
  const endRef = useRef<HTMLDivElement>(null);
  const lastMessageId = messages.at(-1)?.id;

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, lastMessageId]);

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Spinner label="Loading messages…" />
      </div>
    );
  }

  if (error) {
    return <EmptyState title="Couldn’t load messages" description={error} />;
  }

  if (messages.length === 0) {
    return (
      <EmptyState
        title="No messages yet"
        description="Say hello to start the thread. In guest mode, messages stay in this browser session only."
      />
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-3 py-4 sm:px-5" role="log" aria-live="polite">
      {hasMore ? (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={onLoadOlder}
            disabled={loadingOlder}
            className="rounded-full border border-[var(--rc-border)] bg-[var(--rc-surface)] px-3 py-1.5 text-xs text-[var(--rc-muted)] hover:text-[var(--rc-ink)] disabled:opacity-60"
          >
            {loadingOlder ? "Loading…" : "Load older messages"}
          </button>
        </div>
      ) : null}
      {messages.map((message) => (
        <MessageBubble
          key={message.clientId ?? message.id}
          message={message}
          onReply={onReply}
          onRetry={onRetry}
          onToggleReaction={onToggleReaction}
        />
      ))}
      <div ref={endRef} />
    </div>
  );
}
