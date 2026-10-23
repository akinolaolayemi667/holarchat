import { createServer } from "node:http";
import { Server } from "socket.io";
import { config } from "./config.js";
import { log } from "./logger.js";
import { attachSignaling } from "./signaling.js";

const httpServer = createServer((_req, res) => {
  res.writeHead(200, { "content-type": "application/json" });
  res.end(
    JSON.stringify({
      service: "relaychat-signaling",
      status: "ok",
      guestIdentityEnabled: config.allowGuestIdentity,
      nodeEnv: config.nodeEnv,
    }),
  );
});

const io = new Server(httpServer, {
  cors: {
    origin: config.corsOrigin,
    methods: ["GET", "POST"],
    credentials: true,
  },
  // Default maxHttpBufferSize is 1e6; keep SDP under our own char limit too.
  maxHttpBufferSize: Math.max(config.maxSignalPayloadChars * 2, 1e5),
});

attachSignaling(io);

httpServer.listen(config.port, () => {
  log.info("signaling server listening", {
    port: config.port,
    corsOrigin: config.corsOrigin,
    allowGuestIdentity: config.allowGuestIdentity,
    nodeEnv: config.nodeEnv,
  });
});
