# Backstage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A mobile-first gig room (Before / Live / After) on real Nexconn group channels, with a crew loop where a lead's in-chat approval of an AI-drafted update changes the audience map and banner live.

**Architecture:** A single Next.js App Router app on Vercel. Route handlers own all state in Supabase Postgres and all Nexconn server calls (signed with the App Secret). Clients use the Nexconn Web SDK for chat. After any state write, the server sends a `BS:State`/`BS:Announce` custom message to the room, and clients refetch, so every live update travels over Nexconn.

**Tech Stack:** Next.js 15, React 19, TypeScript, Tailwind 4, `@nexconn/engine` + `@nexconn/chat`, `@supabase/supabase-js` (server only), `@google/genai` (Gemini), Vitest, zod.

**Spec:** `docs/superpowers/specs/2026-11-19-backstage-design.md`

## Global Constraints
- Deadline: Sun 22 Nov 2026 11:59 PM IST; submit by 8:00 PM IST.
- The App Secret, Supabase service key and Gemini key are only read in server code (`lib/server/**`, `app/api/**`). Never prefix them with `NEXT_PUBLIC_`.
- Nexconn base URL: `https://api.sg-light-api.com`, backup `https://api-b.sg-light-api.com`; switch on timeout >5s or non-2xx.
- Signature = hex SHA1 of `appSecret + nonce + timestamp`; nonce ≤18 chars; timestamp in ms. Headers: `App-Key`, `Nonce`, `Timestamp`, `Signature`.
- Nexconn channel IDs: alphanumeric only, ≤64 chars.
- Custom message types (register before `connect`): `BS:Poll`, `BS:SongReq`, `BS:Meetup`, `BS:Carpool`, `BS:Question`, `BS:Incident`, `BS:Proposal`, `BS:Announce` (persisted, counted) and `BS:State` (not persisted, not counted).
- AI never writes state. Only a `lead` approval changes a condition.
- Every permission check runs on the server.
- Display names are 1–32 chars after trim and always rendered as text.
- Commits: no Claude author/co-author lines.

## Review Focus
- The same person rejoins (refresh, second tab, back button) → same user, membership and channel; no duplicates. *(test in Task 4)*
- Double-tapping a vote, or two votes racing → exactly one vote per user per card; a second tap removes it. *(test in Task 7)*
- The Nexconn connection drops or the token is rejected → a visible "Reconnecting…" state; the client fetches a fresh token from `/api/token` and reconnects. *(manual check in Task 5)*
- A name that's empty, whitespace, 200 chars or `<script>` → rejected (400) or trimmed; never injected. *(test in Task 4)*
- A condition past `expires_at` → the map shows "Needs reconfirmation", not the old notice. *(test in Task 9)*

---

## File Structure
```
app/
  page.tsx                         landing → link to demo gig
  e/[slug]/page.tsx                join screen or gig room (client)
  e/[slug]/screen/page.tsx         stage screen (song queue)
  e/[slug]/crew/page.tsx           crew console
  e/[slug]/stats/page.tsx          lead-only stats
  api/join/route.ts                POST join
  api/token/route.ts               GET fresh Nexconn token
  api/event/[slug]/route.ts        GET event state (phase, cards, conditions, places)
  api/event/[slug]/phase/route.ts  POST lead phase override
  api/cards/route.ts               POST create card
  api/cards/[id]/vote/route.ts     POST toggle vote / join
  api/incidents/route.ts           POST create, GET list (crew)
  api/incidents/[id]/route.ts      PATCH status
  api/incidents/[id]/propose/route.ts  POST AI draft
  api/proposals/[id]/approve/route.ts  POST lead approve/reject
  api/fan/route.ts                 POST opt-in, POST feedback
lib/
  shared/types.ts                  domain types + message payload types
  shared/phase.ts                  phase computation
  shared/cards.ts                  vote tally/sort/seat logic
  shared/conditions.ts             effective condition (expiry)
  shared/incidents.ts              status transitions + permissions
  server/env.ts                    zod-validated env
  server/nexconn.ts                signed server API client
  server/db.ts                     supabase client + typed queries
  server/session.ts                signed cookie identity
  server/rooms.ts                  ensure channel (idempotent) + join
  server/ai.ts                     Gemini adapter + fallback
  client/nexconn.ts                SDK init/connect/register/send/history
  client/useRoom.ts                hook: messages, send, state-signal
components/
  Chat/*.tsx  Cards/*.tsx  VenueMap.tsx  PhasePill.tsx  Banner.tsx
seed/venue.json  public/venue.svg
supabase/schema.sql  scripts/seed.ts
tests/*.test.ts
```

