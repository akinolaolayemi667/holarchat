import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assertAvatarFile,
  normalizeDisplayName,
  normalizePhoneNumber,
  parseProfileUpdateInput,
  ProfileValidationError,
} from "./validation";

describe("profile validation", () => {
  it("normalizes display names", () => {
    assert.equal(normalizeDisplayName("  Ada  Lovelace "), "Ada Lovelace");
    assert.throws(() => normalizeDisplayName(""), ProfileValidationError);
  });

  it("accepts optional phone numbers", () => {
    assert.equal(normalizePhoneNumber(""), null);
    assert.equal(normalizePhoneNumber("+1 (555) 010-2233"), "+1 (555) 010-2233");
    assert.throws(() => normalizePhoneNumber("abc"), ProfileValidationError);
  });

  it("parses a full update payload", () => {
    const parsed = parseProfileUpdateInput({
      displayName: "Maya",
      phoneNumber: "+15550199",
      bio: "Hello",
      statusMessage: "Around",
    });
    assert.equal(parsed.displayName, "Maya");
    assert.equal(parsed.phoneNumber, "+15550199");
    assert.equal(parsed.bio, "Hello");
    assert.equal(parsed.statusMessage, "Around");
  });

  it("rejects oversized avatars and bad mime types", () => {
    assert.throws(
      () => assertAvatarFile({ type: "application/pdf", size: 100 }),
      ProfileValidationError,
    );
    assert.throws(
      () => assertAvatarFile({ type: "image/png", size: 3 * 1024 * 1024 }),
      ProfileValidationError,
    );
    assert.doesNotThrow(() => assertAvatarFile({ type: "image/png", size: 1024 }));
  });
});
