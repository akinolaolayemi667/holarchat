import type { WorkspaceLoadState } from "@/types/ui";

interface ConnectionStatusBarProps {
  loadState: WorkspaceLoadState;
  onChangeState: (state: WorkspaceLoadState) => void;
}

const LABELS: Record<WorkspaceLoadState, string> = {
  loading: "Loading demo workspace…",
  ready: "Demo mode — signaling not connected",
  empty: "Empty demo state",
  error: "Error state preview",
  disconnected: "Disconnected preview — signaling offline",
};

export function ConnectionStatusBar({ loadState, onChangeState }: ConnectionStatusBarProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--rc-border)] bg-[var(--rc-surface)] px-3 py-2">
      <p className="text-xs text-[var(--rc-muted)]">
        <span
          className={`mr-2 inline-block h-2 w-2 rounded-full ${
            loadState === "ready"
              ? "bg-[var(--rc-away)]"
              : loadState === "error" || loadState === "disconnected"
                ? "bg-[var(--rc-danger)]"
                : "bg-[var(--rc-muted)]"
          }`}
        />
        {LABELS[loadState]}
      </p>
      <label className="flex items-center gap-2 text-[11px] text-[var(--rc-muted)]">
        Preview state
        <select
          value={loadState}
          onChange={(e) => onChangeState(e.target.value as WorkspaceLoadState)}
          className="rounded-lg border border-[var(--rc-border)] bg-[var(--rc-surface-2)] px-2 py-1 text-[var(--rc-ink)] outline-none"
        >
          <option value="ready">Ready (demo)</option>
          <option value="loading">Loading</option>
          <option value="empty">Empty</option>
          <option value="error">Error</option>
          <option value="disconnected">Disconnected</option>
        </select>
      </label>
    </div>
  );
}