---

### Task 1: Scaffold + env

**Files:** Create: the Next app at the repo root, `lib/server/env.ts`, `vitest.config.ts`, `.env.example`, `tests/env.test.ts`

**Interfaces:** Produces `env: { NEXCONN_APP_KEY, NEXCONN_APP_SECRET, NEXCONN_API_BASE, NEXCONN_API_BACKUP, SUPABASE_URL, SUPABASE_SERVICE_KEY, GEMINI_API_KEY?, SESSION_SECRET, NEXT_PUBLIC_NEXCONN_APP_KEY }` from `lib/server/env.ts` (parsed lazily via `getEnv()`).

- [ ] Run `npx create-next-app@latest . --ts --tailwind --app --eslint --no-src-dir --import-alias "@/*" --use-npm`, then `npm i zod @supabase/supabase-js @google/genai @nexconn/engine @nexconn/chat` and `npm i -D vitest`.
- [ ] Test `getEnv throws listing missing keys`: with `NEXCONN_APP_SECRET` unset, expect it to throw a message containing `NEXCONN_APP_SECRET`.
- [ ] Implement `getEnv()` with zod; defaults: `NEXCONN_API_BASE=https://api.sg-light-api.com`, `NEXCONN_API_BACKUP=https://api-b.sg-light-api.com`.
- [ ] `npx vitest run` → PASS; `npm run build` → succeeds.
- [ ] Commit `chore: scaffold Next app with env validation`.

### Task 2: Nexconn server client

**Files:** Create `lib/server/nexconn.ts`, `tests/nexconn.test.ts`

**Interfaces:** Produces:
```ts
sign(secret: string, nonce: string, ts: string): string
nexconnPost<T>(path: string, body: object, fetchImpl?: typeof fetch): Promise<T>  // throws NexconnError{code,path}
issueToken(userId: string, name: string): Promise<string>
createGroup(channelId: string, name: string, owner: string, userIds?: string[]): Promise<void>   // code 0 or "already exists" treated as ok
joinGroup(channelId: string, userIds: string[]): Promise<void>   // chunks of 100
sendGroupMessage(a: { from: string; channelId: string; type: string; content: object; persist?: boolean; push?: string }): Promise<void>
```
- [ ] Tests: `sign("secret","14314","1408710653491")` equals `crypto.createHash('sha1').update('secret143141408710653491').digest('hex')`; `nexconnPost` retries the backup base when the first fetch rejects; it throws `NexconnError` when the body `code !== 0`; `joinGroup` with 150 ids makes 2 calls; `sendGroupMessage` sends `toChannelIds:[id]`, `messageType`, `content` as a JSON string and `shouldPersist` 0/1.
- [ ] Implement with `AbortSignal.timeout(5000)`; nonce = random 12-char base36.
- [ ] Run tests → PASS. Commit `feat: signed Nexconn server client`.

### Task 3: Database schema + seed

**Files:** Create `supabase/schema.sql`, `lib/server/db.ts`, `lib/shared/types.ts`, `seed/venue.json`, `public/venue.svg`, `scripts/seed.ts`

**Interfaces:** Produces `types.ts`:
```ts
type Role = 'attendee'|'crew'|'lead'|'artist'
type Phase = 'before'|'live'|'after'
type Place = { id: string; name: string; kind: 'stage'|'bar'|'toilet'|'exit'|'entry'|'merch'|'firstaid'|'water'|'barrier'; x: number; y: number }
type Condition = { placeId: string; status: 'ok'|'limited'|'closed'; notice: string; approvedBy: string; approvedAt: string; expiresAt: string|null }
type Card = { id: string; eventId: string; type: 'poll'|'song'|'meetup'|'carpool'|'question'; authorId: string; payload: any; createdAt: string; votes: string[] /* userIds */ }
type IncidentStatus = 'new'|'checking'|'verified'|'resolved'
type Incident = { id: string; eventId: string; placeId: string|null; category: 'lost_item'|'lost_group'|'place_problem'|'help'; note: string; status: IncidentStatus; reporterId: string; channelId: string; createdAt: string }
type Proposal = { id: string; incidentId: string; placeId: string; status: Condition['status']; notice: string; expiresMins: number; state: 'pending'|'approved'|'rejected' }
```
Tables per spec §6: `events(id, slug unique, title, artist, venue, starts_at, ends_at, phase_override, crew_code, lead_code, artist_code)`, `users(id, name)`, `memberships(event_id,user_id,role, pk(event_id,user_id))`, `channels(context_type, context_id, channel_id, pk(context_type,context_id))`, `places`, `conditions(event_id, place_id, …, pk(event_id,place_id))`, `incidents`, `incident_updates(id, incident_id, actor_id, kind, old, new, created_at)`, `proposals`, `cards`, `card_votes(card_id,user_id, pk)`, `fan_optins(event_id,user_id pk)`, `feedback(event_id,user_id,rating,quote)`, `activity(event_id,user_id,day, messages int, pk)`.
- [ ] Write the schema; seed one event `slug=raahe-live`, title "Raahe Live — Listening Session", 10 places (Stage, Barrier, Bar 1, Bar 2, Merch, Toilets, Entry, Side exit, First aid, Water point).
- [ ] Run `npx tsx scripts/seed.ts` against Supabase → it prints `seeded raahe-live` (and can be re-run without duplicates: upsert).
- [ ] Commit `feat: schema, venue seed`.

