import { config as loadDotenv } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { resolveTurnProvider } from "./turn/index.js";

// Always load server/.env next to this package — not process.cwd() (repo root .env).
const serverEnvPath = resolve(dirname(fileURLToPath(import.meta.url)), "../.env");
loadDotenv({ path: serverEnvPath });

function requiredInProd(name: string, value: string | undefined, fallback: string): string {
  if (value && value.trim()) return value.trim();
  if (process.env.NODE_ENV === "production") {
    throw new Error(`Missing required env ${name}`);
  }
  return fallback;
}

export const config = {
  nodeEnv: process.env.NODE_ENV === "production" ? "production" : "development",
  port: Number(process.env.PORT ?? 4001),
  corsOrigin: requiredInProd("CORS_ORIGIN", process.env.CORS_ORIGIN, "http://localhost:3000"),
  /** Dev-only. Forced false when nodeEnv === production. */
  allowGuestIdentity:
    process.env.NODE_ENV !== "production" && process.env.ALLOW_GUEST_IDENTITY === "true",
  rateLimitWindowMs: Number(process.env.RATE_LIMIT_WINDOW_MS ?? 10_000),
  rateLimitMaxEvents: Number(process.env.RATE_LIMIT_MAX_EVENTS ?? 40),
  maxSignalPayloadChars: Number(process.env.MAX_SIGNAL_PAYLOAD_CHARS ?? 65_536),
  /**
   * Dev-only TURN credential minting. Always false in production until real auth exists.
   * Even if TURN_* / Twilio env vars are set in production, the HTTP endpoint refuses to issue.
   */
  allowTurnCredentialsEndpoint:
    process.env.NODE_ENV !== "production" &&
    process.env.ALLOW_TURN_CREDENTIALS === "true" &&
    process.env.ALLOW_GUEST_IDENTITY === "true",
  /** Separate HTTP limiter for GET /turn-credentials (Socket.IO limiter does not apply). */
  turnHttpRateLimitWindowMs: Number(process.env.TURN_HTTP_RATE_LIMIT_WINDOW_MS ?? 60_000),
  turnHttpRateLimitMax: Number(process.env.TURN_HTTP_RATE_LIMIT_MAX ?? 20),
  turnHttpRateLimitMaxKeys: Number(process.env.TURN_HTTP_RATE_LIMIT_MAX_KEYS ?? 2048),
  /**
   * When true, honor leftmost X-Forwarded-For for TURN HTTP rate-limit keys.
   * Keep false unless the signaling server sits behind a trusted reverse proxy.
   */
  trustProxy: process.env.TRUST_PROXY === "true",
} as const;

/** May throw on partial Twilio configuration during startup. */
export const turnProvider = resolveTurnProvider(process.env);

export function assertCorsIsExactOrigin(origin: string): void {
  if (origin.includes("*")) {
    throw new Error("CORS_ORIGIN must be an exact origin, not a wildcard.");
  }
}

assertCorsIsExactOrigin(config.corsOrigin);
