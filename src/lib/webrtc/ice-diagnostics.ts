/**
 * WebRTC connection diagnostics from RTCPeerConnection + getStats.
 * Never label a path as TURN-relayed without selected-candidate evidence.
 */

export type RelayPathEvidence =
  | "unknown"
  | "not-connected"
  | "stats-unsupported"
  | "no-selected-pair"
  | "host"
  | "srflx"
  | "prflx"
  | "relay"
  | "other";

export interface PeerConnectionDiagnostics {
  connectionState: RTCPeerConnectionState | "unavailable";
  iceConnectionState: RTCIceConnectionState | "unavailable";
  iceGatheringState: RTCIceGatheringState | "unavailable";
  dataChannelState: RTCDataChannelState | "none";
  iceTransportPolicy: "all" | "relay" | "default";
  /** True only when selected local or remote candidate type is relay. */
  usingRelay: boolean;
  relayEvidence: RelayPathEvidence;
  localCandidateType?: string;
  remoteCandidateType?: string;
  /** Safe, non-secret summary for UI/logs (no passwords, no full SDP). */
  summary: string;
}

interface CandidateLike {
  candidateType?: string;
  type?: string;
}

function candidateTypeOf(c: CandidateLike | undefined): string | undefined {
  if (!c) return undefined;
  return c.candidateType ?? c.type;
}

function evidenceFromTypes(
  localType: string | undefined,
  remoteType: string | undefined,
): { usingRelay: boolean; evidence: RelayPathEvidence } {
  const types = [localType, remoteType].filter(Boolean).map((t) => t!.toLowerCase());
  if (types.includes("relay")) {
    return { usingRelay: true, evidence: "relay" };
  }
  if (types.includes("srflx")) {
    return { usingRelay: false, evidence: "srflx" };
  }
  if (types.includes("prflx")) {
    return { usingRelay: false, evidence: "prflx" };
  }
  if (types.includes("host")) {
    return { usingRelay: false, evidence: "host" };
  }
  if (types.length > 0) {
    return { usingRelay: false, evidence: "other" };
  }
  return { usingRelay: false, evidence: "no-selected-pair" };
}

/**
 * Inspect getStats() report for the selected candidate pair.
 * Works with modern Chromium/Firefox report shapes; returns unknown if unsupported.
 */
export async function inspectSelectedCandidatePair(
  pc: RTCPeerConnection,
): Promise<{
  usingRelay: boolean;
  relayEvidence: RelayPathEvidence;
  localCandidateType?: string;
  remoteCandidateType?: string;
}> {
  if (typeof pc.getStats !== "function") {
    return { usingRelay: false, relayEvidence: "stats-unsupported" };
  }
  if (pc.connectionState !== "connected" && pc.iceConnectionState !== "connected") {
    return { usingRelay: false, relayEvidence: "not-connected" };
  }

  try {
    const report = await pc.getStats();
    const byId = new Map<string, RTCStats>();
    report.forEach((stat) => byId.set(stat.id, stat));

    type PairStats = RTCIceCandidatePairStats & { selected?: boolean };
    let selectedPair: PairStats | undefined;
    report.forEach((stat) => {
      if (stat.type !== "candidate-pair") return;
      const pair = stat as PairStats;
      // Chrome: selected; Firefox / spec: state === "succeeded" + nominated
      if (pair.selected === true) {
        selectedPair = pair;
      }
    });
    if (!selectedPair) {
      report.forEach((stat) => {
        if (stat.type !== "candidate-pair") return;
        const pair = stat as PairStats;
        if (pair.state === "succeeded" && pair.nominated) {
          selectedPair = pair;
        }
      });
    }
    if (!selectedPair) {
      return { usingRelay: false, relayEvidence: "no-selected-pair" };
    }

    const local = selectedPair.localCandidateId
      ? (byId.get(selectedPair.localCandidateId) as CandidateLike | undefined)
      : undefined;
    const remote = selectedPair.remoteCandidateId
      ? (byId.get(selectedPair.remoteCandidateId) as CandidateLike | undefined)
      : undefined;
    const localType = candidateTypeOf(local);
    const remoteType = candidateTypeOf(remote);
    const { usingRelay, evidence } = evidenceFromTypes(localType, remoteType);
    return {
      usingRelay,
      relayEvidence: evidence,
      localCandidateType: localType,
      remoteCandidateType: remoteType,
    };
  } catch {
    return { usingRelay: false, relayEvidence: "stats-unsupported" };
  }
}

export function buildDiagnosticsSnapshot(input: {
  pc: RTCPeerConnection | null;
  dataChannel: RTCDataChannel | null;
  iceTransportPolicy: "all" | "relay" | "default";
  stats?: Awaited<ReturnType<typeof inspectSelectedCandidatePair>>;
}): PeerConnectionDiagnostics {
  if (!input.pc) {
    return {
      connectionState: "unavailable",
      iceConnectionState: "unavailable",
      iceGatheringState: "unavailable",
      dataChannelState: "none",
      iceTransportPolicy: input.iceTransportPolicy,
      usingRelay: false,
      relayEvidence: "unknown",
      summary: "No peer connection.",
    };
  }

  const stats = input.stats ?? {
    usingRelay: false,
    relayEvidence: "unknown" as RelayPathEvidence,
  };

  const summaryParts = [
    `pc=${input.pc.connectionState}`,
    `ice=${input.pc.iceConnectionState}`,
    `gather=${input.pc.iceGatheringState}`,
    `dc=${input.dataChannel?.readyState ?? "none"}`,
    `policy=${input.iceTransportPolicy}`,
    `path=${stats.relayEvidence}`,
  ];
  if (stats.localCandidateType || stats.remoteCandidateType) {
    summaryParts.push(
      `candidates=${stats.localCandidateType ?? "?"}->${stats.remoteCandidateType ?? "?"}`,
    );
  }

  return {
    connectionState: input.pc.connectionState,
    iceConnectionState: input.pc.iceConnectionState,
    iceGatheringState: input.pc.iceGatheringState,
    dataChannelState: input.dataChannel?.readyState ?? "none",
    iceTransportPolicy: input.iceTransportPolicy,
    usingRelay: stats.usingRelay,
    relayEvidence: stats.relayEvidence,
    localCandidateType: stats.localCandidateType,
    remoteCandidateType: stats.remoteCandidateType,
    summary: summaryParts.join(" · "),
  };
}

/** Pure helper for unit tests — classify types without a live PeerConnection. */
export function classifyRelayFromCandidateTypes(
  localType: string | undefined,
  remoteType: string | undefined,
): { usingRelay: boolean; evidence: RelayPathEvidence } {
  return evidenceFromTypes(localType, remoteType);
}
