/**
 * WebRTC and realtime integration surface.
 * Keep peer/signaling logic behind these exports — never inside unrelated UI.
 */
export {
  authProviderStub,
  conversationServiceStub,
  fileTransferServiceStub,
  messageServiceStub,
  peerConnectionManagerStub,
  signalingClientStub,
} from "./stubs";

export type {
  PeerConnectionLifecycle,
  PeerConnectionService,
  PeerConnectionSnapshot,
  PeerSessionDescriptor,
} from "@/lib/webrtc/types";
export {
  createPeerConnectionService,
  peerConnectionService,
} from "@/lib/webrtc/peer-connection-service";
export { WebRtcNotReadyError, SignalingRequiredError } from "@/lib/webrtc/types";
export { SignalingClient } from "@/lib/webrtc/signaling-client";
export { SIGNAL_EVENTS } from "@/lib/webrtc/signaling-events";
export {
  FILE_CHANNEL_LABEL,
  DEFAULT_MAX_FILE_SIZE,
  DEFAULT_CHUNK_SIZE,
} from "@/lib/webrtc/file-protocol";
export { FileTransferEngine } from "@/lib/webrtc/file-transfer-engine";
export type { TransferProgressView } from "@/lib/webrtc/file-transfer-engine";
export type { FileTransferEngineHandle } from "@/lib/webrtc/types";
