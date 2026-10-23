import "dotenv/config";

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
} as const;

export function assertCorsIsExactOrigin(origin: string): void {
  if (origin.includes("*")) {
    throw new Error("CORS_ORIGIN must be an exact origin, not a wildcard.");
  }
}

assertCorsIsExactOrigin(config.corsOrigin);