### Task 4: Identity + join

**Files:** Create `lib/server/session.ts`, `lib/server/rooms.ts`, `app/api/join/route.ts`, `app/api/token/route.ts`, `tests/session.test.ts`, `tests/join.test.ts`

**Interfaces:** Produces:
```ts
signSession(userId: string): string; readSession(cookie?: string): string|null   // HMAC-SHA256, cookie "bs_uid", httpOnly, 30d
roleForCode(event, code?: string): Role   // lead_code→lead, crew_code→crew, artist_code→artist, else attendee
ensureChannel(ctxType: 'gig'|'crew'|'incident', ctxId: string, name: string, owner: string): Promise<string>  // channelId = `${ctxType}${ctxId}` stripped to [A-Za-z0-9], ≤64
POST /api/join {slug, name, code?} → {userId, name, role, token, gigChannelId, crewChannelId|null}
GET /api/token → {token}
```
- [ ] Tests: a tampered cookie → `readSession` returns null; `roleForCode` maps each code and a wrong code → attendee; join validation: `""`, `"   "`, 33 chars → 400; `"<b>x</b>"` is accepted and stored verbatim (rendering escapes it); **rejoin with an existing cookie returns the same userId and does not insert a second membership** (role only ever upgrades); join adds the user to the gig channel, and crew/lead also to the crew channel.
- [ ] Implement with the db functions mocked in tests via dependency injection (`joinHandler(deps)`).
- [ ] Run tests → PASS. Commit `feat: guest identity and join`.

### Task 5: Client chat core + two-session proof

**Files:** Create `lib/client/nexconn.ts`, `lib/client/useRoom.ts`, `app/dev/proof/page.tsx` (delete in Task 14)

**Interfaces:** Produces:
```ts
connectNexconn(getToken: () => Promise<string>): Promise<string /*userId*/>   // init once, registerCustomMessages(BS types) before connect, reconnect on token error
useRoom(channelId: string): { messages: ChatMsg[]; status: 'connecting'|'online'|'reconnecting'; sendText(t: string): Promise<void>; sendImage(f: File): Promise<void>; sendCustom(type: string, content: object): Promise<void>; onState(cb: (s: {kind: string}) => void): () => void }
type ChatMsg = { id: string; senderId: string; senderName: string; type: string; content: any; sentAt: number; mine: boolean }
```
- [ ] Load the SDK only on the client (`await import('@nexconn/chat')` inside the effect).
- [ ] History: `BaseChannel.createMessagesQuery({ channelIdentifier, startTime: Date.now(), pageSize: 50, isAscending: false })`, then reverse.
- [ ] Manual verification: open `/dev/proof` in two browsers (two different cookies), both join `raahe-live`, send a message each way → it appears in both within 2s; kill the network in one → "Reconnecting…" shows, then it recovers.
- [ ] Commit `feat: Nexconn client and room hook`.

### Task 6: Gig room shell + chat UI + phases

**Files:** Create `lib/shared/phase.ts`, `tests/phase.test.ts`, `app/e/[slug]/page.tsx`, `components/Chat/{MessageList,Composer,Bubble}.tsx`, `components/PhasePill.tsx`, `components/Banner.tsx`, `app/api/event/[slug]/route.ts`, `app/api/event/[slug]/phase/route.ts`

