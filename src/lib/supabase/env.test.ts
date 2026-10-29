import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isSupabaseEnvPlaceholder } from "./env";

describe("isSupabaseEnvPlaceholder", () => {
  it("rejects empty and template placeholders", () => {
    assert.equal(isSupabaseEnvPlaceholder(""), true);
    assert.equal(isSupabaseEnvPlaceholder("https://YOUR_PROJECT_REF.supabase.co"), true);
    assert.equal(isSupabaseEnvPlaceholder("sb_publishable_..."), true);
  });

  it("accepts real-looking values", () => {
    assert.equal(isSupabaseEnvPlaceholder("https://abcdefghijklmnop.supabase.co"), false);
    assert.equal(isSupabaseEnvPlaceholder("sb_publishable_realkeyvalue123"), false);
    assert.equal(isSupabaseEnvPlaceholder("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.abc"), false);
  });
});
