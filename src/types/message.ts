import type { ConversationId } from "./conversation";
import type { UserId } from "./user";

export type MessageId = string;

export type MessageKind = "text" | "file_notice" | "system";

export interface ChatMessage {
  id: MessageId;
  conversationId: ConversationId;
  senderId: UserId;
  kind: MessageKind;
  body: string;
  createdAt: string;
  /** True when this message is from the local demo user. */
  isOwn: boolean;
  /** Optional file metadata for file_notice messages (demo display only). */
  fileMeta?: {
    name: string;
    sizeBytes: number;
    mimeType: string;
  };
}

export interface MessageService {
  listMessages(conversationId: ConversationId): Promise<ChatMessage[]>;
  sendTextMessage(conversationId: ConversationId, body: string): Promise<ChatMessage>;
}
