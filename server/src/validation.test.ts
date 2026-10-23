import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createIceSchema,
  createOfferSchema,
  guestAuthSchema,
  roomJoinSchema,
} from "./validation.js";

describe("validation", () => {
  it("accepts valid guest auth", () => {
    const parsed = guestAuthSchema.safeParse({ mode: "guest", displayName: "Alice" });
    assert.equal(parsed.success, true);
  });

  it("rejects invalid guest auth", () => {
    assert.equal(guestAuthSchema.safeParse({ mode: "guest", displayName: "" }).success, false);
    assert.equal(guestAuthSchema.safeParse({ mode: "user", displayName: "Alice" }).success, false);
  });

  it("accepts valid room ids", () => {
    assert.equal(roomJoinSchema.safeParse({ roomId: "lab-room-1" }).success, true);
  });

  it("rejects bad room ids", () => {
    assert.equal(roomJoinSchema.safeParse({ roomId: "ab" }).success, false);
    assert.equal(roomJoinSchema.safeParse({ roomId: "bad room" }).success, false);
  });

  it("rejects oversized offer SDP", () => {
    const schema = createOfferSchema(32);
    const result = schema.safeParse({
      roomId: "lab-room-1",
      toGuestId: "guest_12345678-1234-1234-1234-123456789abc",
      sdp: "x".repeat(40),
    });
    assert.equal(result.success, false);
  });

  it("rejects invalid ice candidate target", () => {
    const schema = createIceSchema(1000);
    const result = schema.safeParse({
      roomId: "lab-room-1",
      toGuestId: "not-a-guest",
      candidate: "candidate:1",
    });
    assert.equal(result.success, false);
  });
});
