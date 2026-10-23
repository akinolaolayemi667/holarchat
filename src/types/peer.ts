import type { ConversationId } from "./conversation";
import type { UserId } from "./user";

export type PeerConnectionState =
  | "new"
  | "connecting"
  | "connected"
  | "disconnected"
  | "failed"
  | "closed";

export interface PeerConnectionHandle {
  conversationId: ConversationId;
  remoteUserId: UserId;
  getState(): PeerConnectionState;
  close(): void;
}

/**
 * Factory for RTCPeerConnection wrappers.
 * Implementation belongs in a later phase — keep UI free of WebRTC details.
 */
export interface PeerConnectionManager {
  open(conversationId: ConversationId, remoteUserId: UserId): Promise<PeerConnectionHandle>;
  get(conversationId: ConversationId): PeerConnectionHandle | null;
  close(conversationId: ConversationId): void;
}
