/**
 * Coturn REST API time-limited credentials (draft-uberti-behave-turn-rest).
 * @see https://github.com/coturn/coturn/wiki/turnserver
 *
 * username = `${unixExpiry}:${subject}`
 * credential = base64(HMAC-SHA1(sharedSecret, username))
 *
 * The shared secret (TURN_HMAC_SECRET) never leaves this process.
 */

import { createHmac } from "node:crypto";
import type { TurnCredentialIssue, TurnCredentialProvider } from "./types.js";

export interface CoturnHmacConfig {
  urls: string[];
  sharedSecret: string;
  ttlSeconds: number;
}

export function createCoturnHmacProvider(cfg: CoturnHmacConfig): TurnCredentialProvider {
  return {
    id: "coturn-hmac",
    isConfigured() {
      return cfg.urls.length > 0 && cfg.sharedSecret.length > 0;
    },
    async issue(subject: string): Promise<TurnCredentialIssue> {
      if (!this.isConfigured()) {
        throw new Error("Coturn HMAC provider is not configured.");
      }
      const ttl = Math.min(Math.max(cfg.ttlSeconds, 60), 86_400);
      const expiry = Math.floor(Date.now() / 1000) + ttl;
      const safeSubject = subject.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64) || "anon";
      const username = `${expiry}:${safeSubject}`;
      const credential = createHmac("sha1", cfg.sharedSecret).update(username).digest("base64");

      return {
        mode: "coturn-hmac",
        ttlSeconds: ttl,
        notice:
          "Short-lived coturn REST credentials. Master secret is server-side only. Dev/lab use until production auth exists.",
        iceServers: [
          {
            urls: cfg.urls.length === 1 ? cfg.urls[0]! : cfg.urls,
            username,
            credential,
          },
        ],
      };
    },
  };
}
