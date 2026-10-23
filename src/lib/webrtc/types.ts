/**
 * WebRTC types shared by the browser peer service.
 * A peer is only "connected" when RTCPeerConnection.connectionState === "connected".
 */

import type { TransferProgressView } from "./file-transfer-engine";

export type PeerConnectionLifecycle =
  | "idle"
  | "negotiating"
  | "connected"
  | "disconnected"
  | "failed"
  | "closed";

export type DataChannelLifecycle = "connecting" | "open" | "closing" | "closed";

export interface IceServerConfig {
  urls: string | string[];
  username?: string;
  credential?: string;
}

export interface PeerSessionDescriptor {
  conversationId: string;
  localUserId: string;
  remoteUserId: string;
  iceServers: IceServerConfig[];
  /** Room id used on the signaling server (may match conversationId in the lab). */
  roomId: string;
  /** Milliseconds before negotiation is marked failed. */
  connectTimeoutMs?: number;
}

export interface PeerConnectionSnapshot {
  conversationId: string;
  remoteUserId: string;
  connection: PeerConnectionLifecycle;
  dataChannel: DataChannelLifecycle | null;
  /**
   * True only when the browser reports connectionState === "connected".
   * Signaling handshake success alone must keep this false.
   */
  isLive: boolean;
  lastError?: string;
}

/** Narrow type so UI can depend on the engine without importing the class. */
export interface FileTransferEngineHandle {
  maxFileSizeBytes: number;
  chunkSizeBytes: number;
  offerFile(file: File): Promise<string>;
  accept(transferId: string): void;
  reject(transferId: string, reason?: string): void;
  cancel(transferId: string): void;
  list(): TransferProgressView[];
  onProgress(listener: (p: TransferProgressView) => void): () => void;
  dispose(): void;
}

/**
 * Browser peer-connection service backed by RTCPeerConnection + signaling.
 */
export interface PeerConnectionService {
  getSnapshot(conversationId: string): PeerConnectionSnapshot | null;
  /** Live file-transfer engine once `relaychat-file` DataChannel is open. */
  getFileTransferEngine(conversationId: string): FileTransferEngineHandle | null;
  connect(session: PeerSessionDescriptor): Promise<PeerConnectionSnapshot>;
  /** Handle a remote offer (answerer path). */
  acceptRemoteOffer(
    session: PeerSessionDescriptor,
    remoteSdp: string,
  ): Promise<PeerConnectionSnapshot>;
  handleRemoteAnswer(conversationId: string, remoteSdp: string): Promise<void>;
  handleRemoteIceCandidate(conversationId: string, candidateJson: string): Promise<void>;
  disconnect(conversationId: string): Promise<void>;
  onChange(listener: (snapshot: PeerConnectionSnapshot) => void): () => void;
}

export class WebRtcNotReadyError extends Error {
  constructor(message = "WebRTC peer connections are not available in this environment.") {
    super(message);
    this.name = "WebRtcNotReadyError";
  }
}

export class SignalingRequiredError extends Error {
  constructor(message = "A signaling client is required before opening a peer connection.") {
    super(message);
    this.name = "SignalingRequiredError";
  }
}
