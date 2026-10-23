/**
 * RelayChat file-transfer protocol (DataChannel only — never Socket.IO).
 *
 * Channel: "relaychat-file" created by the WebRTC offeror only.
 * Control: UTF-8 JSON strings with { v: 1, type: ... }
 * Chunks: binary frames (see encodeChunkFrame / decodeChunkFrame)
 */

export const FILE_CHANNEL_LABEL = "relaychat-file";
export const PROTOCOL_VERSION = 1;
export const CHUNK_MAGIC = "RCF1"; // 4 ASCII bytes

export const DEFAULT_CHUNK_SIZE = 16 * 1024;
export const DEFAULT_MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MiB
export const DEFAULT_BUFFERED_LOW = 256 * 1024;
export const DEFAULT_BUFFERED_HIGH = 1024 * 1024;
export const DEFAULT_TRANSFER_TIMEOUT_MS = 120_000;

export type FileControlType =
  | "file-offer"
  | "file-accept"
  | "file-reject"
  | "file-complete"
  | "file-received"
  | "file-cancel"
  | "file-error";

export type TransferPhase =
  | "idle"
  | "offered"
  | "accepted"
  | "transferring"
  | "finalizing"
  | "completed"
  | "rejected"
  | "cancelled"
  | "failed";

export interface FileOfferMessage {
  v: typeof PROTOCOL_VERSION;
  type: "file-offer";
  transferId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  chunkSize: number;
  totalChunks: number;
  checksumSha256: string;
}

export interface FileAcceptMessage {
  v: typeof PROTOCOL_VERSION;
  type: "file-accept";
  transferId: string;
}

export interface FileRejectMessage {
  v: typeof PROTOCOL_VERSION;
  type: "file-reject";
  transferId: string;
  reason: string;
}

export interface FileCompleteMessage {
  v: typeof PROTOCOL_VERSION;
  type: "file-complete";
  transferId: string;
}

export interface FileReceivedMessage {
  v: typeof PROTOCOL_VERSION;
  type: "file-received";
  transferId: string;
}

export interface FileCancelMessage {
  v: typeof PROTOCOL_VERSION;
  type: "file-cancel";
  transferId: string;
}

export interface FileErrorMessage {
  v: typeof PROTOCOL_VERSION;
  type: "file-error";
  transferId: string;
  code: string;
  message: string;
}

export type FileControlMessage =
  | FileOfferMessage
  | FileAcceptMessage
  | FileRejectMessage
  | FileCompleteMessage
  | FileReceivedMessage
  | FileCancelMessage
  | FileErrorMessage;

