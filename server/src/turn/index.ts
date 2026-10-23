import type { TurnCredentialProvider } from "./types.js";
import { createCoturnHmacProvider } from "./coturn-hmac-provider.js";
import { createStaticTurnProvider } from "./static-provider.js";
import {
  TWILIO_NTS_TTL_DEFAULT_SECONDS,
  createTwilioNtsProvider,
  inspectTwilioEnv,
} from "./twilio-nts-provider.js";

export type { TurnCredentialIssue, TurnCredentialProvider, IssuedIceServer, TurnCredentialMode } from "./types.js";
export { createCoturnHmacProvider } from "./coturn-hmac-provider.js";
export { createStaticTurnProvider } from "./static-provider.js";
export {
  createTwilioNtsProvider,
  inspectTwilioEnv,
  parseTwilioIceServers,
  clampTwilioTtl,
  TwilioNtsError,
} from "./twilio-nts-provider.js";

function parseUrlList(raw: string | undefined): string[] {
  if (!raw?.trim()) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function resolveTtlSeconds(env: NodeJS.ProcessEnv): number {
  const raw = env.TURN_CREDENTIAL_TTL_SECONDS;
  if (raw === undefined || raw.trim() === "") return TWILIO_NTS_TTL_DEFAULT_SECONDS;
  const n = Number(raw);
  if (!Number.isFinite(n) || !Number.isInteger(n)) {
    throw new Error("TURN_CREDENTIAL_TTL_SECONDS must be an integer.");
  }
  return n;
}

/**
 * Prefer Twilio NTS when fully configured.
 * Coturn HMAC / static remain available when Twilio is absent.
 * Partial Twilio env fails clearly (does not silently fall back).
 */
export function resolveTurnProvider(env: NodeJS.ProcessEnv = process.env): TurnCredentialProvider | null {
  const ttlSeconds = resolveTtlSeconds(env);
  const twilioState = inspectTwilioEnv(env);

  if (twilioState === "complete") {
    return createTwilioNtsProvider({
      accountSid: env.TWILIO_ACCOUNT_SID!.trim(),
      apiKey: env.TWILIO_API_KEY!.trim(),
      apiSecret: env.TWILIO_API_SECRET!.trim(),
      ttlSeconds,
    });
  }

  const urls = parseUrlList(env.TURN_URLS);

  if (env.TURN_HMAC_SECRET?.trim() && urls.length > 0) {
    return createCoturnHmacProvider({
      urls,
      sharedSecret: env.TURN_HMAC_SECRET.trim(),
      ttlSeconds,
    });
  }

  if (env.TURN_USERNAME?.trim() && env.TURN_CREDENTIAL?.trim() && urls.length > 0) {
    return createStaticTurnProvider({
      urls,
      username: env.TURN_USERNAME.trim(),
      credential: env.TURN_CREDENTIAL.trim(),
      ttlSeconds,
    });
  }

  return null;
}