**Interfaces:** Produces `phaseOf(now: Date, startsAt: Date, endsAt: Date, override?: Phase|null): Phase`, with `before` = now < startsAt, `live` = between, `after` = now ≥ endsAt, and the override wins. `GET /api/event/[slug]` → `{event, phase, places, conditions, cards, me:{userId, role}}`.
- [ ] Tests: the boundaries (exactly at startsAt → live; exactly at endsAt → after); the override wins; the phase route returns 403 for non-leads.
- [ ] Build the join screen (name field, big Join button, optional "crew code" disclosure) → room with tabs Room · Map · Crew · Fan (Fan only in `after`). Dark stage-lit style, ≥44px tap targets. Phase change → server `BS:State {kind:'event'}` → clients refetch.
- [ ] Run tests → PASS; manual check at a 375px viewport. Commit `feat: gig room shell and chat UI`.

### Task 7: Interactive cards

**Files:** Create `lib/shared/cards.ts`, `tests/cards.test.ts`, `app/api/cards/route.ts`, `app/api/cards/[id]/vote/route.ts`, `components/Cards/{Poll,SongReq,Meetup,Carpool,Question,CardRenderer}.tsx`

**Interfaces:** Produces:
```ts
toggleVote(votes: string[], userId: string, opts?: {single?: boolean}): string[]
songQueue(cards: Card[]): Card[]                 // type song, desc votes, tie → earlier createdAt first
seatsLeft(card: Card): number                    // payload.seats - (votes.length) , min 0
canCreate(type: Card['type'], role: Role, phase: Phase): boolean  // poll: lead|artist; song: phase live; question: phase after; meetup/carpool: phase before|live
```
Card creation posts the card's custom message (`BS:Poll` etc. with `{cardId}`) into the gig room from the server; votes write `card_votes`, then send `BS:State {kind:'card', cardId}`. The renderers read live card data from the event state, so tallies are always the DB truth. Poll votes are single-choice per poll (`payload.options`, vote stored as `userId:optionIndex`).
- [ ] Tests: toggling twice → not voted; **a vote request repeated concurrently → exactly one row (pk conflict = ok)**; a carpool join when `seatsLeft==0` → 409; song queue order with ties; `canCreate('song','attendee','before')` false.
- [ ] Run tests → PASS. Commit `feat: interactive chat cards`.

### Task 8: Stage screen

**Files:** Create `app/e/[slug]/screen/page.tsx`
- [ ] Full-screen dark page: the top 8 of `songQueue` with vote counts, animated reordering (CSS transitions on `transform`), a QR code of the join URL (`qrcode` package) and the live attendee count. It listens to the gig room's `BS:State` via `useRoom`.
- [ ] Manual: vote on a phone → the screen reorders within 2s. Commit `feat: stage screen`.

### Task 9: Venue map + conditions

**Files:** Create `lib/shared/conditions.ts`, `tests/conditions.test.ts`, `components/VenueMap.tsx`

