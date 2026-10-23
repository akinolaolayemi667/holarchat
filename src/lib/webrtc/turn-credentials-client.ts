/**
 * Browser client for the signaling server's TURN credential endpoint.
 * Never logs credentials. Failures fall back to STUN-only.
 */

import type { IceServerConfig } from "./types";
import { IceConfigError, validateIceServers } from "./ice-config";

export interface TurnCredentialsResponse {
  ok: true;
  iceServers: IceServerConfig[];
  ttlSeconds?: number;
  notice?: string;
  mode: "static" | "coturn-hmac" | "disabled";
}

export interface TurnCredentialsErrorBody {
  ok: false;
  code: string;
  message: string;
}

export async function fetchTurnCredentials(options: {
  signalingBaseUrl: string;
  /** Dev guest id — server may require guest-dev mode. */
  guestId?: string | null;
  signal?: AbortSignal;
}): Promise<{ iceServers: IceServerConfig[]; notice?: string; mode: string } | null> {
  const base = options.signalingBaseUrl.replace(/\/$/, "");
  const url = `${base}/turn-credentials`;
  const headers: Record<string, string> = { Accept: "application/json" };
  if (options.guestId) {
    headers["x-relaychat-guest-id"] = options.guestId;
  }

  const res = await fetch(url, {
    method: "GET",
    headers,
    credentials: "omit",
    signal: options.signal,
  });

  let body: unknown;
  try {
    body = await res.json();
  } catch {
    throw new IceConfigError("TURN credential endpoint returned non-JSON.");
  }

  if (!res.ok) {
    const err = body as TurnCredentialsErrorBody;
    const msg =
      err && typeof err.message === "string"
        ? err.message
        : `TURN credentials unavailable (${res.status}).`;
    throw new IceConfigError(msg);
  }

  const okBody = body as TurnCredentialsResponse;
  if (!okBody || okBody.ok !== true) {
    throw new IceConfigError("TURN credential response missing ok:true.");
  }

  const iceServers = validateIceServers(okBody.iceServers);
  return {
    iceServers,
    notice: okBody.notice,
    mode: okBody.mode,
  };
}
