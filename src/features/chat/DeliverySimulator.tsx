"use client";

/**
 * Explicit test controls for delivery/read states.
 * Never auto-marks messages delivered or read — only when the user clicks.
 */
interface DeliverySimulatorProps {
  enabled: boolean;
  hasOwnSentMessage: boolean;
  onSimulateDelivered: () => void;
  onSimulateRead: () => void;
  onSimulateFailLastPending: () => void;
}

export function DeliverySimulator({
  enabled,
  hasOwnSentMessage,
  onSimulateDelivered,
  onSimulateRead,
  onSimulateFailLastPending,
}: DeliverySimulatorProps) {
  if (!enabled) return null;

  return (
    <div className="border-t border-[var(--rc-border)] bg-[var(--rc-surface-2)] px-3 py-2">
      <p className="mb-1.5 text-[10px] font-semibold tracking-wide text-[var(--rc-muted)] uppercase">
        Simulated receipts (fixture only)
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={!hasOwnSentMessage}
          onClick={onSimulateDelivered}
          className="rounded-lg border border-[var(--rc-border)] bg-[var(--rc-surface)] px-2.5 py-1 text-[11px] text-[var(--rc-ink)] disabled:opacity-40"
        >
          Mark last sent → delivered
        </button>
        <button
          type="button"
          disabled={!hasOwnSentMessage}
          onClick={onSimulateRead}
          className="rounded-lg border border-[var(--rc-border)] bg-[var(--rc-surface)] px-2.5 py-1 text-[11px] text-[var(--rc-ink)] disabled:opacity-40"
        >
          Mark last delivered → read
        </button>
        <button
          type="button"
          onClick={onSimulateFailLastPending}
          className="rounded-lg border border-[var(--rc-border)] bg-[var(--rc-surface)] px-2.5 py-1 text-[11px] text-[var(--rc-danger)]"
        >
          Fail last pending
        </button>
      </div>
    </div>
  );
}
