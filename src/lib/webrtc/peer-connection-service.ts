"use client";

import { buildRtcConfiguration } from "./ice-config";
import {
  buildDiagnosticsSnapshot,
  inspectSelectedCandidatePair,
} from "./ice-diagnostics";
import { FILE_CHANNEL_LABEL } from "./file-protocol";
import { FileTransferEngine } from "./file-transfer-engine";
import type { SignalingClient } from "./signaling-client";
import type {
  DataChannelLifecycle,
  PeerConnectionService,
  PeerConnectionSnapshot,
  PeerSessionDescriptor,
  ReconnectOptions,
} from "./types";
import {
  ActivePeerConnectionError,
  SignalingRequiredError,
  WebRtcNotReadyError,
} from "./types";

interface LivePeer {
  session: PeerSessionDescriptor;
  pc: RTCPeerConnection;
  /** Offeror-created `relaychat-file` channel (answerer receives via ondatachannel). */
  channel: RTCDataChannel | null;
  fileEngine: FileTransferEngine | null;
  snapshot: PeerConnectionSnapshot;
  timeoutId: ReturnType<typeof setTimeout> | null;
  makingOffer: boolean;
  iceTransportPolicy: "all" | "relay" | "default";
  statsPollId: ReturnType<typeof setInterval> | null;
}

function mapConnectionState(state: RTCPeerConnectionState): PeerConnectionSnapshot["connection"] {
  switch (state) {
    case "new":
    case "connecting":
      return "negotiating";
    case "connected":
      return "connected";
    case "disconnected":
      return "disconnected";
    case "failed":
      return "failed";
    case "closed":
      return "closed";
    default:
      return "negotiating";
  }
}

function mapChannelState(state: RTCDataChannelState): DataChannelLifecycle {
  switch (state) {
    case "connecting":
      return "connecting";
    case "open":
      return "open";
    case "closing":
      return "closing";
    case "closed":
      return "closed";
  }
}

/**
 * Real browser RTCPeerConnection service.
 * Never sets isLive=true unless connectionState === "connected".
 *
 * File channel ownership: the WebRTC offeror creates `relaychat-file` once.
 * The answerer never creates a channel — only accepts via ondatachannel.
 * File bytes travel only on this DataChannel (never Socket.IO).
 */
