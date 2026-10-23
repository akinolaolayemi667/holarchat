import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveStartDirectConversation } from "./start-conversation";
import type { ConversationSummary } from "@/types/chat";

const existing: ConversationSummary[] = [
  {
    id: "conv-1",
    kind: "direct",
    title: null,
    peer: {
      id: "user-maya",
      displayName: "Maya Chen",
      email: "maya@example.com",
      presence: { status: "online", simulated: true },
    },
    lastMessagePreview: "hi",
    lastMessageAt: "2026-10-22T12:00:00.000Z",
    updatedAt: "2026-10-22T12:00:00.000Z",
    unreadCount: 0,
  },
];

describe("resolveStartDirectConversation", () => {
  it("creates a new conversation when none exists", () => {
    const result = resolveStartDirectConversation({
      peerId: "user-priya",
      existing,
      createId: () => "conv-new",
      nowIso: () => "2026-10-23T10:00:00.000Z",
      peerDisplayName: "Priya Nair",
    });
    assert.equal(result.status, "created");
    if (result.status === "created") {
      assert.equal(result.conversationId, "conv-new");
    }
  });

  it("returns existing for duplicate direct peers", () => {
    const result = resolveStartDirectConversation({
      peerId: "user-maya",
      existing,
      createId: () => "should-not-use",
      nowIso: () => "2026-10-23T10:00:00.000Z",
      peerDisplayName: "Maya Chen",
    });
    assert.equal(result.status, "existing");
    if (result.status === "existing") {
      assert.equal(result.conversationId, "conv-1");
    }
  });

  it("errors on empty peer id", () => {
    const result = resolveStartDirectConversation({
      peerId: "  ",
      existing,
      createId: () => "x",
      nowIso: () => "2026-10-23T10:00:00.000Z",
      peerDisplayName: "Nobody",
    });
    assert.equal(result.status, "error");
  });
});

describe("empty conversation list", () => {
  it("allows creating the first conversation", () => {
    const result = resolveStartDirectConversation({
      peerId: "user-leo",
      existing: [],
      createId: () => "conv-first",
      nowIso: () => "2026-10-23T10:00:00.000Z",
      peerDisplayName: "Leo Martins",
    });
    assert.equal(result.status, "created");
  });
});
