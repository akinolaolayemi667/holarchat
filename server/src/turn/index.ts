import type { TurnCredentialProvider } from "./types.js";
import { createCoturnHmacProvider } from "./coturn-hmac-provider.js";
import { createStaticTurnProvider } from "./static-provider.js";

export type { TurnCredentialIssue, TurnCredentialProvider, IssuedIceServer } from "./types.js";
export { createCoturnHmacProvider } from "./coturn-hmac-provider.js";
export { createStaticTurnProvider } from "./static-provider.js";

function parseUrlList(raw: string | undefined): string[] {
  if (!raw?.trim()) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Prefer coturn HMAC when TURN_HMAC_SECRET is set; otherwise optional static lab creds.
 * Providers are replaceable — add a new adapter that implements TurnCredentialProvider.
 */
export function resolveTurnProvider(env: NodeJS.ProcessEnv = process.env): TurnCredentialProvider | null {
  const urls = parseUrlList(env.TURN_URLS);
  const ttlSeconds = Number(env.TURN_CREDENTIAL_TTL_SECONDS ?? 3600);

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
