import type { ConversationId } from "./conversation";
import type { UserId } from "./user";

export type FileTransferId = string;

export type FileTransferStatus =
  | "queued"
  | "transferring"
  | "paused"
  | "completed"
  | "failed"
  | "cancelled";

export interface FileTransferProgress {
  id: FileTransferId;
  conversationId: ConversationId;
  direction: "send" | "receive";
  peerUserId: UserId;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  bytesTransferred: number;
  status: FileTransferStatus;
  errorMessage?: string;
  /** Demo flag — Phase 1 shows UI only. */
  isDemo: boolean;
}

/**
 * P2P file transfer over RTCDataChannel with chunking, backpressure,
 * progress, cancellation, and size limits — implemented in a later phase.
 */
export interface FileTransferService {
  readonly maxFileSizeBytes: number;
  readonly chunkSizeBytes: number;
  sendFile(conversationId: ConversationId, file: File): Promise<FileTransferId>;
  cancel(transferId: FileTransferId): Promise<void>;
  onProgress(listener: (progress: FileTransferProgress) => void): () => void;
  listActive(): FileTransferProgress[];
}
