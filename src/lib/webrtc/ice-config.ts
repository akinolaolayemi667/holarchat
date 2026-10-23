/**
 * ICE / TURN configuration helpers (browser-safe parsing + validation).
 * Production TURN secrets must never live in NEXT_PUBLIC_* vars.
 */

import type { IceServerConfig } from "./types";

export type IceTransportPolicy = "all" | "relay";

export interface ValidatedRtcIceConfig {
  iceServers: IceServerConfig[];
  iceTransportPolicy: IceTransportPolicy;
  /** True when at least one turn: / turns: URL is present. */
  hasTurn: boolean;
  /** Human-readable source label for the lab UI. */
  source: "stun-default" | "env" | "server-credentials" | "custom";
}

const STUN_DEFAULT: IceServerConfig[] = [
  { urls: "stun:stun.l.google.com:19302" },
];

const ICE_URL_RE = /^(stun|stuns|turn|turns):.+/i;

export class IceConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IceConfigError";
  }
}

export function isIceUrl(value: string): boolean {
  return ICE_URL_RE.test(value.trim());
}

export function urlsIncludeTurn(urls: string | string[]): boolean {
  const list = Array.isArray(urls) ? urls : [urls];
  return list.some((u) => /^turns?:/i.test(u.trim()));
}

export function iceServersIncludeTurn(servers: IceServerConfig[]): boolean {
  return servers.some((s) => urlsIncludeTurn(s.urls));
}

/** Strict runtime validation — rejects empty/malformed entries. */
export function validateIceServers(raw: unknown): IceServerConfig[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new IceConfigError("iceServers must be a non-empty array.");
  }
  if (raw.length > 16) {
    throw new IceConfigError("Too many iceServers (max 16).");
  }

  return raw.map((entry, index) => {
    if (!entry || typeof entry !== "object") {
      throw new IceConfigError(`iceServers[${index}] must be an object.`);
    }
    const rec = entry as Record<string, unknown>;
    let urls: string | string[];
    if (typeof rec.urls === "string") {
      if (!isIceUrl(rec.urls)) {
        throw new IceConfigError(`iceServers[${index}].urls is not a valid stun/turn URL.`);
      }
      urls = rec.urls.trim();
    } else if (Array.isArray(rec.urls)) {
      if (rec.urls.length === 0 || rec.urls.length > 8) {
        throw new IceConfigError(`iceServers[${index}].urls array length invalid.`);
      }
      urls = rec.urls.map((u, j) => {
        if (typeof u !== "string" || !isIceUrl(u)) {
          throw new IceConfigError(`iceServers[${index}].urls[${j}] is invalid.`);
        }
        return u.trim();
      });
    } else {
      throw new IceConfigError(`iceServers[${index}].urls is required.`);
    }

    const hasTurn = urlsIncludeTurn(urls);
    const username = rec.username;
    const credential = rec.credential;

    if (username !== undefined && typeof username !== "string") {
      throw new IceConfigError(`iceServers[${index}].username must be a string.`);
    }
    if (credential !== undefined && typeof credential !== "string") {
      throw new IceConfigError(`iceServers[${index}].credential must be a string.`);
    }
    if (username !== undefined && username.length > 256) {
      throw new IceConfigError(`iceServers[${index}].username is too long.`);
    }
    if (credential !== undefined && credential.length > 512) {
      throw new IceConfigError(`iceServers[${index}].credential is too long.`);
    }
    if (hasTurn && (!username || !credential)) {
      throw new IceConfigError(
        `iceServers[${index}] TURN entry requires username and credential.`,
      );
    }
    if (!hasTurn && (username || credential)) {
      // STUN rarely needs auth; allow but do not require.
    }

    const out: IceServerConfig = { urls };
    if (typeof username === "string" && username.length > 0) out.username = username;
    if (typeof credential === "string" && credential.length > 0) out.credential = credential;
    return out;
  });
}

export function validateIceTransportPolicy(value: unknown): IceTransportPolicy {
  if (value === undefined || value === null || value === "") return "all";
  if (value === "all" || value === "relay") return value;
  throw new IceConfigError('iceTransportPolicy must be "all" or "relay".');
}

/**
 * Build RTCConfiguration from validated servers.
 * Normal mode uses browser default policy ("all"). Relay-only sets "relay".
 */
export function buildRtcConfiguration(
  iceServers: IceServerConfig[],
  iceTransportPolicy: IceTransportPolicy = "all",
): RTCConfiguration {
  const validated = validateIceServers(iceServers);
  const policy = validateIceTransportPolicy(iceTransportPolicy);
  if (policy === "relay" && !iceServersIncludeTurn(validated)) {
    throw new IceConfigError(
      'iceTransportPolicy "relay" requires at least one TURN server.',
    );
  }
  const config: RTCConfiguration = { iceServers: validated };
  if (policy === "relay") {
    config.iceTransportPolicy = "relay";
  }
  // Omit iceTransportPolicy when "all" so the browser uses its default.
  return config;
}

/**
 * Parse optional comma-separated public STUN URLs from env.
 * TURN credentials must come from the signaling credential endpoint, not NEXT_PUBLIC_*.
 */
export function resolveClientIceConfig(options?: {
  publicStunUrls?: string | undefined;
  serverIceServers?: IceServerConfig[] | null;
  iceTransportPolicy?: IceTransportPolicy;
}): ValidatedRtcIceConfig {
  const policy = validateIceTransportPolicy(options?.iceTransportPolicy ?? "all");

  if (options?.serverIceServers && options.serverIceServers.length > 0) {
    const iceServers = validateIceServers(options.serverIceServers);
    return {
      iceServers,
      iceTransportPolicy: policy,
      hasTurn: iceServersIncludeTurn(iceServers),
      source: "server-credentials",
    };
  }

  const stunRaw = options?.publicStunUrls?.trim();
  if (stunRaw) {
    const urls = stunRaw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const iceServers = validateIceServers(urls.map((u) => ({ urls: u })));
    return {
      iceServers,
      iceTransportPolicy: policy,
      hasTurn: iceServersIncludeTurn(iceServers),
      source: "env",
    };
  }

  const iceServers = validateIceServers(STUN_DEFAULT);
  if (policy === "relay") {
    throw new IceConfigError(
      'Relay-only mode needs TURN credentials from the signaling server (STUN-only default cannot relay).',
    );
  }
  return {
    iceServers,
    iceTransportPolicy: "all",
    hasTurn: false,
    source: "stun-default",
  };
}

export const DEFAULT_STUN_ICE_SERVERS = STUN_DEFAULT;
