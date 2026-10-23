import type { UserId, UserProfile } from "./user";

export type ConversationId = string;

export interface ConversationPreview {
  id: ConversationId;
  participant: UserProfile;
  lastMessagePreview: string;
  lastMessageAt: string;
  unreadCount: number;
  /** Visual-only demo flag — not live presence. */
  demoPeerStatus: "online" | "away" | "offline";
}

export interface ConversationService {
  listConversations(userId: UserId): Promise<ConversationPreview[]>;
  getConversation(id: ConversationId): Promise<ConversationPreview | null>;
  createDirectConversation(participantId: UserId): Promise<ConversationPreview>;
}
