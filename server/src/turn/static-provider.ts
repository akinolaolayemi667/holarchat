/**
 * Static username/password TURN credentials for local lab only.
 * Prefer coturn-hmac in anything beyond a private sandbox.
 */

import type { TurnCredentialIssue, TurnCredentialProvider } from "./types.js";

export interface StaticTurnConfig {
  urls: string[];
  username: string;
  credential: string;
  ttlSeconds: number;
}

export function createStaticTurnProvider(cfg: StaticTurnConfig): TurnCredentialProvider {
  return {
    id: "static",
    isConfigured() {
      return (
        cfg.urls.length > 0 &&
        cfg.username.length > 0 &&
        cfg.credential.length > 0
      );
    },
    async issue(subject: string): Promise<TurnCredentialIssue> {
      void subject;
      if (!this.isConfigured()) {
        throw new Error("Static TURN provider is not configured.");
      }
      return {
        mode: "static",
        ttlSeconds: cfg.ttlSeconds,
        notice:
          "Static TURN credentials for local development only. Do not use long-lived passwords in production.",
        iceServers: [
          {
            urls: cfg.urls.length === 1 ? cfg.urls[0]! : cfg.urls,
            username: cfg.username,
            credential: cfg.credential,
          },
        ],
      };
    },
  };
}
