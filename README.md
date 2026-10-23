# RelayChat

Commercial SaaS for real-time messaging and peer-to-peer file sharing.

## Phase status

| Phase | Status |
| --- | --- |
| 1 UI prototype | Folded into guest `/demo` |
| 2 Auth + Postgres messages + Realtime | Implemented — requires your Supabase project |
| 3 Conversation UX + WebRTC prep | Guest search/start DM, receipts simulator, WebRTC interfaces |
| 4 Signaling + RTCPeerConnection | Separate `server/` Socket.IO service + `/webrtc-lab` |
| 5 P2P file transfer over DataChannels | Implemented — `/webrtc-lab` + unit tests |
| Billing (Stripe) | Not started |

**Not production-ready yet.** Security SQL tests need a live Supabase DB. Deploy configuration and dashboard verification are still manual.

## Architecture (hybrid delivery)

- **Text messages & history:** Supabase PostgreSQL (source of truth)
- **Live updates:** Supabase Realtime (`postgres_changes` with RLS)
- **P2P files:** WebRTC `relaychat-file` DataChannel (chunked + SHA-256). Signaling never carries file bytes.

### Delivery vocabulary

- **Persisted** — row exists in `messages` (server accepted the write)
- **Delivered** — recipient wrote `message_deliveries.delivered_at`
- **Read** — recipient wrote `message_deliveries.read_at`

Persisting a message does **not** mean every recipient has received it.

## Stack

- Next.js App Router 16 + TypeScript + Tailwind CSS 4
- `@supabase/ssr` + `@supabase/supabase-js` (cookie sessions)
- Supabase Auth, Postgres, Realtime

## Environment variables

Copy `.env.example` → `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your_publishable_or_anon_key
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Legacy alias: `NEXT_PUBLIC_SUPABASE_ANON_KEY` is accepted if publishable key is unset.

**Never** put `SUPABASE_SERVICE_ROLE_KEY` in `NEXT_PUBLIC_*` or Client Components.

## Create a Supabase project + apply migrations

1. Create a project at [https://supabase.com/dashboard](https://supabase.com/dashboard).
2. Copy **Project URL** and **publishable** (or legacy **anon**) key into `.env.local`.
3. Install the [Supabase CLI](https://supabase.com/docs/guides/cli).
4. Link and push migrations:

```bash
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push
```

Or paste `supabase/migrations/20261022162334_initial_messaging.sql` into the SQL Editor and run it.

5. **Auth redirect URLs** (Authentication → URL configuration):
   - Site URL: `http://localhost:3000`
   - Redirect URLs: `http://localhost:3000/auth/callback`

6. Optional: disable email confirmation while developing (Authentication → Providers → Email), or keep it on and use the confirmation link.

## Local development

```bash
npm install
npm run dev
```

### Phase 4 signaling (second terminal)

```bash
cd server
cp .env.example .env
npm install
npm run dev
```

Set in frontend `.env.local`:

```bash
NEXT_PUBLIC_SIGNALING_URL=http://localhost:4001
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

- Marketing home: [http://localhost:3000](http://localhost:3000)
- Guest chat demo: `/demo` (no Supabase required)
- WebRTC lab (two browsers): `/webrtc-lab`
- Sign up / sign in: `/signup`, `/login`
- Protected chat: `/chat` (needs Supabase)

### Two-browser handshake + real file transfer

1. Start signaling (`server`) and Next.js (root)
2. Open two windows to `/webrtc-lab`
3. Same Room ID, different display names → Connect signaling → Join room
4. On one side: Start call (offer)
5. Wait until peer `isLive=true` and `dataChannel=open` (offeror creates `relaychat-file`; answerer accepts it)
6. Drop or choose a file in section 4 → other browser **Accept** → progress → **Save file**
7. Confirm the downloaded file matches (SHA-256 is verified before success)

**Limits (lab defaults):** 50 MiB max, 16 KiB chunks, bufferedAmount backpressure, transfer timeout.

**Honest constraints:** Offline recipients cannot receive. STUN-only lab may fail on restrictive NATs; TURN may relay *encrypted* WebRTC traffic when direct connectivity fails — that is still not Socket.IO file relay. Cross-browser / production reliability is not claimed without further testing. Guest identity remains **dev-only**.

See `server/README.md` for TLS/TURN/production notes.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Next.js dev server |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run test` | Message + file-transfer protocol/engine unit tests |
| `npm run build` | Production build |
| `npx supabase test db` | RLS SQL tests (needs linked local/remote DB) |

## Security notes (beginner-friendly)

- Browser only gets the **publishable/anon** key (safe by design when RLS is on).
- Chat route is protected on the **server**; the Next.js proxy refreshes cookies with `getClaims()`.
- RLS ensures you only see conversations/messages you belong to.
- `sender_id` is forced to the signed-in user — you cannot impersonate someone else.
- Sensitive SQL helpers live in the `private` schema with a fixed `search_path`.

## Manual dashboard steps still required

1. Create Supabase project and set `.env.local`
2. Apply migration (`db push` or SQL Editor)
3. Configure Auth Site URL + redirect URLs
4. Create two test users and a direct conversation (`select public.create_direct_conversation('<other-user-uuid>');` as one user via SQL or a small admin UI later)
5. Run `npx supabase test db` after CLI/local DB is available

## WebRTC / file transfer

- Signaling: `server/` (Socket.IO) — SDP/ICE only
- Peer connection: `src/lib/webrtc/peer-connection-service.ts`
- File protocol + engine: `src/lib/webrtc/file-protocol.ts`, `file-transfer-engine.ts`
- Manual two-browser test: `/webrtc-lab` (not mocked)
- Chat `/demo` still shows demo transfer UI only; live transfer is in the lab until chat wiring

Protocol summary: JSON control messages (`file-offer` … `file-error`) + binary chunk frames (`RCF1` magic). Offeror-only channel creation avoids conflicting DataChannels.
