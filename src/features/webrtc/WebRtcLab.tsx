"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  IceConfigError,
  resolveClientIceConfig,
  type ValidatedRtcIceConfig,
} from "@/lib/webrtc/ice-config";
import { SignalingClient } from "@/lib/webrtc/signaling-client";
import { createPeerConnectionService } from "@/lib/webrtc/peer-connection-service";
import { fetchTurnCredentials } from "@/lib/webrtc/turn-credentials-client";
import type {
  FileTransferEngineHandle,
  IceServerConfig,
  PeerConnectionService,
  PeerConnectionSnapshot,
} from "@/lib/webrtc/types";
import { FileTransferLabPanel } from "./FileTransferLabPanel";

const DEFAULT_SIGNALING =
  process.env.NEXT_PUBLIC_SIGNALING_URL ?? "http://localhost:4001";

const PUBLIC_STUN = process.env.NEXT_PUBLIC_STUN_URLS;

export function WebRtcLab() {
  const [signalingUrl, setSignalingUrl] = useState(DEFAULT_SIGNALING);
  const [displayName, setDisplayName] = useState("Guest A");
  const [roomId, setRoomId] = useState("lab-room-1");
  const [remoteGuestId, setRemoteGuestId] = useState("");
  const [peers, setPeers] = useState<Array<{ guestId: string; displayName: string }>>([]);
  const [logLines, setLogLines] = useState<string[]>([]);
  const [signalingState, setSignalingState] = useState("disconnected");
  const [welcomeId, setWelcomeId] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<PeerConnectionSnapshot | null>(null);
  const [fileEngine, setFileEngine] = useState<FileTransferEngineHandle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [relayOnly, setRelayOnly] = useState(false);
  const [iceConfig, setIceConfig] = useState<ValidatedRtcIceConfig>(() =>
    resolveClientIceConfig({ publicStunUrls: PUBLIC_STUN }),
  );
  const [turnNotice, setTurnNotice] = useState<string | null>(null);

  const clientRef = useRef<SignalingClient | null>(null);
  const peerServiceRef = useRef<PeerConnectionService | null>(null);
  const unsubRef = useRef<Array<() => void>>([]);
  const serverIceRef = useRef<IceServerConfig[] | null>(null);

  const conversationId = useMemo(() => `webrtc:${roomId}`, [roomId]);

  function pushLog(line: string) {
    setLogLines((prev) => [`${new Date().toLocaleTimeString()}  ${line}`, ...prev].slice(0, 50));
  }

  function rebuildIce(policy: "all" | "relay" = relayOnly ? "relay" : "all") {
    try {
      const next = resolveClientIceConfig({
        publicStunUrls: PUBLIC_STUN,
        serverIceServers: serverIceRef.current,
        iceTransportPolicy: policy,
      });
      setIceConfig(next);
      return next;
    } catch (err) {
      const message = err instanceof IceConfigError ? err.message : "Invalid ICE config.";
      setError(message);
      throw err;
    }
  }

  function cleanup() {
    unsubRef.current.forEach((u) => u());
    unsubRef.current = [];
    void peerServiceRef.current?.disconnect(conversationId);
    peerServiceRef.current = null;
    clientRef.current?.disconnect();
    clientRef.current = null;
    setSignalingState("disconnected");
    setWelcomeId(null);
    setSnapshot(null);
    setFileEngine(null);
    setPeers([]);
    serverIceRef.current = null;
    setTurnNotice(null);
    setIceConfig(resolveClientIceConfig({ publicStunUrls: PUBLIC_STUN }));
  }

  useEffect(() => {
    return () => {
      unsubRef.current.forEach((u) => u());
      unsubRef.current = [];
      clientRef.current?.disconnect();
      clientRef.current = null;
      peerServiceRef.current = null;
    };
  }, []);

  async function loadTurnCredentials(guestId: string | null) {
    try {
      const result = await fetchTurnCredentials({
        signalingBaseUrl: signalingUrl,
        guestId,
      });
      if (!result) {
        setTurnNotice("TURN credentials unavailable — using STUN-only.");
        serverIceRef.current = null;
        rebuildIce("all");
        return;
      }
      serverIceRef.current = result.iceServers;
      setTurnNotice(result.notice ?? `TURN credentials loaded (mode=${result.mode}).`);
      pushLog(`ICE from server (${result.mode}) — credentials not logged`);
      rebuildIce(relayOnly ? "relay" : "all");
    } catch (err) {
      serverIceRef.current = null;
      const message = err instanceof Error ? err.message : "TURN fetch failed";
      setTurnNotice(`TURN unavailable: ${message}`);
      pushLog(`TURN unavailable — STUN-only fallback`);
      try {
        setRelayOnly(false);
        rebuildIce("all");
      } catch {
        /* ignore */
      }
    }
  }

  function connectSignaling() {
    setError(null);
    cleanup();
    const client = new SignalingClient();
    clientRef.current = client;
    peerServiceRef.current = createPeerConnectionService(client);

    unsubRef.current.push(
      client.onState((s) => setSignalingState(s)),
      client.onWelcome((w) => {
        setWelcomeId(w.guestId);
        pushLog(`Signed in as ${w.displayName} (${w.guestId}) — guest-dev only`);
        pushLog(w.notice);
        void loadTurnCredentials(w.guestId);
      }),
      client.onError((e) => {
        setError(`${e.code}: ${e.message}`);
        pushLog(`Error ${e.code}: ${e.message}`);
      }),
      client.onPeerJoined((p) => {
        if (p.roomId !== roomId) return;
        setPeers((prev) =>
          prev.some((x) => x.guestId === p.guestId)
            ? prev
            : [...prev, { guestId: p.guestId, displayName: p.displayName }],
        );
        setRemoteGuestId((id) => id || p.guestId);
        pushLog(`Peer joined: ${p.displayName} (${p.guestId})`);
      }),
      client.onPeerLeft((p) => {
        if (p.roomId !== roomId) return;
        setPeers((prev) => prev.filter((x) => x.guestId !== p.guestId));
        pushLog(`Peer left: ${p.guestId}`);
        void peerServiceRef.current?.disconnect(conversationId);
      }),
      client.onOffer(async (msg) => {
        if (msg.roomId !== roomId || !peerServiceRef.current) return;
        pushLog(`Received offer from ${msg.fromGuestId} (signaling only until PC connects)`);
        setRemoteGuestId(msg.fromGuestId);
        try {
          const ice = rebuildIce(relayOnly ? "relay" : "all");
          const snap = await peerServiceRef.current.acceptRemoteOffer(
            {
              conversationId,
              roomId,
              localUserId: client.getWelcome()?.guestId ?? "local",
              remoteUserId: msg.fromGuestId,
              iceServers: ice.iceServers,
              iceTransportPolicy: ice.iceTransportPolicy,
            },
            msg.sdp,
          );
          setSnapshot(snap);
        } catch (err) {
          setError(err instanceof Error ? err.message : "Failed to answer offer");
        }
      }),
      client.onAnswer(async (msg) => {
        if (msg.roomId !== roomId || !peerServiceRef.current) return;
        pushLog(`Received answer from ${msg.fromGuestId}`);
        await peerServiceRef.current.handleRemoteAnswer(conversationId, msg.sdp);
        setSnapshot(peerServiceRef.current.getSnapshot(conversationId));
      }),
      client.onIce(async (msg) => {
        if (msg.roomId !== roomId || !peerServiceRef.current) return;
        await peerServiceRef.current.handleRemoteIceCandidate(conversationId, msg.candidate);
      }),
      peerServiceRef.current.onChange((snap) => {
        if (snap.conversationId !== conversationId) return;
        setSnapshot(snap);
        setFileEngine(peerServiceRef.current?.getFileTransferEngine(conversationId) ?? null);
        pushLog(
          `Peer: ${snap.diagnostics?.summary ?? `${snap.connection} isLive=${snap.isLive}`}${
            snap.lastError ? ` · ${snap.lastError}` : ""
          }`,
        );
      }),
    );

    client.connect({ url: signalingUrl, displayName });
  }

  async function joinRoom() {
    setError(null);
    const client = clientRef.current;
    if (!client) {
      setError("Connect signaling first.");
      return;
    }
    try {
      const joined = await client.joinRoom(roomId);
      pushLog(
        `Joined ${joined.roomId} · members=${joined.members.length} · duplicate=${joined.duplicateJoin}`,
      );
      setPeers(
        joined.members
          .filter((id) => id !== client.getWelcome()?.guestId)
          .map((guestId) => ({ guestId, displayName: guestId })),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Join failed");
    }
  }

  async function startOffer() {
    setError(null);
    const client = clientRef.current;
    const service = peerServiceRef.current;
    if (!client?.getWelcome() || !service) {
      setError("Connect signaling and join a room first.");
      return;
    }
    if (!remoteGuestId) {
      setError("Pick a remote guest id (appears when the other browser joins).");
      return;
    }
    try {
      const ice = rebuildIce(relayOnly ? "relay" : "all");
      const snap = await service.connect({
        conversationId,
        roomId,
        localUserId: client.getWelcome()!.guestId,
        remoteUserId: remoteGuestId,
        iceServers: ice.iceServers,
        iceTransportPolicy: ice.iceTransportPolicy,
      });
      setSnapshot(snap);
      pushLog(
        `Local offer sent · ICE source=${ice.source} · policy=${ice.iceTransportPolicy} · hasTurn=${ice.hasTurn}`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Offer failed");
    }
  }

  async function reconnect() {
    setError(null);
    const client = clientRef.current;
    const service = peerServiceRef.current;
    if (!client?.getWelcome() || !service || !remoteGuestId) {
      setError("Need signaling, room peer, and a prior session context.");
      return;
    }
    try {
      if (snapshot?.isLive) {
        await service.disconnect(conversationId);
        setSnapshot(null);
        setFileEngine(null);
        pushLog("Disconnected live peer before reconnect");
      }
      const ice = rebuildIce(relayOnly ? "relay" : "all");
      const snap = await service.reconnect(
        {
          conversationId,
          roomId,
          localUserId: client.getWelcome()!.guestId,
          remoteUserId: remoteGuestId,
          iceServers: ice.iceServers,
          iceTransportPolicy: ice.iceTransportPolicy,
        },
        { maxAttempts: 3 },
      );
      setSnapshot(snap);
      pushLog(`Reconnect offer sent (attempt ${snap.reconnectAttempt ?? 1})`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reconnect failed");
    }
  }

  async function refreshStats() {
    const snap = await peerServiceRef.current?.refreshDiagnostics(conversationId);
    if (snap) setSnapshot(snap);
  }

  const diag = snapshot?.diagnostics;
  const turnMissing = !iceConfig.hasTurn;

  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col gap-6 px-4 py-10">
      <div>
        <p className="font-[family-name:var(--font-display)] text-3xl font-semibold text-[var(--rc-ink)]">
          WebRTC Lab
        </p>
        <p className="mt-2 text-sm text-[var(--rc-muted)]">
          Development harness for two browser sessions. Guest identity is{" "}
          <strong>not</strong> production auth. Signaling connected ≠ WebRTC{" "}
          <code>isLive</code>.
        </p>
        <p className="mt-2 text-sm">
          <Link href="/demo" className="text-[var(--rc-accent)] hover:underline">
            ← Back to guest chat demo
          </Link>
        </p>
      </div>

      {turnMissing ? (
        <p
          className="rounded-xl bg-[var(--rc-warning-soft)] px-3 py-2 text-sm text-[var(--rc-warning)]"
          role="status"
        >
          TURN is unavailable — using STUN-only ICE. Restrictive NATs/firewalls may fail.
          Configure the signaling server TURN env vars and set{" "}
          <code>ALLOW_TURN_CREDENTIALS=true</code> for local relay testing. See README.
        </p>
      ) : null}

      {turnNotice ? (
        <p className="rounded-xl border border-[var(--rc-border)] bg-[var(--rc-surface-2)] px-3 py-2 text-xs text-[var(--rc-muted)]">
          {turnNotice}
        </p>
      ) : null}

      <section className="rounded-2xl border border-[var(--rc-border)] bg-[var(--rc-surface)] p-4">
        <h2 className="mb-3 text-sm font-semibold text-[var(--rc-ink)]">1. Connect signaling</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-xs">
            Signaling URL
            <input
              className="mt-1 w-full rounded-xl border border-[var(--rc-border)] px-3 py-2 text-sm"
              value={signalingUrl}
              onChange={(e) => setSignalingUrl(e.target.value)}
            />
          </label>
          <label className="text-xs">
            Display name
            <input
              className="mt-1 w-full rounded-xl border border-[var(--rc-border)] px-3 py-2 text-sm"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
          </label>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={connectSignaling}
            className="rounded-xl bg-[var(--rc-accent)] px-4 py-2 text-sm font-semibold text-white"
          >
            Connect signaling
          </button>
          <button
            type="button"
            onClick={cleanup}
            className="rounded-xl border border-[var(--rc-border)] px-4 py-2 text-sm"
          >
            Disconnect all
          </button>
        </div>
        <p className="mt-2 text-xs text-[var(--rc-muted)]">
          Signaling: <strong>{signalingState}</strong>
          {welcomeId ? ` · guestId=${welcomeId}` : ""}
        </p>
      </section>

      <section className="rounded-2xl border border-[var(--rc-border)] bg-[var(--rc-surface)] p-4">
        <h2 className="mb-3 text-sm font-semibold text-[var(--rc-ink)]">2. Join the same room</h2>
        <label className="text-xs">
          Room ID (both browsers must match)
          <input
            className="mt-1 w-full rounded-xl border border-[var(--rc-border)] px-3 py-2 text-sm"
            value={roomId}
            onChange={(e) => setRoomId(e.target.value)}
          />
        </label>
        <button
          type="button"
          onClick={() => void joinRoom()}
          className="mt-3 rounded-xl bg-[var(--rc-accent)] px-4 py-2 text-sm font-semibold text-white"
        >
          Join room
        </button>
        <ul className="mt-3 space-y-1 text-xs text-[var(--rc-muted)]">
          {peers.length === 0 ? <li>No remote peers yet — open a second browser session.</li> : null}
          {peers.map((p) => (
            <li key={p.guestId}>
              <button
                type="button"
                className="text-[var(--rc-accent)] hover:underline"
                onClick={() => setRemoteGuestId(p.guestId)}
              >
                {p.displayName} ({p.guestId})
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-2xl border border-[var(--rc-border)] bg-[var(--rc-surface)] p-4">
        <h2 className="mb-3 text-sm font-semibold text-[var(--rc-ink)]">3. Start WebRTC offer</h2>
        <label className="text-xs">
          Remote guest id
          <input
            className="mt-1 w-full rounded-xl border border-[var(--rc-border)] px-3 py-2 text-sm"
            value={remoteGuestId}
            onChange={(e) => setRemoteGuestId(e.target.value)}
          />
        </label>

        <label className="mt-3 flex items-start gap-2 text-xs text-[var(--rc-ink)]">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={relayOnly}
            disabled={turnMissing}
            onChange={(e) => {
              const next = e.target.checked;
              setRelayOnly(next);
              try {
                rebuildIce(next ? "relay" : "all");
              } catch {
                setRelayOnly(false);
              }
            }}
          />
          <span>
            Dev test: force <code>iceTransportPolicy=&quot;relay&quot;</code> (requires TURN).
            Normal mode uses the browser default (<code>all</code>).
          </span>
        </label>

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void startOffer()}
            className="rounded-xl bg-[var(--rc-accent)] px-4 py-2 text-sm font-semibold text-white"
          >
            Start call (offer)
          </button>
          <button
            type="button"
            onClick={() => void reconnect()}
            className="rounded-xl border border-[var(--rc-border)] px-4 py-2 text-sm"
          >
            Reconnect (bounded)
          </button>
          <button
            type="button"
            onClick={() => void refreshStats()}
            className="rounded-xl border border-[var(--rc-border)] px-4 py-2 text-sm"
          >
            Refresh ICE stats
          </button>
        </div>

        <div className="mt-4 rounded-xl bg-[var(--rc-surface-2)] px-3 py-3 text-xs text-[var(--rc-muted)]">
          <p className="font-semibold text-[var(--rc-ink)]">Connection diagnostics</p>
          <ul className="mt-2 space-y-1 font-mono text-[11px]">
            <li>lifecycle: {snapshot?.connection ?? "idle"} · isLive={String(snapshot?.isLive ?? false)}</li>
            <li>connectionState: {diag?.connectionState ?? "—"}</li>
            <li>iceConnectionState: {diag?.iceConnectionState ?? "—"}</li>
            <li>iceGatheringState: {diag?.iceGatheringState ?? "—"}</li>
            <li>dataChannel: {diag?.dataChannelState ?? snapshot?.dataChannel ?? "—"}</li>
            <li>
              path evidence: {diag?.relayEvidence ?? "unknown"}
              {diag?.usingRelay ? " · USING RELAY" : " · not labeled relay"}
            </li>
            <li>
              candidates: {diag?.localCandidateType ?? "?"} → {diag?.remoteCandidateType ?? "?"}
            </li>
            <li>
              ICE config: source={iceConfig.source} · hasTurn={String(iceConfig.hasTurn)} ·
              policy={iceConfig.iceTransportPolicy}
            </li>
          </ul>
          <p className="mt-2 text-[11px]">
            Relay is only claimed when <code>getStats()</code> shows a selected candidate type of{" "}
            <code>relay</code>. Signaling success alone never implies TURN.
          </p>
        </div>

        <ol className="mt-3 list-decimal space-y-1 pl-5 text-xs text-[var(--rc-muted)]">
          <li>Open this page in two browsers (or a normal + private window).</li>
          <li>Same Room ID, different display names → Connect signaling → Join room on both.</li>
          <li>
            Optional: enable relay-only after TURN credentials load, then Start call on one side.
          </li>
          <li>
            Wait until <code>isLive=true</code> and check path evidence. Refresh ICE stats if needed.
          </li>
          <li>Section 4: transfer a file. Transfers cannot reach offline peers.</li>
        </ol>
      </section>

      <FileTransferLabPanel
        engine={fileEngine}
        channelOpen={snapshot?.dataChannel === "open"}
        localLabel={displayName}
        remoteLabel={peers.find((p) => p.guestId === remoteGuestId)?.displayName ?? remoteGuestId}
      />

      {error ? (
        <p className="rounded-xl bg-[var(--rc-danger-soft)] px-3 py-2 text-sm text-[var(--rc-danger)]" role="alert">
          {error}
        </p>
      ) : null}

      <section className="rounded-2xl border border-[var(--rc-border)] bg-[var(--rc-surface-2)] p-4">
        <h2 className="mb-2 text-sm font-semibold text-[var(--rc-ink)]">Event log</h2>
        <pre className="max-h-64 overflow-auto text-[11px] leading-relaxed text-[var(--rc-muted)]">
          {logLines.join("\n") || "No events yet."}
        </pre>
      </section>
    </main>
  );
}
