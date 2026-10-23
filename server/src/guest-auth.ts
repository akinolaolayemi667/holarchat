import { randomUUID } from "node:crypto";
import { guestAuthSchema, type GuestAuthInput } from "./validation.js";
import type { GuestIdentity } from "./types.js";

export class GuestAuthRejectedError extends Error {
  readonly code = "GUEST_AUTH_REJECTED";
  constructor(message: string) {
    super(message);
    this.name = "GuestAuthRejectedError";
  }
}

/**
 * Development-only guest identity.
 * Server assigns guestId — clients cannot pick their own identity.
 * Must never be described as secure production authentication.
 */
export function mintGuestIdentity(args: {
  allowGuestIdentity: boolean;
  nodeEnv: "development" | "production";
  authPayload: unknown;
}): GuestIdentity {
  if (args.nodeEnv === "production" || !args.allowGuestIdentity) {
    throw new GuestAuthRejectedError(
      "Guest identity is disabled. Production must use real authentication.",
    );
  }

  const parsed = guestAuthSchema.safeParse(args.authPayload);
  if (!parsed.success) {
    throw new GuestAuthRejectedError("Invalid guest auth payload.");
  }

  const input: GuestAuthInput = parsed.data;
  return {
    guestId: `guest_${randomUUID()}`,
    displayName: input.displayName,
    authMode: "guest-dev",
  };
}
