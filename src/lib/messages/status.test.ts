import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applySimulatedReceipt,
  canTransitionMessageStatus,
  statusLabel,
} from "./status";

describe("canTransitionMessageStatus", () => {
  it("allows pending → sent", () => {
    assert.equal(canTransitionMessageStatus("pending", "sent"), true);
  });

  it("allows sent → delivered only as the next step", () => {
    assert.equal(canTransitionMessageStatus("sent", "delivered"), true);
    assert.equal(canTransitionMessageStatus("sent", "read"), false);
  });

  it("allows delivered → read", () => {
    assert.equal(canTransitionMessageStatus("delivered", "read"), true);
  });

  it("allows failed → pending for retry", () => {
    assert.equal(canTransitionMessageStatus("failed", "pending"), true);
  });

  it("rejects skipping from pending to delivered", () => {
    assert.equal(canTransitionMessageStatus("pending", "delivered"), false);
  });
});

describe("applySimulatedReceipt", () => {
  it("marks sent as delivered when simulated", () => {
    assert.equal(applySimulatedReceipt("sent", "delivered"), "delivered");
  });

  it("marks delivered as read when simulated", () => {
    assert.equal(applySimulatedReceipt("delivered", "read"), "read");
  });

  it("does not mark pending as delivered", () => {
    assert.equal(applySimulatedReceipt("pending", "delivered"), null);
  });
});

describe("statusLabel", () => {
  it("labels failed clearly", () => {
    assert.equal(statusLabel("failed"), "Failed");
  });
});
