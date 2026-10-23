import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildDiagnosticsSnapshot,
  classifyRelayFromCandidateTypes,
} from "./ice-diagnostics";

describe("classifyRelayFromCandidateTypes", () => {
  it("marks relay when either side is relay", () => {
    assert.deepEqual(classifyRelayFromCandidateTypes("relay", "srflx"), {
      usingRelay: true,
      evidence: "relay",
    });
    assert.deepEqual(classifyRelayFromCandidateTypes("host", "relay"), {
      usingRelay: true,
      evidence: "relay",
    });
  });

  it("does not claim relay for host/srflx only", () => {
    assert.equal(classifyRelayFromCandidateTypes("host", "host").usingRelay, false);
    assert.equal(classifyRelayFromCandidateTypes("srflx", "srflx").evidence, "srflx");
  });

  it("returns no-selected-pair when types missing", () => {
    assert.equal(classifyRelayFromCandidateTypes(undefined, undefined).evidence, "no-selected-pair");
  });
});

describe("buildDiagnosticsSnapshot", () => {
  it("reports unavailable without a peer connection", () => {
    const d = buildDiagnosticsSnapshot({
      pc: null,
      dataChannel: null,
      iceTransportPolicy: "default",
    });
    assert.equal(d.connectionState, "unavailable");
    assert.equal(d.usingRelay, false);
  });
});
