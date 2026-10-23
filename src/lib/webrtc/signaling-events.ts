/** Keep in sync with server/src/types.ts SIGNAL_EVENTS. */
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
