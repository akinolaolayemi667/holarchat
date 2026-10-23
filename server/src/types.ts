/** Shared signaling event names (server ↔ browser). */
export const SIGNAL_EVENTS = {
  welcome: "signal:welcome",
  error: "signal:error",
  roomJoin: "room:join",
  roomLeave: "room:leave",
  roomJoined: "room:joined",
  roomPeerJoined: "room:peer-joined",
  roomPeerLeft: "room:peer-left",
  offer: "signal:offer",
  answer: "signal:answer",
  iceCandidate: "signal:ice-candidate",
} as const;

export type SignalEventName = (typeof SIGNAL_EVENTS)[keyof typeof SIGNAL_EVENTS];

export interface GuestIdentity {
  guestId: string;
  displayName: string;
  /** Honest label — never treat as production auth. */
  authMode: "guest-dev";
}

export interface SocketSession {
  guestId: string;
  displayName: string;
  authMode: "guest-dev";
  rooms: Set<string>;
}

export interface SignalErrorPayload {
  code: string;
  message: string;
}
