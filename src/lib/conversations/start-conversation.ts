import type { ConversationId, ConversationSummary, StartConversationOutcome } from "@/types/chat";

/**
 * Pure logic: resolve starting a direct conversation given existing list + peer id.
 * Used by UI and unit tests. Backend adapters call this shape after their own I/O.
 */
export function resolveStartDirectConversation(args: {
  peerId: string;
  existing: ConversationSummary[];
  createId: () => ConversationId;
  nowIso: () => string;
  peerDisplayName: string;
}): StartConversationOutcome & { conversation?: ConversationSummary } {
  const { peerId, existing, createId, nowIso, peerDisplayName } = args;

  if (!peerId.trim()) {
    return { status: "error", code: "INVALID_PEER", message: "Choose a person to message." };
  }

  const duplicate = existing.find(
    (c) => c.kind === "direct" && c.peer?.id === peerId,
  );

  if (duplicate) {
    return { status: "existing", conversationId: duplicate.id, conversation: duplicate };
  }

  const now = nowIso();
  const conversation: ConversationSummary = {
    id: createId(),
    kind: "direct",
    title: null,
    peer: {
      id: peerId,
      displayName: peerDisplayName,
      email: "",
      presence: { status: "offline", simulated: true },
    },
    lastMessagePreview: "No messages yet",
    lastMessageAt: null,
    updatedAt: now,
    unreadCount: 0,
  };

  return { status: "created", conversationId: conversation.id, conversation };
}
