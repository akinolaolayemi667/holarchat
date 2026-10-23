import type { ReactNode } from "react";

/**
 * Chat requires a live session — allow blocking/dynamic rendering under Cache Components.
 */
export const instant = false;

export default function ChatLayout({ children }: { children: ReactNode }) {
  return children;
}
