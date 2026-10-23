# RelayChat Signaling Server (Phase 4)

Separate Node.js + TypeScript + Socket.IO service for WebRTC offer/answer/ICE relay.

## Important security notes

- **Guest identity is development-only.** It is **not** production authentication.
- In `NODE_ENV=production`, guest auth is **rejected** (fail closed).
- Room membership is enforced server-side. Client-supplied user IDs are **not** trusted as identity; the server assigns `guestId` on connect.
- A successful signaling handshake ≠ a connected WebRTC peer. The browser must reach `RTCPeerConnection.connectionState === "connected"`.
- **This server never relays file bytes.** Phase 5 file transfer uses an RTCDataChannel between browsers only.
- **TURN credentials:** `GET /turn-credentials` is development-only (`ALLOW_TURN_CREDENTIALS=true`). Production fails closed. HMAC/shared secrets stay in `server/.env` — never in the browser.

## Local start

```bash
cd server
cp .env.example .env
npm install
npm run dev
```

Server listens on `http://localhost:4001` by default.

Frontend `.env.local` should include:

```bash
NEXT_PUBLIC_SIGNALING_URL=http://localhost:4001
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## Two-browser handshake test

1. Start signaling: `npm run dev` (this folder)
2. Start Next.js: `npm run dev` (repo root)
3. Open two windows: `http://localhost:3000/webrtc-lab`
4. Use the **same Room ID** in both, different display names
5. Click **Connect signaling** on both, then **Join room**
6. On one side click **Start call (offer)** — watch states move to negotiating → connected when ICE succeeds
7. When `dataChannel=open`, use section 4 to send a real file (Accept on the other browser, then Save file)

## TURN credentials (Phase 6A)

Optional. Without TURN env vars the lab uses STUN-only and shows a warning.

```bash
# server/.env — Twilio NTS (preferred)
ALLOW_TURN_CREDENTIALS=true
TWILIO_ACCOUNT_SID=ACxxxxxxxx
TWILIO_API_KEY=SKxxxxxxxx
TWILIO_API_SECRET=xxxxxxxx
TURN_CREDENTIAL_TTL_SECONDS=3600

# Or self-hosted coturn when Twilio is unset:
# TURN_URLS=turn:YOUR_HOST:3478
# TURN_HMAC_SECRET=your-coturn-static-auth-secret
```

Then open `/webrtc-lab`, connect signaling (fetches credentials), enable **force relay**, and confirm diagnostics path evidence = `relay`.

See `docs/webrtc-turn.md` for firewall notes and provider adapters. Partial Twilio env fails clearly (does not silently fall back).

## Production deployment (checklist)

- Terminate TLS (HTTPS/WSS) in front of the signaling service
- Replace guest identity with real auth (e.g. short-lived JWT from your app server)
- Keep `CORS_ORIGIN` as an exact allow-list (no `*`)
- Add TURN credentials for restrictive NATs (issued short-lived from a trusted backend)
- Keep rate limits and payload size limits enabled
- Never log SDP/ICE payloads or secrets
