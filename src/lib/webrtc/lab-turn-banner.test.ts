import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { shouldShowTurnUnavailableBanner } from "./lab-turn-banner";

describe("shouldShowTurnUnavailableBanner", () => {
  it("hides the alarm before signaling connects when TURN is not loaded yet", () => {
    assert.equal(
      shouldShowTurnUnavailableBanner({
        hasTurn: false,
        signalingState: "disconnected",
        turnFetchFailed: false,
      }),
      false,
    );
    assert.equal(
      shouldShowTurnUnavailableBanner({
        hasTurn: false,
        signalingState: "connecting",
        turnFetchFailed: false,
      }),
      false,
    );
  });

  it("shows the alarm after connect if TURN still missing, or after fetch failure", () => {
    assert.equal(
      shouldShowTurnUnavailableBanner({
        hasTurn: false,
        signalingState: "connected",
        turnFetchFailed: false,
      }),
      true,
    );
    assert.equal(
      shouldShowTurnUnavailableBanner({
        hasTurn: false,
        signalingState: "disconnected",
        turnFetchFailed: true,
      }),
      true,
    );
  });

  it("hides the alarm when TURN is present", () => {
    assert.equal(
      shouldShowTurnUnavailableBanner({
        hasTurn: true,
        signalingState: "connected",
        turnFetchFailed: false,
      }),
      false,
    );
  });
});
