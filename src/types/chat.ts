/**
 * Phase 3 shared chat domain types.
 * UI and data-access layers both import from here.
 */

export type ParticipantId = string;
export type ConversationId = string;
export type MessageId = string;

export type SimulatedPresence = "online" | "away" | "offline";

export interface ChatParticipant {
  id: ParticipantId;
  displayName: string;
  email: string;
  avatarUrl?: string;
  /**
   * Fixture-only presence. When `simulated` is true, UI must label it as simulated.
   * Real presence is not available until a later signaling phase.
   */
  presence?: {
    status: SimulatedPresence;
    simulated: boolean;
  };
}

export type ConversationKind = "direct" | "group";

export interface ConversationSummary {
  id: ConversationId;
  kind: ConversationKind;
  title: string | null;
  peer: ChatParticipant | null;
  lastMessagePreview: string;
  lastMessageAt: string | null;
  updatedAt: string;
  unreadCount: number;
}

/**
 * Client-visible delivery lifecycle.
 * - pending: optimistic local send in flight
 * - sent: server/fixture accepted (persisted) — NOT delivered to peer
 * - delivered / read: only after an explicit receipt event (or labeled simulation)
 * - failed: send failed; user may retry
 */
export type MessageDeliveryStatus = "pending" | "sent" | "delivered" | "read" | "failed";

export interface MessageReaction {
  emoji: string;
  count: number;
  reactedByMe: boolean;
}

export interface MessageReplyPreview {
  id: MessageId;
  body: string;
  authorName: string;
}

export interface ChatMessageView {
  id: MessageId;
  conversationId: ConversationId;
  senderId: ParticipantId;
  body: string;
  createdAt: string;
  isOwn: boolean;
  status: MessageDeliveryStatus;
  clientId: string | null;
  replyTo: MessageReplyPreview | null;
  reactions: MessageReaction[];
  /** Set when status is failed */
  errorMessage?: string;
}

export interface DeliveryReceipt {
  messageId: MessageId;
  recipientId: ParticipantId;
  deliveredAt: string | null;
  readAt: string | null;
}

export type StartConversationOutcome =
  | { status: "created"; conversationId: ConversationId }
  | { status: "existing"; conversationId: ConversationId }
  | { status: "error"; code: string; message: string };
