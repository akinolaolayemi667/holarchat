import type { IncomingMessage, ServerResponse } from "node:http";
import { config, turnProvider } from "./config.js";
import { log } from "./logger.js";

function setCors(res: ServerResponse): void {
  res.setHeader("Access-Control-Allow-Origin", config.corsOrigin);
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-relaychat-guest-id");
  res.setHeader("Vary", "Origin");
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  setCors(res);
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
}

/**
 * GET /turn-credentials — development-only short-lived ICE servers.
 * Fail closed in production (no authenticated identity mechanism yet).
 * Never logs passwords or HMAC secrets.
 */
export async function handleTurnCredentialsHttp(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<boolean> {
  const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
  if (url.pathname !== "/turn-credentials") {
    return false;
  }

  if (req.method === "OPTIONS") {
    setCors(res);
    res.writeHead(204);
    res.end();
    return true;
  }

  if (req.method !== "GET") {
    sendJson(res, 405, { ok: false, code: "METHOD_NOT_ALLOWED", message: "Use GET." });
    return true;
  }

  // Production: always fail closed until real auth can gate credential issuance.
  if (config.nodeEnv === "production" || !config.allowTurnCredentialsEndpoint) {
    sendJson(res, 403, {
      ok: false,
      code: "TURN_CREDENTIALS_DISABLED",
      message:
        "TURN credential endpoint is disabled. Production requires authenticated identity before issuing credentials.",
    });
    return true;
  }

  if (!turnProvider?.isConfigured()) {
    sendJson(res, 503, {
      ok: false,
      code: "TURN_NOT_CONFIGURED",
      message:
        "No TURN provider configured. Set TURN_URLS plus TURN_HMAC_SECRET (preferred) or TURN_USERNAME/TURN_CREDENTIAL for local lab.",
    });
    return true;
  }

  const guestIdHeader = req.headers["x-relaychat-guest-id"];
  const guestId =
    typeof guestIdHeader === "string" && guestIdHeader.trim()
      ? guestIdHeader.trim().slice(0, 80)
      : "dev-guest";

  try {
    const issued = await turnProvider.issue(guestId);
    // Include a public STUN fallback alongside TURN for normal (non-relay-only) mode.
    const iceServers = [
      { urls: "stun:stun.l.google.com:19302" },
      ...issued.iceServers,
    ];
    log.info("issued turn credentials", {
      mode: issued.mode,
      ttlSeconds: issued.ttlSeconds,
      urlCount: issued.iceServers.length,
      // never log username/credential
    });
    sendJson(res, 200, {
      ok: true,
      mode: issued.mode,
      ttlSeconds: issued.ttlSeconds,
      notice: issued.notice,
      iceServers,
    });
  } catch (err) {
    log.error("turn credential issue failed", {
      message: err instanceof Error ? err.message : "unknown",
    });
    sendJson(res, 500, {
      ok: false,
      code: "TURN_ISSUE_FAILED",
      message: "Failed to issue TURN credentials.",
    });
  }

  return true;
}
