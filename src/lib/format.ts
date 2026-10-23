export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatMessageTime(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export function formatListTime(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  // Avoid `new Date()` (current time) during prerender — format the absolute timestamp.
  return date.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
