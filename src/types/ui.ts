/**
 * High-level UI workspace states for Phase 1.
 * These are local UI states — not live network status.
 */
export type WorkspaceView = "chat" | "profile" | "settings";

export type WorkspaceLoadState =
  | "loading"
  | "ready"
  | "empty"
  | "error"
  | "disconnected";
