import type { IncomingMessage, ServerResponse } from "node:http";
import { config, turnProvider } from "./config.js";
import { log } from "./logger.js";
import { SlidingWindowRateLimiter } from "./rate-limit.js";
import type { TurnCredentialProvider } from "./turn/types.js";

export interface TurnHttpHandlerConfig {
  nodeEnv: "development" | "production";
  allowTurnCredentialsEndpoint: boolean;
  corsOrigin: string;
  trustProxy: boolean;
  turnProvider: TurnCredentialProvider | null;
  rateLimiter: SlidingWindowRateLimiter;
  retryAfterSeconds: number;
}

function setCors(res: ServerResponse, corsOrigin: string): void {
  res.setHeader("Access-Control-Allow-Origin", corsOrigin);
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-relaychat-guest-id");
  res.setHeader("Vary", "Origin");
}

function setNoStore(res: ServerResponse): void {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
  res.setHeader("Pragma", "no-cache");
}

function sendJson(
  res: ServerResponse,
  corsOrigin: string,
  status: number,
  body: unknown,
  extraHeaders?: Record<string, string>,
): void {
  setCors(res, corsOrigin);
  setNoStore(res);
  if (extraHeaders) {
    for (const [k, v] of Object.entries(extraHeaders)) {
      res.setHeader(k, v);
    }
  }
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
}

/** Client key for rate limiting — never trusts X-Forwarded-For unless trustProxy. */
export function turnHttpClientKey(req: IncomingMessage, trustProxy: boolean): string {
  if (trustProxy) {
    const xff = req.headers["x-forwarded-for"];
    if (typeof xff === "string" && xff.trim()) {
      const first = xff.split(",")[0]?.trim();
      if (first) return `xff:${first.slice(0, 128)}`;
    }
  }
  const addr = req.socket.remoteAddress ?? "unknown";
  return `ip:${addr}`;
}

export function createTurnCredentialsHandler(deps: TurnHttpHandlerConfig) {
  return async function handleTurnCredentialsHttp(
    req: IncomingMessage,
    res: ServerResponse,
  ): Promise<boolean> {
    const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
    if (url.pathname !== "/turn-credentials") {
      return false;
    }

    if (req.method === "OPTIONS") {
      setCors(res, deps.corsOrigin);
      setNoStore(res);
      res.writeHead(204);
      res.end();
      return true;
    }

    if (req.method !== "GET") {
      sendJson(res, deps.corsOrigin, 405, {
        ok: false,
        code: "METHOD_NOT_ALLOWED",
        message: "Use GET.",
      });
      return true;
    }

    // Production / opt-in gates: always fail closed until real auth exists.
    if (deps.nodeEnv === "production" || !deps.allowTurnCredentialsEndpoint) {
      sendJson(res, deps.corsOrigin, 403, {
        ok: false,
        code: "TURN_CREDENTIALS_DISABLED",
        message:
          "TURN credential endpoint is disabled. Production requires authenticated identity before issuing credentials.",
      });
      return true;
    }

    const clientKey = turnHttpClientKey(req, deps.trustProxy);
    if (!deps.rateLimiter.allow(clientKey)) {
      sendJson(
        res,
        deps.corsOrigin,
        429,
        {
          ok: false,
          code: "RATE_LIMITED",
          message: "Too many TURN credential requests. Try again later.",
        },
        { "Retry-After": String(deps.retryAfterSeconds) },
      );
      return true;
    }

    if (!deps.turnProvider?.isConfigured()) {
      sendJson(res, deps.corsOrigin, 503, {
        ok: false,
        code: "TURN_NOT_CONFIGURED",
        message:
          "No TURN provider configured. Set Twilio NTS (TWILIO_ACCOUNT_SID, TWILIO_API_KEY, TWILIO_API_SECRET) or coturn/static TURN_* vars.",
      });
      return true;
    }

    const guestIdHeader = req.headers["x-relaychat-guest-id"];
    const guestId =
      typeof guestIdHeader === "string" && guestIdHeader.trim()
        ? guestIdHeader.trim().slice(0, 80)
        : "dev-guest";

    try {
      const issued = await deps.turnProvider.issue(guestId);
      const iceServers =
        issued.mode === "twilio-nts"
          ? issued.iceServers
          : [{ urls: "stun:stun.l.google.com:19302" }, ...issued.iceServers];

      log.info("issued turn credentials", {
        mode: issued.mode,
        ttlSeconds: issued.ttlSeconds,
        urlCount: issued.iceServers.length,
      });

      sendJson(res, deps.corsOrigin, 200, {
        ok: true,
        mode: issued.mode,
        ttlSeconds: issued.ttlSeconds,
        notice: issued.notice,
        iceServers,
      });
    } catch (err) {
      const code =
        err instanceof Error && "code" in err && typeof (err as { code: unknown }).code === "string"
          ? (err as { code: string }).code
          : "UNKNOWN";
      // Log only sanitized codes — never credentials, Authorization, or upstream bodies.
      log.error("turn credential issue failed", { code });
      sendJson(res, deps.corsOrigin, 502, {
        ok: false,
        code: "TURN_ISSUE_FAILED",
        message: "Failed to issue TURN credentials.",
      });
    }

    return true;
  };
}

const defaultTurnHttpLimiter = new SlidingWindowRateLimiter(
  config.turnHttpRateLimitWindowMs,
  config.turnHttpRateLimitMax,
  config.turnHttpRateLimitMaxKeys,
);

/**
 * Production handler bound to process config.
 * GET /turn-credentials — development-only short-lived ICE servers.
 */
export const handleTurnCredentialsHttp = createTurnCredentialsHandler({
  nodeEnv: config.nodeEnv,
  allowTurnCredentialsEndpoint: config.allowTurnCredentialsEndpoint,
  corsOrigin: config.corsOrigin,
  trustProxy: config.trustProxy,
  turnProvider,
  rateLimiter: defaultTurnHttpLimiter,
  retryAfterSeconds: Math.max(1, Math.ceil(config.turnHttpRateLimitWindowMs / 1000)),
});
