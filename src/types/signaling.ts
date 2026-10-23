import type { ConversationId } from "./conversation";
import type { UserId } from "./user";

/**
 * WebRTC signaling events relayed through a trusted Socket.IO server.
 * The server must authorize both participants before forwarding.
 */
export type SignalingEventType =
  | "offer"
  | "answer"
  | "ice-candidate"
  | "hangup"
  | "error";

export interface SignalingEnvelope {
  type: SignalingEventType;
  conversationId: ConversationId;
  fromUserId: UserId;
  toUserId: UserId;
  payload: unknown;
  /** Server-issued timestamp when relayed. */
  relayedAt?: string;
}

export interface SignalingClient {
  connect(accessToken: string): Promise<void>;
  disconnect(): void;
  send(event: Omit<SignalingEnvelope, "relayedAt">): Promise<void>;
  onEvent(listener: (event: SignalingEnvelope) => void): () => void;
  getConnectionState(): SignalingConnectionState;
}

export type SignalingConnectionState =
  | "disconnected"
  | "connecting"
  | "connected"
  | "error";
