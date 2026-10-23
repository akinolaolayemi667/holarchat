import { formatBytes } from "@/lib/format";
import type { FileTransferProgress } from "@/types/file-transfer";

interface FileTransferPanelProps {
  transfers: FileTransferProgress[];
}

export function FileTransferPanel({ transfers }: FileTransferPanelProps) {
  if (transfers.length === 0) {
    return (
      <div className="border-t border-[var(--rc-border)] px-4 py-3 text-xs text-[var(--rc-muted)]">
        No file transfers. When peer transfer is implemented, progress will appear here.
      </div>
    );
  }

  return (
    <section
      className="border-t border-[var(--rc-border)] bg-[var(--rc-surface-2)]/70 px-4 py-3"
      aria-label="File transfer status"
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="text-xs font-semibold tracking-wide text-[var(--rc-ink)] uppercase">
          File transfers
        </h3>
        <span className="rounded-full bg-[var(--rc-warning-soft)] px-2 py-0.5 text-[10px] font-medium text-[var(--rc-warning)]">
          Demo preview
        </span>
      </div>
      <ul className="flex flex-col gap-2">
        {transfers.map((transfer) => {
          const pct = Math.round((transfer.bytesTransferred / transfer.sizeBytes) * 100);
          return (
            <li
              key={transfer.id}
              className="rounded-xl border border-[var(--rc-border)] bg-[var(--rc-surface)] px-3 py-2.5"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-[var(--rc-ink)]">
                    {transfer.fileName}
                  </p>
                  <p className="text-xs text-[var(--rc-muted)]">
                    {transfer.direction === "send" ? "Sending" : "Receiving"} ·{" "}
                    {formatBytes(transfer.bytesTransferred)} / {formatBytes(transfer.sizeBytes)} ·{" "}
                    {transfer.status}
                  </p>
                </div>
                <span className="text-xs font-medium text-[var(--rc-accent)]">{pct}%</span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--rc-border)]">
                <div
                  className="h-full rounded-full bg-[var(--rc-accent)] transition-[width]"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
