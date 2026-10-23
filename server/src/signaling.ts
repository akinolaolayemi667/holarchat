import type { Server, Socket } from "socket.io";
import { config } from "./config.js";
import { mintGuestIdentity, GuestAuthRejectedError } from "./guest-auth.js";
import { log } from "./logger.js";
import { SlidingWindowRateLimiter } from "./rate-limit.js";
import { RoomRegistry } from "./rooms.js";
import { SIGNAL_EVENTS, type SocketSession } from "./types.js";
import {
  createAnswerSchema,
  createIceSchema,
  createOfferSchema,
  roomJoinSchema,
  roomLeaveSchema,
} from "./validation.js";

const sessions = new WeakMap<Socket, SocketSession>();
const rooms = new RoomRegistry();
const limiter = new SlidingWindowRateLimiter(
  config.rateLimitWindowMs,
  config.rateLimitMaxEvents,
);

function emitError(socket: Socket, code: string, message: string) {
  socket.emit(SIGNAL_EVENTS.error, { code, message });
}

function requireSession(socket: Socket): SocketSession | null {
  const session = sessions.get(socket);
  if (!session) {
    emitError(socket, "NO_SESSION", "Not authenticated to the signaling server.");
    return null;
  }
  return session;
}

function rateLimitOrReject(socket: Socket, session: SocketSession): boolean {
  if (!limiter.allow(session.guestId)) {
    emitError(socket, "RATE_LIMITED", "Too many signaling events. Slow down.");
    return false;
  }
  return true;
}

export function attachSignaling(io: Server): void {
  io.on("connection", (socket) => {
    try {
      // Re-read at connection time so tests can toggle env safely.
      const nodeEnv =
        process.env.NODE_ENV === "production" ? "production" : "development";
      const allowGuestIdentity =
        nodeEnv !== "production" && process.env.ALLOW_GUEST_IDENTITY === "true";

      const identity = mintGuestIdentity({
        allowGuestIdentity,
        nodeEnv,
        authPayload: socket.handshake.auth,
      });

      const session: SocketSession = {
        guestId: identity.guestId,
        displayName: identity.displayName,
        authMode: identity.authMode,
        rooms: new Set(),
      };
      sessions.set(socket, session);
      rooms.bindSocket(identity.guestId, socket.id);

      socket.emit(SIGNAL_EVENTS.welcome, {
        guestId: identity.guestId,
        displayName: identity.displayName,
        authMode: identity.authMode,
        notice:
          "Guest identity is for local development only. It is not production authentication.",
      });

      log.info("guest connected", {
        guestId: identity.guestId,
        socketId: socket.id,
      });
    } catch (err) {
      const message =
        err instanceof GuestAuthRejectedError
          ? err.message
          : "Authentication failed.";
      const code =
        err instanceof GuestAuthRejectedError ? err.code : "AUTH_FAILED";
      emitError(socket, code, message);
      log.warn("connection rejected", { code, socketId: socket.id });
      socket.disconnect(true);
      return;
    }

    socket.on(SIGNAL_EVENTS.roomJoin, (raw) => {
      const session = requireSession(socket);
      if (!session || !rateLimitOrReject(socket, session)) return;

      const parsed = roomJoinSchema.safeParse(raw);
      if (!parsed.success) {
        emitError(socket, "INVALID_PAYLOAD", "Invalid room:join payload.");
        return;
      }

      const { roomId } = parsed.data;
      const { alreadyMember, members } = rooms.join(roomId, session.guestId);
      session.rooms.add(roomId);
      void socket.join(roomId);

      socket.emit(SIGNAL_EVENTS.roomJoined, {
        roomId,
        guestId: session.guestId,
        members,
        duplicateJoin: alreadyMember,
      });

      if (!alreadyMember) {
        socket.to(roomId).emit(SIGNAL_EVENTS.roomPeerJoined, {
          roomId,
          guestId: session.guestId,
          displayName: session.displayName,
        });
      }
    });

    socket.on(SIGNAL_EVENTS.roomLeave, (raw) => {
      const session = requireSession(socket);
      if (!session || !rateLimitOrReject(socket, session)) return;
      const parsed = roomLeaveSchema.safeParse(raw);
      if (!parsed.success) {
        emitError(socket, "INVALID_PAYLOAD", "Invalid room:leave payload.");
        return;
      }
      const { roomId } = parsed.data;
      rooms.leave(roomId, session.guestId);
      session.rooms.delete(roomId);
      void socket.leave(roomId);
      socket.to(roomId).emit(SIGNAL_EVENTS.roomPeerLeft, {
        roomId,
        guestId: session.guestId,
      });
    });

    const forwardSignal = (
      event: typeof SIGNAL_EVENTS.offer | typeof SIGNAL_EVENTS.answer | typeof SIGNAL_EVENTS.iceCandidate,
      schema:
        | ReturnType<typeof createOfferSchema>
        | ReturnType<typeof createAnswerSchema>
        | ReturnType<typeof createIceSchema>,
      raw: unknown,
    ) => {
      const session = requireSession(socket);
      if (!session || !rateLimitOrReject(socket, session)) return;

      const parsed = schema.safeParse(raw);
      if (!parsed.success) {
        emitError(socket, "INVALID_PAYLOAD", `Invalid ${event} payload.`);
        return;
      }

      const data = parsed.data as {
        roomId: string;
        toGuestId: string;
        sdp?: string;
        candidate?: string;
      };

      if (!rooms.canSignal(data.roomId, session.guestId, data.toGuestId)) {
        emitError(
          socket,
          "UNAUTHORIZED_SIGNAL",
          "Both peers must be members of the same room. Client IDs alone are not enough.",
        );
        return;
      }

      const targetSocketId = rooms.getSocketIdForGuest(data.toGuestId);
      if (!targetSocketId) {
        emitError(socket, "PEER_OFFLINE", "Target peer is not connected.");
        return;
      }

      // Do not log SDP/ICE bodies.
      io.to(targetSocketId).emit(event, {
        roomId: data.roomId,
        fromGuestId: session.guestId,
        toGuestId: data.toGuestId,
        sdp: data.sdp,
        candidate: data.candidate,
        relayedAt: new Date().toISOString(),
      });
    };

    const offerSchema = createOfferSchema(config.maxSignalPayloadChars);
    const answerSchema = createAnswerSchema(config.maxSignalPayloadChars);
    const iceSchema = createIceSchema(config.maxSignalPayloadChars);

    socket.on(SIGNAL_EVENTS.offer, (raw) =>
      forwardSignal(SIGNAL_EVENTS.offer, offerSchema, raw),
    );
    socket.on(SIGNAL_EVENTS.answer, (raw) =>
      forwardSignal(SIGNAL_EVENTS.answer, answerSchema, raw),
    );
    socket.on(SIGNAL_EVENTS.iceCandidate, (raw) =>
      forwardSignal(SIGNAL_EVENTS.iceCandidate, iceSchema, raw),
    );

    socket.on("disconnect", () => {
      const session = sessions.get(socket);
      const guestId = rooms.unbindSocket(socket.id) ?? session?.guestId;
      if (guestId) {
        const left = rooms.leaveAll(guestId);
        for (const { roomId } of left) {
          socket.to(roomId).emit(SIGNAL_EVENTS.roomPeerLeft, {
            roomId,
            guestId,
          });
        }
        limiter.clear(guestId);
        log.info("guest disconnected", { guestId, socketId: socket.id });
      }
      sessions.delete(socket);
    });
  });
}

