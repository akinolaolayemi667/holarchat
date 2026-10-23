import type { AuthProvider } from "@/types/auth";
import type { ConversationService } from "@/types/conversation";
import type { FileTransferService } from "@/types/file-transfer";
import type { MessageService } from "@/types/message";
import type { PeerConnectionManager } from "@/types/peer";
import type { SignalingClient } from "@/types/signaling";

/**
 * Honest stubs for future integrations.
 * Calling these throws so we never silently pretend they work.
 */
function notImplemented(feature: string): never {
  throw new Error(
    `[RelayChat] ${feature} is not implemented yet. Phase 1 is a UI prototype only.`,
  );
}

export const authProviderStub: AuthProvider = {
  getSession: async () => notImplemented("Authentication"),
  signInWithEmail: async () => notImplemented("Authentication"),
  signUpWithEmail: async () => notImplemented("Authentication"),
  signOut: async () => notImplemented("Authentication"),
  onAuthStateChange: () => notImplemented("Authentication"),
};

export const conversationServiceStub: ConversationService = {
  listConversations: async () => notImplemented("Conversation service"),
  getConversation: async () => notImplemented("Conversation service"),
  createDirectConversation: async () => notImplemented("Conversation service"),
};

export const messageServiceStub: MessageService = {
  listMessages: async () => notImplemented("Message service"),
  sendTextMessage: async () => notImplemented("Message service"),
};

export const signalingClientStub: SignalingClient = {
  connect: async () => notImplemented("Signaling"),
  disconnect: () => notImplemented("Signaling"),
  send: async () => notImplemented("Signaling"),
  onEvent: () => notImplemented("Signaling"),
  getConnectionState: () => "disconnected",
};

export const peerConnectionManagerStub: PeerConnectionManager = {
  open: async () => notImplemented("Peer connection"),
  get: () => null,
  close: () => notImplemented("Peer connection"),
};

export const fileTransferServiceStub: FileTransferService = {
  maxFileSizeBytes: 100 * 1024 * 1024,
  chunkSizeBytes: 16 * 1024,
  sendFile: async () => notImplemented("File transfer"),
  cancel: async () => notImplemented("File transfer"),
  onProgress: () => notImplemented("File transfer"),
  listActive: () => [],
};
