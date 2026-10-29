/**
 * Lab-only helper: when to show the alarming STUN-only TURN warning.
 * Before signaling connects, missing TURN is expected (credentials load after welcome).
 */
export function shouldShowTurnUnavailableBanner(options: {
  hasTurn: boolean;
  signalingState: "disconnected" | "connecting" | "connected" | "error";
  /** True when a credential fetch was attempted and failed. */
  turnFetchFailed: boolean;
}): boolean {
  if (options.hasTurn) return false;
  if (options.turnFetchFailed) return true;
  return options.signalingState === "connected";
}
