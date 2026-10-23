/**
 * Twilio Network Traversal Service (NTS) credential provider.
 * @see https://www.twilio.com/docs/stun-turn/api
 *
 * POST /2010-04-01/Accounts/{AccountSid}/Tokens.json
 * Basic auth: API Key SID : API Key Secret
 *
 * Account SID, API key, and API secret never leave this process.
 */

import type { IssuedIceServer, TurnCredentialIssue, TurnCredentialProvider } from "./types.js";

/** Twilio NTS Ttl max is 24h; project default is 1h. */
export const TWILIO_NTS_TTL_MIN_SECONDS = 60;
export const TWILIO_NTS_TTL_MAX_SECONDS = 86_400;
export const TWILIO_NTS_TTL_DEFAULT_SECONDS = 3600;
export const TWILIO_NTS_REQUEST_TIMEOUT_MS = 8_000;

const ICE_URL_RE = /^(stun|stuns|turn|turns):.+/i;
const ACCOUNT_SID_RE = /^AC[0-9a-fA-F]{32}$/;

export interface TwilioNtsConfig {
  accountSid: string;
  apiKey: string;
  apiSecret: string;
  ttlSeconds: number;
  /** Injectable for tests. Defaults to global fetch. */
  fetchImpl?: typeof fetch;
  requestTimeoutMs?: number;
  apiBaseUrl?: string;
}

export class TwilioNtsError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "TwilioNtsError";
    this.code = code;
  }
}

export function clampTwilioTtl(ttlSeconds: number): number {
  if (!Number.isFinite(ttlSeconds) || !Number.isInteger(ttlSeconds)) {
    throw new TwilioNtsError("INVALID_TTL", "TURN_CREDENTIAL_TTL_SECONDS must be an integer.");
  }
  if (ttlSeconds < TWILIO_NTS_TTL_MIN_SECONDS || ttlSeconds > TWILIO_NTS_TTL_MAX_SECONDS) {
    throw new TwilioNtsError(
      "INVALID_TTL",
      `TURN_CREDENTIAL_TTL_SECONDS must be between ${TWILIO_NTS_TTL_MIN_SECONDS} and ${TWILIO_NTS_TTL_MAX_SECONDS}.`,
    );
  }
  return ttlSeconds;
}

export function parseTwilioIceServers(raw: unknown): IssuedIceServer[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new TwilioNtsError(
      "INVALID_RESPONSE",
      "Twilio token response missing a nonempty ice_servers array.",
    );
  }
  if (raw.length > 32) {
    throw new TwilioNtsError("INVALID_RESPONSE", "Twilio ice_servers array is too large.");
  }

  return raw.map((entry, index) => {
    if (!entry || typeof entry !== "object") {
      throw new TwilioNtsError("INVALID_RESPONSE", `ice_servers[${index}] is not an object.`);
    }
    const rec = entry as Record<string, unknown>;
    let urls: string | string[];
    if (typeof rec.urls === "string") {
      if (!ICE_URL_RE.test(rec.urls.trim())) {
        throw new TwilioNtsError("INVALID_RESPONSE", `ice_servers[${index}].urls is invalid.`);
      }
      urls = rec.urls.trim();
    } else if (Array.isArray(rec.urls)) {
      if (rec.urls.length === 0 || rec.urls.length > 8) {
        throw new TwilioNtsError("INVALID_RESPONSE", `ice_servers[${index}].urls length invalid.`);
      }
      urls = rec.urls.map((u, j) => {
        if (typeof u !== "string" || !ICE_URL_RE.test(u.trim())) {
          throw new TwilioNtsError(
            "INVALID_RESPONSE",
            `ice_servers[${index}].urls[${j}] is invalid.`,
          );
        }
        return u.trim();
      });
    } else if (typeof rec.url === "string" && ICE_URL_RE.test(rec.url.trim())) {
      // Older Twilio samples sometimes use "url" singular.
      urls = rec.url.trim();
    } else {
      throw new TwilioNtsError("INVALID_RESPONSE", `ice_servers[${index}] missing urls.`);
    }

    const out: IssuedIceServer = { urls };
    if (typeof rec.username === "string" && rec.username.length > 0) {
      if (rec.username.length > 512) {
        throw new TwilioNtsError("INVALID_RESPONSE", `ice_servers[${index}].username too long.`);
      }
      out.username = rec.username;
    }
    if (typeof rec.credential === "string" && rec.credential.length > 0) {
      if (rec.credential.length > 512) {
        throw new TwilioNtsError("INVALID_RESPONSE", `ice_servers[${index}].credential too long.`);
      }
      out.credential = rec.credential;
    }
    return out;
  });
}

/**
 * Detect partial Twilio env without echoing secret values.
 * Returns "complete" | "absent" | throws on partial.
 */