**Interfaces:** Produces `effectiveCondition(c: Condition|undefined, now: Date): {status: 'ok'|'limited'|'closed'|'stale'; notice?: string; approvedBy?: string; approvedAt?: string}`.
- [ ] Tests: no condition → ok; **expired → `stale`, with the notice omitted**; not expired → passes through.
- [ ] Map: `public/venue.svg` background, a place pin per place with a status badge (icon + text, not colour alone), and a tap → sheet showing the place, notice, "Verified by {name} · {time ago}" or "Needs reconfirmation", plus a "Report a problem here" button (opens Task 10's sheet prefilled). There's also a list view below the map for screen readers.
- [ ] Run tests → PASS. Commit `feat: venue map with live conditions`.

### Task 10: Report → incident → crew console

**Files:** Create `lib/shared/incidents.ts`, `tests/incidents.test.ts`, `app/api/incidents/route.ts`, `app/api/incidents/[id]/route.ts`, `app/e/[slug]/crew/page.tsx`, `components/ReportSheet.tsx`, `components/IncidentRoom.tsx`

**Interfaces:** Produces:
```ts
canTransition(from: IncidentStatus, to: IncidentStatus, role: Role): boolean   // new→checking (crew|lead), checking→verified (lead), any→resolved (crew|lead), attendee: none
attendeeLabel(s: IncidentStatus): string  // new "Report received", checking "Crew is checking", verified "Crew confirmed", resolved "Sorted"
POST /api/incidents {slug, category, placeId?, note} → {incident}   // creates channel `incident<id>` with reporter + all crew/lead members; server posts BS:Incident card into it AND into crew room
PATCH /api/incidents/[id] {status} → audit row + BS:State{kind:'incident'} to the incident room
```
- [ ] Tests: the transition matrix incl. an attendee trying to verify → 403; a note >500 chars → 400; the crew list endpoint → 403 for attendees.
- [ ] Crew console: left column incident queue grouped by status, right column map; selecting an incident opens its room (`useRoom(channelId)`) with Acknowledge / On it / Resolved buttons. The attendee "Crew" tab lists my incidents with `attendeeLabel` and opens the same room.
- [ ] Run tests → PASS; manual two-browser check: report on phone → it appears on crew within 2s, and chat works both ways. Commit `feat: incidents and crew console`.

### Task 11: AI draft + in-chat lead approval (the wow)

**Files:** Create `lib/server/ai.ts`, `tests/ai.test.ts`, `app/api/incidents/[id]/propose/route.ts`, `app/api/proposals/[id]/approve/route.ts`, `components/Cards/Proposal.tsx`, `tests/approve.test.ts`

**Interfaces:** Produces:
```ts
draftProposal(input: {incident: Incident; place: Place|null; places: Place[]; messages: {name: string; text: string}[]}): Promise<{placeId: string; status: 'limited'|'closed'|'ok'; notice: string; expiresMins: number; source: 'ai'|'fallback'}>
POST /api/incidents/[id]/propose (crew|lead) → creates a pending proposal, sends BS:Proposal{proposalId} into the incident room
POST /api/proposals/[id]/approve {decision:'approve'|'reject', notice?} (lead only) → on approve: upsert condition (approved_by, approved_at, expires_at=now+expiresMins), incident → verified, audit row, BS:Announce{placeId, notice} to gig room, BS:State{kind:'conditions'} to gig + crew rooms
```
Gemini model `gemini-3.5-flash-lite`, JSON response schema, a prompt that may only use the given places, notice ≤140 chars, attendee-facing and calm. On a missing key, non-JSON, unknown placeId or timeout (8s) → fallback `{placeId: incident.placeId, status:'limited', notice: \`${place.name}: crew update — please follow staff directions.\`, expiresMins: 60, source:'fallback'}`.
- [ ] Tests: malformed AI output → fallback; unknown placeId → fallback; **a crew member (non-lead) approving → 403**; approving an already-approved proposal → 200, no second announce; reject → no condition written.
- [ ] The Proposal card shows the notice (editable by crew before approval), Approve/Reject for leads only, and after a decision "Approved by {name} · {time}".
- [ ] Gig room: `BS:Announce` → `Banner` at the top (dismissable, persists in the event state as the latest condition notices) + the map badge updates.
- [ ] Run tests → PASS; manual golden path from spec §4 in two browsers. Commit `feat: AI-drafted updates with lead approval`.

### Task 12: After phase — fan channel

**Files:** Create `app/api/fan/route.ts`, `components/FanTab.tsx`, `tests/fan.test.ts`
- [ ] `POST /api/fan {slug, action:'optin'}` (idempotent) and `{action:'feedback', rating 1–5, quote ≤280}` (one per user, upsert).
- [ ] Tests: opt-in twice → count 1; rating 0 or 6 → 400.
- [ ] Fan tab: an opt-in hero ("Get first access to Raahe's next gig", count), a photo grid built from image messages in the room history, Q&A (question cards, upvote; artist replies render with an "Artist" badge), and a feedback stars + quote form.
- [ ] Run tests → PASS. Commit `feat: fan channel after the gig`.

### Task 13: Stats + activity tracking

**Files:** Create `app/e/[slug]/stats/page.tsx`, `app/api/activity/route.ts`
- [ ] The client calls `POST /api/activity` (debounced, at most once per 30s) after a successful send, incrementing `activity.messages`.
- [ ] Stats (lead only, else 403): joined users; users with ≥1 message; messages; rooms with activity; incidents + median minutes from report to verified; fan opt-ins; average rating + quotes. Big numbers, screenshot-ready.
- [ ] Manual check; commit `feat: traction stats page`.

### Task 14: Deploy, polish, submission

**Files:** Modify: delete `app/dev/proof`; create `README.md`, `docs/writeup.md`
- [ ] Empty/loading/error states on every screen; no dead buttons (grep for `onClick={() => {}}`).
- [ ] Push to a public GitHub repo; set the Vercel env vars; deploy; run the golden path on the live URL on two real phones.
- [ ] README: what it is, the Nexconn features used (group channels, server API, 9 custom message types, media messages), run instructions.
- [ ] `docs/writeup.md` → PDF: problem, solution, the Nexconn SDK features list, **App Key**, traction numbers + quotes, business model.
- [ ] Commit `docs: readme and write-up`.
