"use client";

import { useCallback, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { formatBytes } from "@/lib/format";
import type { FileTransferEngineHandle } from "@/lib/webrtc/types";
import type { TransferProgressView } from "@/lib/webrtc/file-transfer-engine";
import { openFilePicker } from "./file-picker";

interface FileTransferLabPanelProps {
  engine: FileTransferEngineHandle | null;
  channelOpen: boolean;
  remoteLabel: string;
  localLabel: string;
}

const EMPTY: TransferProgressView[] = [];

function percent(t: TransferProgressView): number {
  if (t.sizeBytes === 0) return t.phase === "completed" ? 100 : 0;
  return Math.min(100, Math.round((t.bytesTransferred / t.sizeBytes) * 100));
}

function useTransferList(engine: FileTransferEngineHandle | null): TransferProgressView[] {
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      if (!engine) return () => undefined;
      return engine.onProgress(() => onStoreChange());
    },
    [engine],
  );
  const getSnapshot = useCallback(() => (engine ? engine.list() : EMPTY), [engine]);
  return useSyncExternalStore(subscribe, getSnapshot, () => EMPTY);
}

export function FileTransferLabPanel({
  engine,
  channelOpen,
  remoteLabel,
  localLabel,
}: FileTransferLabPanelProps) {
  const transfers = useTransferList(engine);
  const [dragOver, setDragOver] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canPick = Boolean(channelOpen && engine);

  const maxLabel = useMemo(() => {
    if (!engine) return "";
    return formatBytes(engine.maxFileSizeBytes);
  }, [engine]);

  const sendFiles = useCallback(
    async (files: FileList | File[]) => {
      setLocalError(null);
      if (!engine || !channelOpen) {
        setLocalError("File DataChannel is not open yet. Wait until isLive and dataChannel=open.");
        return;
      }
      const list = Array.from(files);
      for (const file of list) {
        try {
          await engine.offerFile(file);
        } catch (err) {
          setLocalError(err instanceof Error ? err.message : "Failed to offer file.");
        }
      }
    },
    [engine, channelOpen],
  );

  return (
    <section className="rounded-2xl border border-[var(--rc-border)] bg-[var(--rc-surface)] p-4">
      <h2 className="mb-1 text-sm font-semibold text-[var(--rc-ink)]">4. P2P file transfer</h2>
      <p className="mb-3 text-xs text-[var(--rc-muted)]">
        Bytes travel only on the <code>relaychat-file</code> RTCDataChannel. Signaling never
        carries chunks. Offline peers cannot receive. If direct ICE fails, TURN may relay
        encrypted WebRTC traffic — still not Socket.IO file relay.
      </p>

      <p className="mb-3 text-xs text-[var(--rc-muted)]">
        Channel:{" "}
        <strong>{channelOpen ? "open" : "not open"}</strong>
        {engine ? ` · max ${maxLabel} · chunk ${formatBytes(engine.chunkSizeBytes)}` : ""}
      </p>

      <div
        className={`rounded-xl border border-dashed px-4 py-6 text-center text-sm transition-colors ${
          dragOver
            ? "border-[var(--rc-accent)] bg-[var(--rc-accent-soft)]"
            : "border-[var(--rc-border)] bg-[var(--rc-surface-2)]"
        }`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          void sendFiles(e.dataTransfer.files);
        }}
      >
        <p className="text-[var(--rc-ink)]">Drop a file here or choose one</p>
        <p className="mt-1 text-xs text-[var(--rc-muted)]">
          Sender: {localLabel || "you"} → Receiver: {remoteLabel || "peer"}
        </p>
        {/*
          Use a real button + input.click() — Chrome often ignores clicks on a <label>
          that wraps an sr-only / disabled file input.
        */}
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          tabIndex={-1}
          aria-hidden="true"
          disabled={!canPick}
          onChange={(e) => {
            if (e.target.files?.length) void sendFiles(e.target.files);
            e.target.value = "";
          }}
        />
        <button
          type="button"
          className={`mt-3 inline-block rounded-xl px-4 py-2 text-sm font-semibold text-white ${
            canPick
              ? "cursor-pointer bg-[var(--rc-accent)]"
              : "cursor-not-allowed bg-[var(--rc-muted)] opacity-60"
          }`}
          disabled={!canPick}
          onClick={() => {
            if (!openFilePicker(fileInputRef.current)) {
              setLocalError("File picker unavailable. Wait until the DataChannel is open.");
            }
          }}
        >
          Choose file
        </button>
      </div>

      {localError ? (
        <p className="mt-3 rounded-xl bg-[var(--rc-danger-soft)] px-3 py-2 text-sm text-[var(--rc-danger)]" role="alert">
          {localError}
        </p>
      ) : null}

      <ul className="mt-4 flex flex-col gap-2" aria-label="Active file transfers">
        {transfers.length === 0 ? (
          <li className="text-xs text-[var(--rc-muted)]">No transfers yet.</li>
        ) : (
          transfers.map((t) => {
            const pct = percent(t);
            return (
              <li
                key={t.transferId}
                className="rounded-xl border border-[var(--rc-border)] bg-[var(--rc-surface-2)] px-3 py-2.5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-[var(--rc-ink)]">{t.fileName}</p>
                    <p className="text-xs text-[var(--rc-muted)]">
                      {t.direction === "send" ? "Sending" : "Receiving"} · {formatBytes(t.bytesTransferred)}{" "}
                      / {formatBytes(t.sizeBytes)} · {t.phase}
                      {t.direction === "send" ? ` → ${remoteLabel || "peer"}` : ` ← ${remoteLabel || "peer"}`}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs font-medium text-[var(--rc-accent)]">{pct}%</span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--rc-border)]">
                  <div
                    className="h-full rounded-full bg-[var(--rc-accent)] transition-[width]"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                {t.errorMessage ? (
                  <p className="mt-2 text-xs text-[var(--rc-danger)]">{t.errorMessage}</p>
                ) : null}
                <div className="mt-2 flex flex-wrap gap-2">
                  {t.direction === "receive" && t.phase === "offered" && engine ? (
                    <>
                      <button
                        type="button"
                        className="rounded-lg bg-[var(--rc-accent)] px-3 py-1 text-xs font-semibold text-white"
                        onClick={() => engine.accept(t.transferId)}
                      >
                        Accept
                      </button>
                      <button
                        type="button"
                        className="rounded-lg border border-[var(--rc-border)] px-3 py-1 text-xs"
                        onClick={() => engine.reject(t.transferId)}
                      >
                        Reject
                      </button>
                    </>
                  ) : null}
                  {t.phase !== "completed" &&
                  t.phase !== "failed" &&
                  t.phase !== "cancelled" &&
                  t.phase !== "rejected" &&
                  engine ? (
                    <button
                      type="button"
                      className="rounded-lg border border-[var(--rc-border)] px-3 py-1 text-xs"
                      onClick={() => engine.cancel(t.transferId)}
                    >
                      Cancel
                    </button>
                  ) : null}
                  {t.phase === "completed" && t.objectUrl ? (
                    <a
                      className="rounded-lg bg-[var(--rc-accent)] px-3 py-1 text-xs font-semibold text-white"
                      href={t.objectUrl}
                      download={t.fileName}
                    >
                      Save file
                    </a>
                  ) : null}
                </div>
              </li>
            );
          })
        )}
      </ul>
    </section>
  );
}
