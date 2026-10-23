import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { describe, it } from "node:test";
import { createCoturnHmacProvider } from "./coturn-hmac-provider.js";
import { createStaticTurnProvider } from "./static-provider.js";
import { resolveTurnProvider } from "./index.js";

describe("coturn HMAC provider", () => {
  it("issues username expiry:subject and matching HMAC credential", async () => {
    const secret = "test-secret";
    const provider = createCoturnHmacProvider({
      urls: ["turn:turn.example:3478"],
      sharedSecret: secret,
      ttlSeconds: 600,
    });
    assert.equal(provider.isConfigured(), true);
    const issued = await provider.issue("guest-abc");
    assert.equal(issued.mode, "coturn-hmac");
    const server = issued.iceServers[0]!;
    assert.ok(typeof server.username === "string");
    assert.match(server.username!, /^\d+:guest-abc$/);
    const expected = createHmac("sha1", secret).update(server.username!).digest("base64");
    assert.equal(server.credential, expected);
  });

  it("reports not configured without secret/urls", () => {
    const provider = createCoturnHmacProvider({
      urls: [],
      sharedSecret: "",
      ttlSeconds: 60,
    });
    assert.equal(provider.isConfigured(), false);
  });
});

describe("static provider", () => {
  it("returns static username/credential", async () => {
    const provider = createStaticTurnProvider({
      urls: ["turns:turn.example:5349"],
      username: "lab",
      credential: "lab-pass",
      ttlSeconds: 120,
    });
    const issued = await provider.issue("anyone");
    assert.equal(issued.mode, "static");
    assert.equal(issued.iceServers[0]?.username, "lab");
  });
});

describe("resolveTurnProvider", () => {
  it("returns null when missing credentials", () => {
    assert.equal(resolveTurnProvider({}), null);
  });

  it("prefers HMAC when secret is set", () => {
    const p = resolveTurnProvider({
      TURN_URLS: "turn:t.example:3478",
      TURN_HMAC_SECRET: "secret",
      TURN_USERNAME: "ignored",
      TURN_CREDENTIAL: "ignored",
    });
    assert.equal(p?.id, "coturn-hmac");
  });

  it("falls back to static", () => {
    const p = resolveTurnProvider({
      TURN_URLS: "turn:t.example:3478",
      TURN_USERNAME: "u",
      TURN_CREDENTIAL: "p",
    });
    assert.equal(p?.id, "static");
  });
});
