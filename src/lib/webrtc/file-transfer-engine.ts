"use client";

import { planChunks, reassembleChunks, sliceChunk } from "./file-chunks";
import { checksumsMatch, sha256File, sha256Hex } from "./file-checksum";
import {
  DEFAULT_BUFFERED_HIGH,
  DEFAULT_BUFFERED_LOW,
  DEFAULT_CHUNK_SIZE,
  DEFAULT_MAX_FILE_SIZE,
  DEFAULT_TRANSFER_TIMEOUT_MS,
  PROTOCOL_VERSION,
  canTransition,
  decodeChunkFrame,
  encodeChunkFrame,
  encodeControlMessage,
  parseControlMessage,
  sanitizeFileName,
  type FileControlMessage,
  type FileOfferMessage,
  type TransferPhase,
} from "./file-protocol";

export const MAX_CONCURRENT_TRANSFERS = 4;

export interface TransferProgressView {
  transferId: string;
  direction: "send" | "receive";
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  bytesTransferred: number;
  totalChunks: number;
  chunksCompleted: number;
  phase: TransferPhase;
  errorMessage?: string;
  /** Object URL for completed receive — revoke when done. */
  objectUrl?: string;
}

export interface FileTransferEngineOptions {
  maxFileSizeBytes?: number;
  chunkSizeBytes?: number;
  bufferedHigh?: number;
  bufferedLow?: number;
  transferTimeoutMs?: number;
  maxConcurrent?: number;
  send: (data: string | ArrayBuffer) => void;
  getBufferedAmount: () => number;
  setBufferedAmountLowThreshold: (n: number) => void;
  onBufferedAmountLow: (cb: () => void) => () => void;
}

interface ActiveTransfer {
  direction: "send" | "receive";
  phase: TransferPhase;
  offer: FileOfferMessage;
  bytesTransferred: number;
  chunks: Map<number, Uint8Array>;
  chunksCompleted: number;
  timeoutId: ReturnType<typeof setTimeout> | null;
  objectUrl?: string;
  errorMessage?: string;
  sourceBytes?: Uint8Array;
  nextChunkIndex?: number;
  waitingForBuffer?: boolean;
}

/**
 * File transfer over an open RTCDataChannel.
 * Bytes never leave the DataChannel path.
 */
export class FileTransferEngine {
  readonly maxFileSizeBytes: number;
  readonly chunkSizeBytes: number;
  private readonly bufferedHigh: number;
  private readonly bufferedLow: number;
  private readonly transferTimeoutMs: number;
  private readonly maxConcurrent: number;
  private readonly transfers = new Map<string, ActiveTransfer>();
  private readonly listeners = new Set<(p: TransferProgressView) => void>();
  private cachedList: TransferProgressView[] = [];
  private removeLowListener: (() => void) | null = null;
  private disposed = false;

  constructor(private readonly opts: FileTransferEngineOptions) {
    this.maxFileSizeBytes = opts.maxFileSizeBytes ?? DEFAULT_MAX_FILE_SIZE;
    this.chunkSizeBytes = opts.chunkSizeBytes ?? DEFAULT_CHUNK_SIZE;
    this.bufferedHigh = opts.bufferedHigh ?? DEFAULT_BUFFERED_HIGH;
    this.bufferedLow = opts.bufferedLow ?? DEFAULT_BUFFERED_LOW;
    this.transferTimeoutMs = opts.transferTimeoutMs ?? DEFAULT_TRANSFER_TIMEOUT_MS;
    this.maxConcurrent = opts.maxConcurrent ?? MAX_CONCURRENT_TRANSFERS;
    opts.setBufferedAmountLowThreshold(this.bufferedLow);
    this.removeLowListener = opts.onBufferedAmountLow(() => this.resumeSends());
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.removeLowListener?.();
    this.removeLowListener = null;
    for (const [id, t] of [...this.transfers.entries()]) {
      this.clearTimeout(t);
      if (
        t.phase !== "completed" &&
        t.phase !== "failed" &&
        t.phase !== "cancelled" &&
        t.phase !== "rejected"
      ) {
        this.failTransfer(id, "CHANNEL_CLOSED", "DataChannel closed.");
      } else {
        this.revoke(t);
      }
    }
  }

