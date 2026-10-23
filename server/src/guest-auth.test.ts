import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { GuestAuthRejectedError, mintGuestIdentity } from "./guest-auth.js";

describe("mintGuestIdentity", () => {
  it("mints a server-assigned guest id in development", () => {
    const identity = mintGuestIdentity({
      allowGuestIdentity: true,
      nodeEnv: "development",
      authPayload: { mode: "guest", displayName: "Alice" },
    });
    assert.match(identity.guestId, /^guest_/);
    assert.equal(identity.authMode, "guest-dev");
    assert.equal(identity.displayName, "Alice");
  });

  it("rejects guest identity in production", () => {
    assert.throws(
      () =>
        mintGuestIdentity({
          allowGuestIdentity: true,
          nodeEnv: "production",
          authPayload: { mode: "guest", displayName: "Alice" },
        }),
      (err: unknown) => err instanceof GuestAuthRejectedError,
    );
  });

  it("rejects when allowGuestIdentity is false", () => {
    assert.throws(
      () =>
        mintGuestIdentity({
          allowGuestIdentity: false,
          nodeEnv: "development",
          authPayload: { mode: "guest", displayName: "Alice" },
        }),
      (err: unknown) => err instanceof GuestAuthRejectedError,
    );
  });

  it("does not trust a client-supplied guestId field", () => {
    const identity = mintGuestIdentity({
      allowGuestIdentity: true,
      nodeEnv: "development",
      authPayload: {
        mode: "guest",
        displayName: "Bob",
        guestId: "guest_attacker-chosen",
      },
    });
    assert.notEqual(identity.guestId, "guest_attacker-chosen");
  });
});