export function inspectTwilioEnv(env: NodeJS.ProcessEnv): "complete" | "absent" {
  const sid = env.TWILIO_ACCOUNT_SID?.trim() ?? "";
  const key = env.TWILIO_API_KEY?.trim() ?? "";
  const secret = env.TWILIO_API_SECRET?.trim() ?? "";
  const present = [Boolean(sid), Boolean(key), Boolean(secret)].filter(Boolean).length;
  if (present === 0) return "absent";
  if (present < 3) {
    throw new TwilioNtsError(
      "PARTIAL_CONFIG",
      "Partial Twilio configuration: set TWILIO_ACCOUNT_SID, TWILIO_API_KEY, and TWILIO_API_SECRET together, or omit all three.",
    );
  }
  if (!ACCOUNT_SID_RE.test(sid)) {
    throw new TwilioNtsError(
      "INVALID_CONFIG",
      "TWILIO_ACCOUNT_SID must look like a Twilio Account SID (AC…).",
    );
  }
  if (key.length < 8 || secret.length < 8) {
    throw new TwilioNtsError(
      "INVALID_CONFIG",
      "TWILIO_API_KEY and TWILIO_API_SECRET appear incomplete.",
    );
  }
  return "complete";
}

export function createTwilioNtsProvider(cfg: TwilioNtsConfig): TurnCredentialProvider {
  const ttlSeconds = clampTwilioTtl(cfg.ttlSeconds);
  const timeoutMs = cfg.requestTimeoutMs ?? TWILIO_NTS_REQUEST_TIMEOUT_MS;
  const fetchImpl = cfg.fetchImpl ?? fetch;
  const apiBase = (cfg.apiBaseUrl ?? "https://api.twilio.com").replace(/\/$/, "");

  return {
    id: "twilio-nts",
    isConfigured() {
      return (
        ACCOUNT_SID_RE.test(cfg.accountSid) &&
        cfg.apiKey.length >= 8 &&
        cfg.apiSecret.length >= 8
      );
    },
    async issue(_subject: string): Promise<TurnCredentialIssue> {
      void _subject;
      if (!this.isConfigured()) {
        throw new TwilioNtsError("NOT_CONFIGURED", "Twilio NTS provider is not configured.");
      }

      const url = `${apiBase}/2010-04-01/Accounts/${cfg.accountSid}/Tokens.json`;
      const auth = Buffer.from(`${cfg.apiKey}:${cfg.apiSecret}`).toString("base64");
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      let response: Response;
      try {
        response = await fetchImpl(url, {
          method: "POST",
          headers: {
            Authorization: `Basic ${auth}`,
            "Content-Type": "application/x-www-form-urlencoded",
            Accept: "application/json",
          },
          body: new URLSearchParams({ Ttl: String(ttlSeconds) }).toString(),
          signal: controller.signal,
        });
      } catch (err) {
        const aborted =
          (err instanceof Error && err.name === "AbortError") ||
          (typeof err === "object" &&
            err !== null &&
            "name" in err &&
            (err as { name: string }).name === "AbortError");
        if (aborted) {
          throw new TwilioNtsError("UPSTREAM_TIMEOUT", "Twilio NTS request timed out.");
        }
        throw new TwilioNtsError("UPSTREAM_NETWORK", "Twilio NTS request failed.");
      } finally {
        clearTimeout(timer);
      }

      if (!response.ok) {
        // Consume body without logging it.
        try {
          await response.text();
        } catch {
          /* ignore */
        }
        throw new TwilioNtsError(
          "UPSTREAM_HTTP",
          `Twilio NTS token request failed with status ${response.status}.`,
        );
      }

      let json: unknown;
      try {
        json = await response.json();
      } catch {
        throw new TwilioNtsError("INVALID_RESPONSE", "Twilio NTS returned non-JSON.");
      }

      if (!json || typeof json !== "object") {
        throw new TwilioNtsError("INVALID_RESPONSE", "Twilio NTS returned an invalid payload.");
      }
      const body = json as Record<string, unknown>;
      const iceServers = parseTwilioIceServers(body.ice_servers);

      let effectiveTtl = ttlSeconds;
      if (typeof body.ttl === "string" || typeof body.ttl === "number") {
        const parsed = Number(body.ttl);
        if (Number.isFinite(parsed) && parsed > 0) {
          effectiveTtl = Math.min(Math.floor(parsed), TWILIO_NTS_TTL_MAX_SECONDS);
        }
      }

      return {
        mode: "twilio-nts",
        ttlSeconds: effectiveTtl,
        notice:
          "Short-lived Twilio Network Traversal Service credentials. API secrets stay server-side. Dev/lab until production auth exists.",
        iceServers,
      };
    },
  };
}
