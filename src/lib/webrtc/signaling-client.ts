"use client";

import { io, type Socket } from "socket.io-client";
import { SIGNAL_EVENTS } from "./signaling-events";

export type SignalingSocketState = "disconnected" | "connecting" | "connected" | "error";

export interface SignalingWelcome {
  guestId: string;
  displayName: string;
  authMode: "guest-dev";
  notice: string;
}

export interface SignalingClientOptions {
  url: string;
  displayName: string;
}

/**
 * Browser Socket.IO client for the Phase 4 signaling server.
 * Guest auth is development-only on the server — not production identity.
 */
export class SignalingClient {
  private socket: Socket | null = null;
  private state: SignalingSocketState = "disconnected";
  private welcome: SignalingWelcome | null = null;
  private readonly stateListeners = new Set<(state: SignalingSocketState) => void>();
  private readonly welcomeListeners = new Set<(welcome: SignalingWelcome) => void>();
  private readonly errorListeners = new Set<(error: { code: string; message: string }) => void>();
  private readonly peerJoinedListeners = new Set<
    (peer: { roomId: string; guestId: string; displayName: string }) => void
  >();
  private readonly peerLeftListeners = new Set<(peer: { roomId: string; guestId: string }) => void>();
  private readonly offerListeners = new Set<
    (msg: { roomId: string; fromGuestId: string; sdp: string }) => void
  >();
  private readonly answerListeners = new Set<
    (msg: { roomId: string; fromGuestId: string; sdp: string }) => void
  >();
  private readonly iceListeners = new Set<
    (msg: { roomId: string; fromGuestId: string; candidate: string }) => void
  >();

  getState(): SignalingSocketState {
    return this.state;
  }

  getWelcome(): SignalingWelcome | null {
    return this.welcome;
  }

  onState(listener: (state: SignalingSocketState) => void): () => void {
    this.stateListeners.add(listener);
    return () => this.stateListeners.delete(listener);
  }

  onWelcome(listener: (welcome: SignalingWelcome) => void): () => void {
    this.welcomeListeners.add(listener);
    return () => this.welcomeListeners.delete(listener);
  }

  onError(listener: (error: { code: string; message: string }) => void): () => void {
    this.errorListeners.add(listener);
    return () => this.errorListeners.delete(listener);
  }

  onPeerJoined(
    listener: (peer: { roomId: string; guestId: string; displayName: string }) => void,
  ): () => void {
    this.peerJoinedListeners.add(listener);
    return () => this.peerJoinedListeners.delete(listener);
  }

  onPeerLeft(listener: (peer: { roomId: string; guestId: string }) => void): () => void {
    this.peerLeftListeners.add(listener);
    return () => this.peerLeftListeners.delete(listener);
  }

  onOffer(
    listener: (msg: { roomId: string; fromGuestId: string; sdp: string }) => void,
  ): () => void {
    this.offerListeners.add(listener);
    return () => this.offerListeners.delete(listener);
  }

  onAnswer(
    listener: (msg: { roomId: string; fromGuestId: string; sdp: string }) => void,
  ): () => void {
    this.answerListeners.add(listener);
    return () => this.answerListeners.delete(listener);
  }

  onIce(
    listener: (msg: { roomId: string; fromGuestId: string; candidate: string }) => void,
  ): () => void {
    this.iceListeners.add(listener);
    return () => this.iceListeners.delete(listener);
  }

  connect(options: SignalingClientOptions): void {
    this.disconnect();
    this.setState("connecting");

    this.socket = io(options.url, {
      transports: ["websocket"],
      auth: { mode: "guest", displayName: options.displayName },
      autoConnect: true,
    });

    this.socket.on("connect", () => {
      // Welcome event confirms guest session; socket connect alone is not enough.
    });

    this.socket.on("disconnect", () => {
      this.setState("disconnected");
    });

    this.socket.on("connect_error", () => {
      this.setState("error");
    });

    this.socket.on(SIGNAL_EVENTS.welcome, (payload: SignalingWelcome) => {
      this.welcome = payload;
      this.setState("connected");
      this.welcomeListeners.forEach((l) => l(payload));
    });

    this.socket.on(SIGNAL_EVENTS.error, (payload: { code: string; message: string }) => {
      this.errorListeners.forEach((l) => l(payload));
      if (payload.code === "GUEST_AUTH_REJECTED" || payload.code === "AUTH_FAILED") {
        this.setState("error");
      }
    });

    this.socket.on(SIGNAL_EVENTS.roomPeerJoined, (payload) => {
      this.peerJoinedListeners.forEach((l) => l(payload));
    });
    this.socket.on(SIGNAL_EVENTS.roomPeerLeft, (payload) => {
      this.peerLeftListeners.forEach((l) => l(payload));
    });
    this.socket.on(SIGNAL_EVENTS.offer, (payload) => {
      this.offerListeners.forEach((l) => l(payload));
    });
    this.socket.on(SIGNAL_EVENTS.answer, (payload) => {
      this.answerListeners.forEach((l) => l(payload));
    });
    this.socket.on(SIGNAL_EVENTS.iceCandidate, (payload) => {
      this.iceListeners.forEach((l) => l(payload));
    });
  }

  joinRoom(roomId: string): Promise<{ roomId: string; members: string[]; duplicateJoin: boolean }> {
    return this.emitWithAck(SIGNAL_EVENTS.roomJoin, SIGNAL_EVENTS.roomJoined, { roomId });
  }

  leaveRoom(roomId: string): void {
    this.socket?.emit(SIGNAL_EVENTS.roomLeave, { roomId });
  }

  sendOffer(roomId: string, toGuestId: string, sdp: string): void {
    this.socket?.emit(SIGNAL_EVENTS.offer, { roomId, toGuestId, sdp });
  }

  sendAnswer(roomId: string, toGuestId: string, sdp: string): void {
    this.socket?.emit(SIGNAL_EVENTS.answer, { roomId, toGuestId, sdp });
  }

  sendIceCandidate(roomId: string, toGuestId: string, candidate: string): void {
    this.socket?.emit(SIGNAL_EVENTS.iceCandidate, { roomId, toGuestId, candidate });
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }
    this.welcome = null;
    this.setState("disconnected");
  }

  private emitWithAck<T>(
    emitEvent: string,
    ackEvent: string,
    payload: unknown,
    timeoutMs = 5000,
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      if (!this.socket) {
        reject(new Error("Signaling socket is not connected."));
        return;
      }
      const timer = setTimeout(() => reject(new Error(`Timeout waiting for ${ackEvent}`)), timeoutMs);
      this.socket.once(ackEvent, (data: T) => {
        clearTimeout(timer);
        resolve(data);
      });
      this.socket.emit(emitEvent, payload);
    });
  }

  private setState(state: SignalingSocketState) {
    this.state = state;
    this.stateListeners.forEach((l) => l(state));
  }
}
