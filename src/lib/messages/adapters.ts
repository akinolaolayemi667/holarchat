import type { ConversationListItem, MessageView } from "@/lib/messages/queries";
import type { ChatMessageView, ConversationSummary } from "@/types/chat";

/** Map Phase 2 Supabase list items into Phase 3 UI summaries. */
export function toConversationSummary(item: ConversationListItem): ConversationSummary {
  return {
    id: item.id,
    kind: item.type,
    title: item.title,
    peer: item.peer
      ? {
          id: item.peer.id,
          displayName: item.peer.display_name,
          email: "",
          avatarUrl: item.peer.avatar_url ?? undefined,
        }
      : null,
    lastMessagePreview: item.lastMessagePreview,
    lastMessageAt: item.lastMessageAt,
    updatedAt: item.updatedAt,
    unreadCount: item.unreadCount,
  };
}

export function toChatMessageView(message: MessageView): ChatMessageView {
  const status =
    message.receipt === "read"
      ? "read"
      : message.receipt === "delivered"
        ? "delivered"
        : "sent";

  return {
    id: message.id,
    conversationId: message.conversationId,
    senderId: message.senderId,
    body: message.body,
    createdAt: message.createdAt,
    isOwn: message.isOwn,
    status,
    clientId: message.clientId,
    replyTo: null,
    reactions: [],
  };
}
