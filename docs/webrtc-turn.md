# WebRTC ICE / TURN (Phase 6A)

## Credentials

| Secret | Where it lives | Browser? |
| --- | --- | --- |
| Coturn `static-auth-secret` / `TURN_HMAC_SECRET` | `server/.env` only | Never |
| Static `TURN_USERNAME` / `TURN_CREDENTIAL` | `server/.env` only (lab) | Never |
| Short-lived `iceServers` from `/turn-credentials` | Issued over HTTPS/HTTP to the lab | Yes (time-limited) |
| Public STUN URLs | Optional `NEXT_PUBLIC_STUN_URLS` | Yes (safe) |

Never put TURN passwords or HMAC secrets in `NEXT_PUBLIC_*` or commit `.env` / `.env.local` / `server/.env`.

## Server configuration

See `server/.env.example`:

- `ALLOW_TURN_CREDENTIALS=true` + `ALLOW_GUEST_IDENTITY=true` + `NODE_ENV=development` to enable minting
- `TURN_URLS` + `TURN_HMAC_SECRET` (preferred, coturn REST) or static username/password
- Exact `CORS_ORIGIN` (no wildcards)

Production always returns `403 TURN_CREDENTIALS_DISABLED` until authenticated identity can gate issuance.

## Provider adapters

`server/src/turn/` exposes `TurnCredentialProvider`:

- `twilio-nts` — [Twilio Network Traversal Service Tokens](https://www.twilio.com/docs/stun-turn/api) (preferred when configured)
- `coturn-hmac` — [coturn REST / time-limited credentials](https://github.com/coturn/coturn/wiki/turnserver)
- `static` — lab username/password

Twilio requires all three of `TWILIO_ACCOUNT_SID`, `TWILIO_API_KEY`, and `TWILIO_API_SECRET` in `server/.env` (never `NEXT_PUBLIC_*`). Partial Twilio config fails resolution instead of falling back. Default TTL is 3600 seconds (max 86400 per Twilio).

## Network / firewall notes

- UDP 3478 (TURN) and 5349 (TURNS) are common; also open the coturn relay port range.
- Corporate firewalls may block UDP; TURNS (TLS) sometimes works when UDP does not.
- STUN alone discovers public addresses; it does not relay media. Symmetric NAT often needs TURN.
- TURN relays **encrypted** WebRTC traffic when selected — it is not Socket.IO file relay.

## Diagnostics

The lab shows:

- `RTCPeerConnection.connectionState`
- `iceConnectionState` / `iceGatheringState`
- DataChannel `readyState`
- Selected candidate types from `getStats()` when supported

A path is labeled TURN-relayed **only** when selected candidate evidence includes type `relay`.

## Reconnect

Use **Reconnect (bounded)** in the lab. A live peer must be disconnected first — the service refuses silent replacement of an active connection and does not create duplicate `relaychat-file` channels.
