interface OnlineDotProps {
  status: "online" | "away" | "offline";
  /** Keep labels honest — these are demo visuals. */
  labeled?: boolean;
}

const styles = {
  online: "bg-[var(--rc-online)]",
  away: "bg-[var(--rc-away)]",
  offline: "bg-[var(--rc-offline)]",
};

export function OnlineDot({ status, labeled = false }: OnlineDotProps) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className={`inline-block h-2 w-2 rounded-full ring-2 ring-[var(--rc-surface)] ${styles[status]}`}
        title={`Demo status: ${status}`}
      />
      {labeled ? (
        <span className="text-xs text-[var(--rc-muted)] capitalize">
          Demo · {status}
        </span>
      ) : null}
    </span>
  );
}
