/**
 * Replaceable TURN credential provider interface.
 * Master secrets stay on the server; browsers only receive short-lived iceServers.
 */

export interface IssuedIceServer {
  urls: string | string[];
  username?: string;
  credential?: string;
}

export interface TurnCredentialIssue {
  iceServers: IssuedIceServer[];
  ttlSeconds: number;
  mode: "static" | "coturn-hmac";
  notice: string;
}

export interface TurnCredentialProvider {
  readonly id: string;
  /** Returns null when this provider is not configured. */
  isConfigured(): boolean;
  issue(subject: string): Promise<TurnCredentialIssue>;
}
