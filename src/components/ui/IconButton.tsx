import type { ButtonHTMLAttributes, ReactNode } from "react";

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  children: ReactNode;
  tone?: "default" | "accent" | "danger";
}

export function IconButton({
  label,
  children,
  tone = "default",
  className = "",
  ...props
}: IconButtonProps) {
  const toneClass =
    tone === "accent"
      ? "bg-[var(--rc-accent)] text-white hover:brightness-110"
      : tone === "danger"
        ? "text-[var(--rc-danger)] hover:bg-[var(--rc-danger-soft)]"
        : "text-[var(--rc-muted)] hover:bg-[var(--rc-surface-2)] hover:text-[var(--rc-ink)]";

  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={`inline-flex h-10 w-10 items-center justify-center rounded-xl transition ${toneClass} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
