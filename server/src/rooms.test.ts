import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { RoomRegistry } from "./rooms.js";

describe("RoomRegistry", () => {
  it("tracks membership and duplicate joins", () => {
    const rooms = new RoomRegistry();
    const first = rooms.join("room-a", "guest_a");
    assert.equal(first.alreadyMember, false);
    const second = rooms.join("room-a", "guest_a");
    assert.equal(second.alreadyMember, true);
    assert.equal(rooms.isMember("room-a", "guest_a"), true);
  });

  it("allows signaling only when both peers share a room", () => {
    const rooms = new RoomRegistry();
    rooms.join("room-a", "guest_a");
    rooms.join("room-a", "guest_b");
    rooms.join("room-b", "guest_c");

    assert.equal(rooms.canSignal("room-a", "guest_a", "guest_b"), true);
    assert.equal(rooms.canSignal("room-a", "guest_a", "guest_c"), false);
    assert.equal(rooms.canSignal("room-b", "guest_a", "guest_c"), false);
    assert.equal(rooms.canSignal("room-a", "guest_a", "guest_a"), false);
  });

  it("cleans up on leaveAll", () => {
    const rooms = new RoomRegistry();
    rooms.bindSocket("guest_a", "sock_1");
    rooms.join("room-a", "guest_a");
    rooms.join("room-b", "guest_a");
    const left = rooms.leaveAll("guest_a");
    assert.equal(left.length, 2);
    assert.equal(rooms.isMember("room-a", "guest_a"), false);
    assert.equal(rooms.unbindSocket("sock_1"), "guest_a");
  });
});