  onProgress(listener: (p: TransferProgressView) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Stable reference until the next progress publish (safe for useSyncExternalStore). */
  list(): TransferProgressView[] {
    return this.cachedList;
  }

  /** Handle an incoming DataChannel message (string control or ArrayBuffer chunk). */
  handleMessage(data: string | ArrayBuffer): void {
    if (this.disposed) return;
    if (typeof data === "string") {
      this.handleControl(parseControlMessage(data));
      return;
    }
    const frame = decodeChunkFrame(data);
    this.handleChunk(frame.transferId, frame.chunkIndex, frame.payload);
  }

  async offerFile(file: File): Promise<string> {
    if (this.disposed) throw new Error("File transfer engine is disposed.");
    if (file.size > this.maxFileSizeBytes) {
      throw new Error(
        `File exceeds max size of ${this.maxFileSizeBytes} bytes (${file.size} bytes).`,
      );
    }
    if (this.activeCount() >= this.maxConcurrent) {
      throw new Error(`Too many concurrent transfers (max ${this.maxConcurrent}).`);
    }

    const transferId = crypto.randomUUID();
    const checksumSha256 = await sha256File(file);
    const { totalChunks } = planChunks(file.size, this.chunkSizeBytes);
    const sourceBytes = new Uint8Array(await file.arrayBuffer());

    const offer: FileOfferMessage = {
      v: PROTOCOL_VERSION,
      type: "file-offer",
      transferId,
      fileName: sanitizeFileName(file.name),
      mimeType: file.type || "application/octet-stream",
      sizeBytes: file.size,
      chunkSize: this.chunkSizeBytes,
      totalChunks,
      checksumSha256,
    };

    const active: ActiveTransfer = {
      direction: "send",
      phase: "offered",
      offer,
      bytesTransferred: 0,
      chunks: new Map(),
      chunksCompleted: 0,
      timeoutId: null,
      sourceBytes,
      nextChunkIndex: 0,
      waitingForBuffer: false,
    };
    this.transfers.set(transferId, active);
    this.armTimeout(transferId);
    this.publish(active);
    this.opts.send(encodeControlMessage(offer));
    return transferId;
  }

  accept(transferId: string): void {
    const t = this.require(transferId, "receive");
    this.transition(t, "accepted");
    this.opts.send(
      encodeControlMessage({
        v: PROTOCOL_VERSION,
        type: "file-accept",
        transferId,
      }),
    );
    this.transition(t, "transferring");
    this.publish(t);
  }

  reject(transferId: string, reason = "Receiver declined"): void {
    const t = this.transfers.get(transferId);
    if (!t || t.direction !== "receive") return;
    this.transition(t, "rejected");
    t.errorMessage = reason;
    this.opts.send(
      encodeControlMessage({
        v: PROTOCOL_VERSION,
        type: "file-reject",
        transferId,
        reason,
      }),
    );
    this.clearTimeout(t);
    this.publish(t);
  }

  cancel(transferId: string): void {
    const t = this.transfers.get(transferId);
    if (!t) return;
    if (t.phase === "completed" || t.phase === "failed" || t.phase === "cancelled") return;
    this.transition(t, "cancelled");
    this.opts.send(
      encodeControlMessage({
        v: PROTOCOL_VERSION,
        type: "file-cancel",
        transferId,
      }),
    );
    this.revoke(t);
    this.clearTimeout(t);
    this.publish(t);
  }

  /** Exposed for unit tests — current outbound buffer gate. */
  isWaitingForBuffer(transferId: string): boolean {
    return Boolean(this.transfers.get(transferId)?.waitingForBuffer);
  }

  private activeCount(): number {
    let n = 0;
    for (const t of this.transfers.values()) {
      if (
        t.phase !== "completed" &&
        t.phase !== "failed" &&
        t.phase !== "cancelled" &&
        t.phase !== "rejected"
      ) {
        n += 1;
      }
    }
    return n;
  }

  private handleControl(msg: FileControlMessage): void {
    switch (msg.type) {
      case "file-offer":
        this.onRemoteOffer(msg);
        break;
      case "file-accept":
        this.onRemoteAccept(msg.transferId);
        break;
      case "file-reject":
        this.onRemoteReject(msg.transferId, msg.reason);
        break;
      case "file-complete":
        void this.onRemoteComplete(msg.transferId);
        break;
      case "file-received":
        this.onRemoteReceived(msg.transferId);
        break;
      case "file-cancel":
        this.onRemoteCancel(msg.transferId);
        break;
      case "file-error":
        this.failTransfer(msg.transferId, msg.code, msg.message);
        break;
    }
  }

  private onRemoteOffer(offer: FileOfferMessage): void {
    if (offer.sizeBytes > this.maxFileSizeBytes) {
      this.opts.send(
        encodeControlMessage({
          v: PROTOCOL_VERSION,
          type: "file-reject",
          transferId: offer.transferId,
          reason: `File exceeds max size (${this.maxFileSizeBytes} bytes).`,
        }),
      );
      return;
    }
    if (this.transfers.has(offer.transferId)) {
      this.opts.send(
        encodeControlMessage({
          v: PROTOCOL_VERSION,
          type: "file-error",
          transferId: offer.transferId,
          code: "DUPLICATE",
          message: "Transfer id already exists.",
        }),
      );
      return;
    }
    if (this.activeCount() >= this.maxConcurrent) {
      this.opts.send(
        encodeControlMessage({
          v: PROTOCOL_VERSION,
          type: "file-reject",
          transferId: offer.transferId,
          reason: `Too many concurrent transfers (max ${this.maxConcurrent}).`,
        }),
      );
      return;
    }
    const active: ActiveTransfer = {
      direction: "receive",
      phase: "offered",
      offer,
      bytesTransferred: 0,
      chunks: new Map(),
      chunksCompleted: 0,
      timeoutId: null,
    };
    this.transfers.set(offer.transferId, active);
    this.armTimeout(offer.transferId);
    this.publish(active);
  }

  private onRemoteAccept(transferId: string): void {
    const t = this.transfers.get(transferId);
    if (!t || t.direction !== "send") return;
    this.transition(t, "accepted");
    this.transition(t, "transferring");
    this.publish(t);
    this.pumpSend(transferId);
  }

  private onRemoteReject(transferId: string, reason: string): void {
    const t = this.transfers.get(transferId);
    if (!t || t.direction !== "send") return;
    this.transition(t, "rejected");
    t.errorMessage = reason;
    this.clearTimeout(t);
    this.publish(t);
  }

  private onRemoteCancel(transferId: string): void {
    const t = this.transfers.get(transferId);
    if (!t) return;
    if (t.phase === "completed" || t.phase === "failed") return;
    this.transition(t, "cancelled");
    this.revoke(t);
    this.clearTimeout(t);
    this.publish(t);
  }

  private onRemoteReceived(transferId: string): void {
    const t = this.transfers.get(transferId);
    if (!t || t.direction !== "send") return;
    this.transition(t, "completed");
    // Drop source bytes after success to free memory.
    t.sourceBytes = undefined;
    this.clearTimeout(t);
    this.publish(t);
  }

  private handleChunk(transferId: string, chunkIndex: number, payload: Uint8Array): void {
    const t = this.transfers.get(transferId);
    if (!t || t.direction !== "receive") {
      throw new Error("Unexpected chunk for unknown receive transfer.");
    }
    if (t.phase === "accepted") this.transition(t, "transferring");
    if (t.phase !== "transferring") {
      throw new Error(`Chunk received in invalid phase: ${t.phase}`);
    }
    if (chunkIndex < 0 || chunkIndex >= t.offer.totalChunks) {
      throw new Error("Chunk index out of range.");
    }
    if (t.chunks.has(chunkIndex)) {
      return;
    }
    const start = chunkIndex * t.offer.chunkSize;
    const end = Math.min(start + t.offer.chunkSize, t.offer.sizeBytes);
    const expectedLen = t.offer.sizeBytes === 0 ? 0 : end - start;
    if (payload.byteLength !== expectedLen) {
      throw new Error("Unexpected chunk payload size.");
    }
    t.chunks.set(chunkIndex, payload);
    t.chunksCompleted = t.chunks.size;
    t.bytesTransferred = [...t.chunks.values()].reduce((n, c) => n + c.byteLength, 0);
    this.armTimeout(transferId);
    this.publish(t);
  }

  private async onRemoteComplete(transferId: string): Promise<void> {
    const t = this.transfers.get(transferId);
    if (!t || t.direction !== "receive") return;
    this.transition(t, "finalizing");
    this.publish(t);
    try {
      const bytes = reassembleChunks(t.chunks, t.offer.totalChunks, t.offer.sizeBytes);
      const actual = await sha256Hex(bytes);
      if (!checksumsMatch(t.offer.checksumSha256, actual)) {
        this.failTransfer(transferId, "CHECKSUM_MISMATCH", "Checksum verification failed.");
        this.opts.send(
          encodeControlMessage({
            v: PROTOCOL_VERSION,
            type: "file-error",
            transferId,
            code: "CHECKSUM_MISMATCH",
            message: "Receiver checksum mismatch.",
          }),
        );
        return;
      }
      const copy = new Uint8Array(bytes.byteLength);
      copy.set(bytes);
      const blob = new Blob([copy], { type: t.offer.mimeType });
      t.objectUrl = URL.createObjectURL(blob);
      this.transition(t, "completed");
      this.clearTimeout(t);
      this.publish(t);
      this.opts.send(
        encodeControlMessage({
          v: PROTOCOL_VERSION,
          type: "file-received",
          transferId,
        }),
      );
    } catch (err) {
      this.failTransfer(
        transferId,
        "REASSEMBLY_FAILED",
        err instanceof Error ? err.message : "Reassembly failed.",
      );
    }
  }

  private pumpSend(transferId: string): void {
    const t = this.transfers.get(transferId);
    if (!t || t.direction !== "send" || t.phase !== "transferring" || !t.sourceBytes) return;

    while ((t.nextChunkIndex ?? 0) < t.offer.totalChunks) {
      if (this.opts.getBufferedAmount() >= this.bufferedHigh) {
        t.waitingForBuffer = true;
        this.publish(t);
        return;
      }
      const index = t.nextChunkIndex ?? 0;
      const payload = sliceChunk(t.sourceBytes, index, t.offer.chunkSize);
      // Copy payload into a standalone buffer for the frame (source may be GC'd later).
      const payloadCopy = new Uint8Array(payload.byteLength);
      payloadCopy.set(payload);
      this.opts.send(encodeChunkFrame(transferId, index, payloadCopy));
      t.nextChunkIndex = index + 1;
      t.chunksCompleted = t.nextChunkIndex;
      t.bytesTransferred = Math.min(
        t.offer.sizeBytes,
        t.bytesTransferred + payload.byteLength,
      );
      this.armTimeout(transferId);
      this.publish(t);
    }

    this.transition(t, "finalizing");
    this.opts.send(
      encodeControlMessage({
        v: PROTOCOL_VERSION,
        type: "file-complete",
        transferId,
      }),
    );
    this.publish(t);
  }

  private resumeSends(): void {
    for (const [id, t] of this.transfers) {
      if (t.direction === "send" && t.phase === "transferring" && t.waitingForBuffer) {
        t.waitingForBuffer = false;
        this.pumpSend(id);
      }
    }
  }

  private transition(t: ActiveTransfer, to: TransferPhase): void {
    if (!canTransition(t.phase, to) && t.phase !== to) {
      throw new Error(`Invalid transfer transition ${t.phase} → ${to}`);
    }
    t.phase = to;
  }

  private failTransfer(transferId: string, code: string, message: string): void {
    const t = this.transfers.get(transferId);
    if (!t) return;
    if (t.phase === "completed" || t.phase === "failed") return;
    try {
      this.transition(t, "failed");
    } catch {
      t.phase = "failed";
    }
    t.errorMessage = `${code}: ${message}`;
    t.sourceBytes = undefined;
    this.revoke(t);
    this.clearTimeout(t);
    this.publish(t);
  }

  private require(transferId: string, direction: "send" | "receive"): ActiveTransfer {
    const t = this.transfers.get(transferId);
    if (!t || t.direction !== direction) {
      throw new Error("Transfer not found for this direction.");
    }
    return t;
  }

  private armTimeout(transferId: string): void {
    const t = this.transfers.get(transferId);
    if (!t) return;
    this.clearTimeout(t);
    t.timeoutId = setTimeout(() => {
      this.failTransfer(transferId, "TIMEOUT", "Transfer timed out.");
    }, this.transferTimeoutMs);
  }

  private clearTimeout(t: ActiveTransfer): void {
    if (t.timeoutId) {
      clearTimeout(t.timeoutId);
      t.timeoutId = null;
    }
  }

  private revoke(t: ActiveTransfer): void {
    if (t.objectUrl) {
      URL.revokeObjectURL(t.objectUrl);
      t.objectUrl = undefined;
    }
  }

  private toView(t: ActiveTransfer): TransferProgressView {
    return {
      transferId: t.offer.transferId,
      direction: t.direction,
      fileName: t.offer.fileName,
      mimeType: t.offer.mimeType,
      sizeBytes: t.offer.sizeBytes,
      bytesTransferred: t.bytesTransferred,
      totalChunks: t.offer.totalChunks,
      chunksCompleted: t.chunksCompleted,
      phase: t.phase,
      errorMessage: t.errorMessage,
      objectUrl: t.objectUrl,
    };
  }

  private rebuildCache(): void {
    this.cachedList = [...this.transfers.values()].map((t) => this.toView(t));
  }

  private publish(t: ActiveTransfer): void {
    this.rebuildCache();
    const view = this.toView(t);
    this.listeners.forEach((l) => l(view));
  }
}
