import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  IceConfigError,
  buildRtcConfiguration,
  iceServersIncludeTurn,
  resolveClientIceConfig,
  validateIceServers,
  validateIceTransportPolicy,
} from "./ice-config";

describe("validateIceServers", () => {
  it("accepts STUN-only", () => {
    const servers = validateIceServers([{ urls: "stun:stun.example:3478" }]);
    assert.equal(iceServersIncludeTurn(servers), false);
  });

  it("requires username/credential for TURN", () => {
    assert.throws(
      () => validateIceServers([{ urls: "turn:turn.example:3478" }]),
      IceConfigError,
    );
  });

  it("accepts TURN with credentials", () => {
    const servers = validateIceServers([
      {
        urls: ["turn:turn.example:3478", "turns:turn.example:5349"],
        username: "u",
        credential: "p",
      },
    ]);
    assert.equal(iceServersIncludeTurn(servers), true);
  });

  it("rejects malformed URLs and empty arrays", () => {
    assert.throws(() => validateIceServers([]), IceConfigError);
    assert.throws(() => validateIceServers([{ urls: "http://bad" }]), IceConfigError);
    assert.throws(() => validateIceServers("nope"), IceConfigError);
  });
});

describe("iceTransportPolicy", () => {
  it("defaults to all", () => {
    assert.equal(validateIceTransportPolicy(undefined), "all");
  });

  it("rejects unknown policies", () => {
    assert.throws(() => validateIceTransportPolicy("force"), IceConfigError);
  });

  it("relay-only requires TURN", () => {
    assert.throws(
      () =>
        buildRtcConfiguration([{ urls: "stun:stun.example:3478" }], "relay"),
      /requires at least one TURN/,
    );
  });

  it("normal mode omits iceTransportPolicy (browser default)", () => {
    const cfg = buildRtcConfiguration([{ urls: "stun:stun.example:3478" }], "all");
    assert.equal(cfg.iceTransportPolicy, undefined);
  });

  it("relay mode sets iceTransportPolicy relay", () => {
    const cfg = buildRtcConfiguration(
      [{ urls: "turn:t.example:3478", username: "a", credential: "b" }],
      "relay",
    );
    assert.equal(cfg.iceTransportPolicy, "relay");
  });
});

describe("resolveClientIceConfig", () => {
  it("uses STUN default when nothing configured", () => {
    const cfg = resolveClientIceConfig();
    assert.equal(cfg.source, "stun-default");
    assert.equal(cfg.hasTurn, false);
    assert.equal(cfg.iceTransportPolicy, "all");
  });

  it("prefers server-issued credentials", () => {
    const cfg = resolveClientIceConfig({
      serverIceServers: [
        { urls: "stun:stun.example:3478" },
        { urls: "turn:t.example:3478", username: "u", credential: "c" },
      ],
    });
    assert.equal(cfg.source, "server-credentials");
    assert.equal(cfg.hasTurn, true);
  });

  it("fails relay-only without TURN", () => {
    assert.throws(
      () => resolveClientIceConfig({ iceTransportPolicy: "relay" }),
      /Relay-only mode needs TURN/,
    );
  });
});