const TRANSFER_ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const SAFE_FILENAME_RE = /^[^<>:"/\\|?*\u0000-\u001f]+$/;

export function isTransferId(value: unknown): value is string {
  return typeof value === "string" && TRANSFER_ID_RE.test(value);
}

/** Sanitize for display/download — never use raw remote names as paths. */
export function sanitizeFileName(raw: string): string {
  const base = raw.replace(/[/\\]/g, "").trim() || "download.bin";
  const clipped = base.slice(0, 180);
  if (!SAFE_FILENAME_RE.test(clipped)) {
    return "download.bin";
  }
  return clipped;
}

export function canTransition(from: TransferPhase, to: TransferPhase): boolean {
  const allowed: Record<TransferPhase, TransferPhase[]> = {
    idle: ["offered"],
    offered: ["accepted", "rejected", "cancelled", "failed"],
    accepted: ["transferring", "cancelled", "failed"],
    transferring: ["finalizing", "cancelled", "failed"],
    finalizing: ["completed", "failed", "cancelled"],
    completed: [],
    rejected: [],
    cancelled: [],
    failed: [],
  };
  return allowed[from]?.includes(to) ?? false;
}

export function parseControlMessage(raw: string): FileControlMessage {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Control message is not valid JSON.");
  }
  if (!parsed || typeof parsed !== "object") {
    throw new Error("Control message must be an object.");
  }
  const msg = parsed as Record<string, unknown>;
  if (msg.v !== PROTOCOL_VERSION) {
    throw new Error("Unsupported protocol version.");
  }
  if (typeof msg.type !== "string" || typeof msg.transferId !== "string") {
    throw new Error("Missing type or transferId.");
  }
  if (!isTransferId(msg.transferId)) {
    throw new Error("Invalid transferId.");
  }

  switch (msg.type) {
    case "file-offer": {
      if (
        typeof msg.fileName !== "string" ||
        typeof msg.mimeType !== "string" ||
        typeof msg.sizeBytes !== "number" ||
        typeof msg.chunkSize !== "number" ||
        typeof msg.totalChunks !== "number" ||
        typeof msg.checksumSha256 !== "string"
      ) {
        throw new Error("Invalid file-offer fields.");
      }
      if (
        !Number.isInteger(msg.sizeBytes) ||
        msg.sizeBytes < 0 ||
        !Number.isInteger(msg.chunkSize) ||
        msg.chunkSize < 1 ||
        !Number.isInteger(msg.totalChunks) ||
        msg.totalChunks < 1 ||
        !/^[a-f0-9]{64}$/i.test(msg.checksumSha256)
      ) {
        throw new Error("file-offer failed numeric/checksum validation.");
      }
      return {
        v: PROTOCOL_VERSION,
        type: "file-offer",
        transferId: msg.transferId,
        fileName: sanitizeFileName(msg.fileName),
        mimeType: msg.mimeType.slice(0, 128) || "application/octet-stream",
        sizeBytes: msg.sizeBytes,
        chunkSize: msg.chunkSize,
        totalChunks: msg.totalChunks,
        checksumSha256: msg.checksumSha256.toLowerCase(),
      };
    }
    case "file-accept":
      return { v: PROTOCOL_VERSION, type: "file-accept", transferId: msg.transferId };
    case "file-reject":
      return {
        v: PROTOCOL_VERSION,
        type: "file-reject",
        transferId: msg.transferId,
        reason: typeof msg.reason === "string" ? msg.reason.slice(0, 200) : "rejected",
      };
    case "file-complete":
      return { v: PROTOCOL_VERSION, type: "file-complete", transferId: msg.transferId };
    case "file-received":
      return { v: PROTOCOL_VERSION, type: "file-received", transferId: msg.transferId };
    case "file-cancel":
      return { v: PROTOCOL_VERSION, type: "file-cancel", transferId: msg.transferId };
    case "file-error":
      return {
        v: PROTOCOL_VERSION,
        type: "file-error",
        transferId: msg.transferId,
        code: typeof msg.code === "string" ? msg.code.slice(0, 64) : "ERROR",
        message: typeof msg.message === "string" ? msg.message.slice(0, 300) : "error",
      };
    default:
      throw new Error(`Unknown control type: ${String(msg.type)}`);
  }
}

export function encodeControlMessage(message: FileControlMessage): string {
  return JSON.stringify(message);
}

/**
 * Binary chunk frame:
 * magic(4) + transferId(36 utf8) + chunkIndex(uint32 BE) + payloadLength(uint32 BE) + payload
 */
export function encodeChunkFrame(
  transferId: string,
  chunkIndex: number,
  payload: Uint8Array,
): ArrayBuffer {
  if (!isTransferId(transferId)) throw new Error("Invalid transferId for chunk.");
  const header = 4 + 36 + 4 + 4;
  const buffer = new ArrayBuffer(header + payload.byteLength);
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);
  bytes.set([0x52, 0x43, 0x46, 0x31], 0); // RCF1
  const idBytes = new TextEncoder().encode(transferId);
  if (idBytes.byteLength !== 36) throw new Error("transferId must be 36 chars.");
  bytes.set(idBytes, 4);
  view.setUint32(40, chunkIndex, false);
  view.setUint32(44, payload.byteLength, false);
  bytes.set(payload, 48);
  return buffer;
}

export function decodeChunkFrame(buffer: ArrayBuffer): {
  transferId: string;
  chunkIndex: number;
  payload: Uint8Array;
} {
  if (buffer.byteLength < 48) throw new Error("Chunk frame too short.");
  const bytes = new Uint8Array(buffer);
  const magic = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]);
  if (magic !== CHUNK_MAGIC) throw new Error("Bad chunk magic.");
  const transferId = new TextDecoder().decode(bytes.subarray(4, 40));
  if (!isTransferId(transferId)) throw new Error("Bad transferId in chunk.");
  const view = new DataView(buffer);
  const chunkIndex = view.getUint32(40, false);
  const payloadLength = view.getUint32(44, false);
  if (48 + payloadLength !== buffer.byteLength) {
    throw new Error("Chunk payload length mismatch.");
  }
  return {
    transferId,
    chunkIndex,
    payload: bytes.subarray(48),
  };
}

export function totalChunksForSize(sizeBytes: number, chunkSize: number): number {
  if (sizeBytes === 0) return 1;
  return Math.ceil(sizeBytes / chunkSize);
}
