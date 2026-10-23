import assert from "node:assert/strict";
import { createServer } from "node:http";
import { after, before, describe, it } from "node:test";
import { Server } from "socket.io";
import { io as ioc, type Socket as ClientSocket } from "socket.io-client";
import { SIGNAL_EVENTS } from "./types.js";

/**
 * Integration tests spin a temporary Socket.IO server.
 * Env must be set before dynamically importing signaling (config/auth).
 */

function waitForEvent<T>(socket: ClientSocket, event: string, timeoutMs = 3000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timeout waiting for ${event}`)), timeoutMs);
    socket.once(event, (payload: T) => {
      clearTimeout(timer);
      resolve(payload);
    });
  });
}

describe("signaling integration", () => {
  let httpServer: ReturnType<typeof createServer>;
  let io: Server;
  let port: number;
  let attachSignaling: (io: Server) => void;

  before(async () => {
    process.env.ALLOW_GUEST_IDENTITY = "true";
    process.env.CORS_ORIGIN = "http://localhost:3000";
    // Avoid assigning to read-only process.env.NODE_ENV typings; development is the default for tests.

    ({ attachSignaling } = await import("./signaling.js"));

    httpServer = createServer();
    io = new Server(httpServer, {
      cors: { origin: "http://localhost:3000" },
    });
    attachSignaling(io);

    await new Promise<void>((resolve) => {
      httpServer.listen(0, () => resolve());
    });
    const address = httpServer.address();
    if (!address || typeof address === "string") throw new Error("No port");
    port = address.port;
  });

  after(async () => {
    io.close();
    await new Promise<void>((resolve, reject) => {
      httpServer.close((err) => (err ? reject(err) : resolve()));
    });
  });

  function connectGuest(displayName: string): ClientSocket {
    return ioc(`http://127.0.0.1:${port}`, {
      transports: ["websocket"],
      auth: { mode: "guest", displayName },
      forceNew: true,
    });
  }

  it("welcomes a valid guest and joins a room", async () => {
    const client = connectGuest("Alice");
    const welcome = await waitForEvent<{ guestId: string }>(client, SIGNAL_EVENTS.welcome);
    assert.match(welcome.guestId, /^guest_/);

    client.emit(SIGNAL_EVENTS.roomJoin, { roomId: "lab-room-1" });
    const joined = await waitForEvent<{ roomId: string; duplicateJoin: boolean }>(
      client,
      SIGNAL_EVENTS.roomJoined,
    );
    assert.equal(joined.roomId, "lab-room-1");
    assert.equal(joined.duplicateJoin, false);

    client.emit(SIGNAL_EVENTS.roomJoin, { roomId: "lab-room-1" });
    const dup = await waitForEvent<{ duplicateJoin: boolean }>(client, SIGNAL_EVENTS.roomJoined);
    assert.equal(dup.duplicateJoin, true);

    client.disconnect();
  });

  it("rejects invalid payloads", async () => {
    const client = connectGuest("Bob");
    await waitForEvent(client, SIGNAL_EVENTS.welcome);
    client.emit(SIGNAL_EVENTS.roomJoin, { roomId: "!!" });
    const err = await waitForEvent<{ code: string }>(client, SIGNAL_EVENTS.error);
    assert.equal(err.code, "INVALID_PAYLOAD");
    client.disconnect();
  });

  it("blocks unauthorized offers across rooms", async () => {
    const a = connectGuest("A");
    const b = connectGuest("B");
    await waitForEvent<{ guestId: string }>(a, SIGNAL_EVENTS.welcome);
    const welcomeB = await waitForEvent<{ guestId: string }>(b, SIGNAL_EVENTS.welcome);

    a.emit(SIGNAL_EVENTS.roomJoin, { roomId: "room-alpha" });
    await waitForEvent(a, SIGNAL_EVENTS.roomJoined);
    b.emit(SIGNAL_EVENTS.roomJoin, { roomId: "room-beta" });
    await waitForEvent(b, SIGNAL_EVENTS.roomJoined);

    a.emit(SIGNAL_EVENTS.offer, {
      roomId: "room-alpha",
      toGuestId: welcomeB.guestId,
      sdp: "v=0-fake-sdp",
    });
    const err = await waitForEvent<{ code: string }>(a, SIGNAL_EVENTS.error);
    assert.equal(err.code, "UNAUTHORIZED_SIGNAL");

    let gotOffer = false;
    b.once(SIGNAL_EVENTS.offer, () => {
      gotOffer = true;
    });
    await new Promise((r) => setTimeout(r, 150));
    assert.equal(gotOffer, false);

    a.disconnect();
    b.disconnect();
  });

  it("forwards offers only between room members and cleans up on disconnect", async () => {
    const a = connectGuest("Caller");
    const b = connectGuest("Callee");
    const welcomeA = await waitForEvent<{ guestId: string }>(a, SIGNAL_EVENTS.welcome);
    const welcomeB = await waitForEvent<{ guestId: string }>(b, SIGNAL_EVENTS.welcome);

    a.emit(SIGNAL_EVENTS.roomJoin, { roomId: "room-shared" });
    b.emit(SIGNAL_EVENTS.roomJoin, { roomId: "room-shared" });
    await waitForEvent(a, SIGNAL_EVENTS.roomJoined);
    await waitForEvent(b, SIGNAL_EVENTS.roomJoined);

    const offerPromise = waitForEvent<{ fromGuestId: string; sdp: string }>(
      b,
      SIGNAL_EVENTS.offer,
    );
    a.emit(SIGNAL_EVENTS.offer, {
      roomId: "room-shared",
      toGuestId: welcomeB.guestId,
      sdp: "v=0-offer",
    });
    const offer = await offerPromise;
    assert.equal(offer.fromGuestId, welcomeA.guestId);
    assert.equal(offer.sdp, "v=0-offer");

    const leftPromise = waitForEvent<{ guestId: string }>(
      b,
      SIGNAL_EVENTS.roomPeerLeft,
      5_000,
    );
    a.disconnect();
    const left = await leftPromise;
    assert.equal(left.guestId, welcomeA.guestId);

    b.disconnect();
  });
});