export function createPeerConnectionService(signaling: SignalingClient): PeerConnectionService {
  if (typeof RTCPeerConnection === "undefined") {
    throw new WebRtcNotReadyError("RTCPeerConnection is not available in this runtime.");
  }

  const peers = new Map<string, LivePeer>();
  const listeners = new Set<(snapshot: PeerConnectionSnapshot) => void>();

  const publish = (peer: LivePeer) => {
    listeners.forEach((l) => l(peer.snapshot));
  };

  const clearTimeoutSafe = (peer: LivePeer) => {
    if (peer.timeoutId) {
      clearTimeout(peer.timeoutId);
      peer.timeoutId = null;
    }
  };

  const clearStatsPoll = (peer: LivePeer) => {
    if (peer.statsPollId) {
      clearInterval(peer.statsPollId);
      peer.statsPollId = null;
    }
  };

  const applyDiagnostics = async (peer: LivePeer) => {
    const stats = await inspectSelectedCandidatePair(peer.pc);
    peer.snapshot = {
      ...peer.snapshot,
      diagnostics: buildDiagnosticsSnapshot({
        pc: peer.pc,
        dataChannel: peer.channel,
        iceTransportPolicy: peer.iceTransportPolicy,
        stats,
      }),
    };
  };

  const refreshFromPc = (peer: LivePeer) => {
    const connection = mapConnectionState(peer.pc.connectionState);
    const isLive = peer.pc.connectionState === "connected";
    const diagnostics = buildDiagnosticsSnapshot({
      pc: peer.pc,
      dataChannel: peer.channel,
      iceTransportPolicy: peer.iceTransportPolicy,
      stats: peer.snapshot.diagnostics
        ? {
            usingRelay: peer.snapshot.diagnostics.usingRelay,
            relayEvidence: peer.snapshot.diagnostics.relayEvidence,
            localCandidateType: peer.snapshot.diagnostics.localCandidateType,
            remoteCandidateType: peer.snapshot.diagnostics.remoteCandidateType,
          }
        : undefined,
    });
    peer.snapshot = {
      ...peer.snapshot,
      connection,
      isLive,
      dataChannel: peer.channel ? mapChannelState(peer.channel.readyState) : null,
      diagnostics,
      lastError: isLive && !peer.snapshot.lastError ? undefined : peer.snapshot.lastError,
    };
    if (isLive) clearTimeoutSafe(peer);
    publish(peer);
    if (isLive) {
      void applyDiagnostics(peer).then(() => publish(peer));
    }
  };

  const tearDownPeerResources = (peer: LivePeer) => {
    clearTimeoutSafe(peer);
    clearStatsPoll(peer);
    peer.fileEngine?.dispose();
    peer.fileEngine = null;
    try {
      peer.channel?.close();
    } catch {
      /* ignore */
    }
    try {
      peer.pc.close();
    } catch {
      /* ignore */
    }
  };

  const wireFileChannel = (peer: LivePeer, channel: RTCDataChannel) => {
    if (peer.channel && peer.channel !== channel) {
      // Do not create duplicate channels — close unexpected extras.
      channel.close();
      peer.snapshot = {
        ...peer.snapshot,
        lastError: "Rejected duplicate DataChannel.",
      };
      publish(peer);
      return;
    }
    peer.channel = channel;
    channel.binaryType = "arraybuffer";

    const ensureEngine = () => {
      if (peer.fileEngine) return peer.fileEngine;
      const engine = new FileTransferEngine({
        send: (data) => {
          if (channel.readyState !== "open") {
            throw new Error("File DataChannel is not open.");
          }
          if (typeof data === "string") {
            channel.send(data);
          } else {
            const view = new Uint8Array(data.byteLength);
            view.set(new Uint8Array(data));
            channel.send(view);
          }
        },
        getBufferedAmount: () => channel.bufferedAmount,
        setBufferedAmountLowThreshold: (n) => {
          channel.bufferedAmountLowThreshold = n;
        },
        onBufferedAmountLow: (cb) => {
          const handler = () => cb();
          channel.addEventListener("bufferedamountlow", handler);
          return () => channel.removeEventListener("bufferedamountlow", handler);
        },
      });
      peer.fileEngine = engine;
      return engine;
    };

    channel.onopen = () => {
      ensureEngine();
      refreshFromPc(peer);
    };
    channel.onclose = () => {
      peer.fileEngine?.dispose();
      peer.fileEngine = null;
      refreshFromPc(peer);
    };
    channel.onerror = () => {
      peer.snapshot = {
        ...peer.snapshot,
        lastError: "File DataChannel error.",
      };
      refreshFromPc(peer);
    };
    channel.onmessage = (event) => {
      const engine = ensureEngine();
      try {
        if (typeof event.data === "string") {
          engine.handleMessage(event.data);
        } else if (event.data instanceof ArrayBuffer) {
          engine.handleMessage(event.data);
        } else if (ArrayBuffer.isView(event.data)) {
          const view = event.data;
          const ab = view.buffer.slice(
            view.byteOffset,
            view.byteOffset + view.byteLength,
          ) as ArrayBuffer;
          engine.handleMessage(ab);
        }
      } catch (err) {
        peer.snapshot = {
          ...peer.snapshot,
          lastError: err instanceof Error ? err.message : "Invalid file-channel message.",
        };
        refreshFromPc(peer);
      }
    };

    if (channel.readyState === "open") {
      ensureEngine();
    }
  };

  const attachPcListeners = (peer: LivePeer) => {
    peer.pc.onicecandidate = (event) => {
      if (!event.candidate) return;
      // Do not log candidate strings (may include addresses).
      signaling.sendIceCandidate(
        peer.session.roomId,
        peer.session.remoteUserId,
        JSON.stringify(event.candidate.toJSON()),
      );
    };

    peer.pc.onconnectionstatechange = () => {
      refreshFromPc(peer);
      if (peer.pc.connectionState === "failed" || peer.pc.connectionState === "closed") {
        clearTimeoutSafe(peer);
        clearStatsPoll(peer);
        peer.fileEngine?.dispose();
        peer.fileEngine = null;
        if (peer.pc.connectionState === "failed") {
          peer.snapshot = {
            ...peer.snapshot,
            lastError:
              peer.snapshot.lastError ??
              "RTCPeerConnection failed. Check ICE/TURN, firewall, and that both peers are online.",
          };
          publish(peer);
        }
      }
    };

    peer.pc.oniceconnectionstatechange = () => {
      refreshFromPc(peer);
      if (peer.pc.iceConnectionState === "failed") {
        peer.snapshot = {
          ...peer.snapshot,
          lastError:
            "ICE connection failed. Direct path may be blocked; configure TURN or check relay-only mode.",
        };
        publish(peer);
      }
    };

    peer.pc.onicegatheringstatechange = () => {
      refreshFromPc(peer);
    };

    peer.pc.ondatachannel = (event) => {
      if (event.channel.label !== FILE_CHANNEL_LABEL) {
        event.channel.close();
        peer.snapshot = {
          ...peer.snapshot,
          lastError: `Rejected unexpected DataChannel label: ${event.channel.label}`,
        };
        publish(peer);
        return;
      }
      wireFileChannel(peer, event.channel);
      refreshFromPc(peer);
    };
  };

  /**
   * Create a new peer. Refuses to silently replace an *active* (isLive) connection.
   * Failed/closed/negotiating replacements require replaceExisting=true (reconnect path).
   */
  const createPeer = (
    session: PeerSessionDescriptor,
    asOfferer: boolean,
    options?: { replaceExisting?: boolean; reconnectAttempt?: number },
  ): LivePeer => {
    const existing = peers.get(session.conversationId);
    if (existing) {
      if (existing.snapshot.isLive && !options?.replaceExisting) {
        throw new ActivePeerConnectionError();
      }
      if (existing.snapshot.isLive && options?.replaceExisting) {
        throw new ActivePeerConnectionError(
          "Cannot replace a live peer connection. Call disconnect() first.",
        );
      }
      tearDownPeerResources(existing);
      peers.delete(session.conversationId);
    }

    const policy = session.iceTransportPolicy === "relay" ? "relay" : "all";
    const rtcConfig = buildRtcConfiguration(session.iceServers, policy);
    const pc = new RTCPeerConnection(rtcConfig);

    const peer: LivePeer = {
      session,
      pc,
      channel: null,
      fileEngine: null,
      makingOffer: false,
      timeoutId: null,
      statsPollId: null,
      iceTransportPolicy: rtcConfig.iceTransportPolicy === "relay" ? "relay" : "default",
      snapshot: {
        conversationId: session.conversationId,
        remoteUserId: session.remoteUserId,
        connection: "negotiating",
        dataChannel: null,
        isLive: false,
        reconnectAttempt: options?.reconnectAttempt,
        diagnostics: buildDiagnosticsSnapshot({
          pc,
          dataChannel: null,
          iceTransportPolicy: rtcConfig.iceTransportPolicy === "relay" ? "relay" : "default",
        }),
      },
    };

    if (asOfferer) {
      const channel = pc.createDataChannel(FILE_CHANNEL_LABEL, { ordered: true });
      wireFileChannel(peer, channel);
      peer.snapshot.dataChannel = "connecting";
    }

    attachPcListeners(peer);

    const timeoutMs = session.connectTimeoutMs ?? 30_000;
    peer.timeoutId = setTimeout(() => {
      if (peer.pc.connectionState !== "connected") {
        peer.snapshot = {
          ...peer.snapshot,
          connection: "failed",
          isLive: false,
          lastError: "Connection timed out before WebRTC became connected.",
          diagnostics: buildDiagnosticsSnapshot({
            pc: peer.pc,
            dataChannel: peer.channel,
            iceTransportPolicy: peer.iceTransportPolicy,
          }),
        };
        publish(peer);
        tearDownPeerResources(peer);
      }
    }, timeoutMs);

    // Periodic stats refresh while connected (bounded interval).
    peer.statsPollId = setInterval(() => {
      if (peer.pc.connectionState === "connected") {
        void applyDiagnostics(peer).then(() => publish(peer));
      }
    }, 4_000);

    peers.set(session.conversationId, peer);
    publish(peer);
    return peer;
  };

  return {
    getSnapshot(conversationId) {
      return peers.get(conversationId)?.snapshot ?? null;
    },

    getFileTransferEngine(conversationId) {
      return peers.get(conversationId)?.fileEngine ?? null;
    },

    async refreshDiagnostics(conversationId) {
      const peer = peers.get(conversationId);
      if (!peer) return null;
      await applyDiagnostics(peer);
      publish(peer);
      return peer.snapshot;
    },

    async connect(session) {
      if (!signaling.getWelcome()) {
        throw new SignalingRequiredError();
      }
      const peer = createPeer(session, true);
      peer.makingOffer = true;
      const offer = await peer.pc.createOffer();
      await peer.pc.setLocalDescription(offer);
      signaling.sendOffer(session.roomId, session.remoteUserId, offer.sdp ?? "");
      peer.makingOffer = false;
      refreshFromPc(peer);
      return peer.snapshot;
    },

    async reconnect(session, options?: ReconnectOptions) {
      if (!signaling.getWelcome()) {
        throw new SignalingRequiredError();
      }
      const maxAttempts = Math.min(Math.max(options?.maxAttempts ?? 3, 1), 5);
      const existing = peers.get(session.conversationId);
      if (existing?.snapshot.isLive) {
        throw new ActivePeerConnectionError();
      }
      if (existing) {
        tearDownPeerResources(existing);
        peers.delete(session.conversationId);
      }

      let lastError: unknown;
      for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        try {
          const peer = createPeer(
            {
              ...session,
              connectTimeoutMs: options?.connectTimeoutMs ?? session.connectTimeoutMs,
            },
            true,
            { replaceExisting: true, reconnectAttempt: attempt },
          );
          peer.makingOffer = true;
          const offer = await peer.pc.createOffer();
          await peer.pc.setLocalDescription(offer);
          signaling.sendOffer(session.roomId, session.remoteUserId, offer.sdp ?? "");
          peer.makingOffer = false;
          refreshFromPc(peer);
          return peer.snapshot;
        } catch (err) {
          lastError = err;
          const peer = peers.get(session.conversationId);
          if (peer) {
            tearDownPeerResources(peer);
            peers.delete(session.conversationId);
          }
        }
      }
      throw lastError instanceof Error
        ? lastError
        : new Error(`Reconnect failed after ${maxAttempts} attempts.`);
    },

    async acceptRemoteOffer(session, remoteSdp) {
      if (!signaling.getWelcome()) {
        throw new SignalingRequiredError();
      }
      const existing = peers.get(session.conversationId);
      if (existing?.snapshot.isLive) {
        throw new ActivePeerConnectionError(
          "Cannot accept a new offer while a live peer connection exists. Disconnect first.",
        );
      }
      const peer = createPeer(session, false, { replaceExisting: true });
      await peer.pc.setRemoteDescription({ type: "offer", sdp: remoteSdp });
      const answer = await peer.pc.createAnswer();
      await peer.pc.setLocalDescription(answer);
      signaling.sendAnswer(session.roomId, session.remoteUserId, answer.sdp ?? "");
      refreshFromPc(peer);
      return peer.snapshot;
    },

    async handleRemoteAnswer(conversationId, remoteSdp) {
      const peer = peers.get(conversationId);
      if (!peer) return;
      await peer.pc.setRemoteDescription({ type: "answer", sdp: remoteSdp });
      refreshFromPc(peer);
    },

    async handleRemoteIceCandidate(conversationId, candidateJson) {
      const peer = peers.get(conversationId);
      if (!peer) return;
      try {
        const init = JSON.parse(candidateJson) as RTCIceCandidateInit;
        await peer.pc.addIceCandidate(init);
      } catch {
        peer.snapshot = {
          ...peer.snapshot,
          lastError: "Failed to apply a remote ICE candidate.",
        };
        publish(peer);
      }
    },

    async disconnect(conversationId) {
      const peer = peers.get(conversationId);
      if (!peer) return;
      tearDownPeerResources(peer);
      peer.snapshot = {
        ...peer.snapshot,
        connection: "closed",
        dataChannel: "closed",
        isLive: false,
        diagnostics: buildDiagnosticsSnapshot({
          pc: null,
          dataChannel: null,
          iceTransportPolicy: peer.iceTransportPolicy,
        }),
      };
      publish(peer);
      peers.delete(conversationId);
    },

    onChange(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

/** Legacy no-op export name kept for imports that expect a singleton stub. */
export const peerConnectionService: PeerConnectionService = {
  getSnapshot() {
    return null;
  },
  getFileTransferEngine() {
    return null;
  },
  async refreshDiagnostics() {
    return null;
  },
  async connect() {
    throw new SignalingRequiredError(
      "Create a peer service with createPeerConnectionService(signaling) after connecting to signaling.",
    );
  },
  async reconnect() {
    throw new SignalingRequiredError();
  },
  async acceptRemoteOffer() {
    throw new SignalingRequiredError();
  },
  async handleRemoteAnswer() {},
  async handleRemoteIceCandidate() {},
  async disconnect() {},
  onChange() {
    return () => undefined;
  },
};
