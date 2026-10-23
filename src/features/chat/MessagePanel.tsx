import { EmptyState } from "@/components/ui/EmptyState";
import type { FileTransferProgress } from "@/types/file-transfer";
import type { ChatMessageView, ConversationSummary, MessageReplyPreview } from "@/types/chat";
import { ChatHeader } from "./ChatHeader";
import { DeliverySimulator } from "./DeliverySimulator";
import { FileTransferPanel } from "./FileTransferPanel";
import { MessageComposer } from "./MessageComposer";
import { MessageList } from "./MessageList";

interface MessagePanelProps {
  conversation: ConversationSummary | null;
  messages: ChatMessageView[];
  transfers?: FileTransferProgress[];
  draft: string;
  onDraftChange: (value: string) => void;
  onSend: () => void;
  onAttach: () => void;
  notice: string | null;
  showBack?: boolean;
  onBack?: () => void;
  disabled?: boolean;
  loadingMessages?: boolean;
  loadingOlder?: boolean;
  hasMore?: boolean;
  onLoadOlder?: () => void;
  error?: string | null;
  connectionLabel?: string;
  replyTo?: MessageReplyPreview | null;
  onCancelReply?: () => void;
  onReply?: (message: ChatMessageView) => void;
  onRetry?: (message: ChatMessageView) => void;
  onToggleReaction?: (message: ChatMessageView, emoji: string) => void;
  showDeliverySimulator?: boolean;
  onSimulateDelivered?: () => void;
  onSimulateRead?: () => void;
  onSimulateFailLastPending?: () => void;
  composerPlaceholder?: string;
}

export function MessagePanel({
  conversation,
  messages,
  transfers = [],
  draft,
  onDraftChange,
  onSend,
  onAttach,
  notice,
  showBack,
  onBack,
  disabled,
  loadingMessages,
  loadingOlder,
  hasMore,
  onLoadOlder,
  error,
  connectionLabel,
  replyTo,
  onCancelReply,
  onReply,
  onRetry,
  onToggleReaction,
  showDeliverySimulator,
  onSimulateDelivered,
  onSimulateRead,
  onSimulateFailLastPending,
  composerPlaceholder,
}: MessagePanelProps) {
  if (!conversation) {
    return (
      <div className="flex h-full flex-col bg-[var(--rc-canvas)]">
        <EmptyState
          title="Select a conversation"
          description="Pick a chat from the sidebar, or start a new one with the + button."
        />
      </div>
    );
  }

  const relatedTransfers = transfers.filter((t) => t.conversationId === conversation.id);
  const hasOwnSent = messages.some((m) => m.isOwn && (m.status === "sent" || m.status === "delivered"));

  return (
    <div className="flex h-full min-h-0 flex-col bg-[var(--rc-canvas)]">
      <ChatHeader
        conversation={conversation}
        showBack={showBack}
        onBack={onBack}
        connectionLabel={connectionLabel}
      />
      <MessageList
        messages={messages}
        loading={loadingMessages}
        loadingOlder={loadingOlder}
        hasMore={hasMore}
        onLoadOlder={onLoadOlder}
        error={error}
        onReply={onReply}
        onRetry={onRetry}
        onToggleReaction={onToggleReaction}
      />
      <FileTransferPanel transfers={relatedTransfers} />
      {showDeliverySimulator && onSimulateDelivered && onSimulateRead && onSimulateFailLastPending ? (
        <DeliverySimulator
          enabled
          hasOwnSentMessage={hasOwnSent}
          onSimulateDelivered={onSimulateDelivered}
          onSimulateRead={onSimulateRead}
          onSimulateFailLastPending={onSimulateFailLastPending}
        />
      ) : null}
      <MessageComposer
        value={draft}
        onChange={onDraftChange}
        onSend={onSend}
        onAttach={onAttach}
        notice={notice}
        disabled={disabled}
        replyTo={replyTo}
        onCancelReply={onCancelReply}
        placeholder={composerPlaceholder}
      />
    </div>
  );
}
