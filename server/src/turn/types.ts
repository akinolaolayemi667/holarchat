/**
 * Replaceable TURN credential provider interface.
 * Master secrets stay on the server; browsers only receive short-lived iceServers.
 */

export interface IssuedIceServer {
  urls: string | string[];
  username?: string;
  credential?: string;
}

export type TurnCredentialMode = "static" | "coturn-hmac" | "twilio-nts";

export interface TurnCredentialIssue {
  iceServers: IssuedIceServer[];
  ttlSeconds: number;
  mode: TurnCredentialMode;
  notice: string;
}

export interface TurnCredentialProvider {
  readonly id: string;
  /** True when this provider has enough config to issue credentials. */
  isConfigured(): boolean;
  issue(subject: string): Promise<TurnCredentialIssue>;
}
