import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  MessageValidationError,
  normalizeMessageBody,
  parseSendMessageInput,
} from "./validation";

describe("normalizeMessageBody", () => {
  it("trims and accepts valid text", () => {
    assert.equal(normalizeMessageBody("  hello  "), "hello");
  });

  it("rejects empty bodies", () => {
    assert.throws(() => normalizeMessageBody("   "), (err: unknown) => {
      return err instanceof MessageValidationError && err.code === "EMPTY_BODY";
    });
  });

  it("rejects oversized bodies", () => {
    assert.throws(() => normalizeMessageBody("x".repeat(4001)), (err: unknown) => {
      return err instanceof MessageValidationError && err.code === "BODY_TOO_LONG";
    });
  });
});

describe("parseSendMessageInput", () => {
  it("parses a valid payload", () => {
    const parsed = parseSendMessageInput({
      conversationId: "11111111-1111-4111-8111-111111111111",
      body: "hi",
      clientId: "22222222-2222-4222-8222-222222222222",
    });
    assert.equal(parsed.body, "hi");
  });

  it("rejects invalid conversation ids", () => {
    assert.throws(
      () =>
        parseSendMessageInput({
          conversationId: "not-a-uuid",
          body: "hi",
          clientId: "22222222-2222-4222-8222-222222222222",
        }),
      (err: unknown) =>
        err instanceof MessageValidationError && err.code === "INVALID_CONVERSATION_ID",
    );
  });
});

describe("duplicate client event handling", () => {
  it("keeps the same clientId stable for idempotent retries", () => {
    const first = parseSendMessageInput({
      conversationId: "11111111-1111-4111-8111-111111111111",
      body: "retry me",
      clientId: "33333333-3333-4333-8333-333333333333",
    });
    const second = parseSendMessageInput({
      conversationId: "11111111-1111-4111-8111-111111111111",
      body: "retry me",
      clientId: "33333333-3333-4333-8333-333333333333",
    });
    assert.equal(first.clientId, second.clientId);
  });
});
