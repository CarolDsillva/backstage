# Backstage — Design

**Date:** 19 Nov 2026 · **For:** Nexconn Build Challenge 2026 · **Hard deadline:** Sun 22 Nov 2026, 11:59 PM IST (internal target: submitted by 8:00 PM IST)

## 1. Intent

Backstage is the chat room for every gig: it opens before the show, runs the night, and stays alive afterward as the artist's fan channel. Behind it sits a crew side: when the audience reports something ("bar 2 is out of stock", "lost my phone at the barrier", "side exit locked"), the crew discuss it in a linked room, and once a lead approves, the verified update lands in the audience room and on the venue map, live.

It merges two earlier ideas:
- **Raahe Rooms** (audience lifecycle room → fan channel). Raahe runs gigs and already has audiences, which gives us real users.
- **VenueVerse blueprint** (report → contextual room → authorised verification → shared venue state changes). This gives the "conversation changes the app" moment.

**Why we're building it:** to win the Nexconn Build Challenge (1st place: $2,000), then keep running it for Raahe gigs.

### What judges score (official) and how we answer it
| Criterion | Weight | Our answer |
|---|---|---|
| Completeness & UX | 50% | A narrow product that's fully working and polished. No dead buttons. Mobile-first. |
| Innovation & scenario value | 30% | Interactive chat cards (polls, song queue with crowd voting on a stage screen), plus an AI-drafted crew update that a lead approves inside the chat and that changes the audience map live. |
| Business & growth | 20% | Real users from a Raahe test session. The fan channel that lives on after the gig is the business case: promoters pay per event, artists keep their audience. |

## 2. Goals, non-goals, anti-goals

**Goals**
- One gig event, seeded, works end-to-end on phones through a QR link.
- Every chat is real Nexconn messaging (group channels + custom message types). No fake chat.
- Real-user test session before the deadline. Target 20–30 active Nexconn users minimum, 50+ stretch.
- Submission: live URL, public GitHub, write-up PDF with App Key, demo video, traction evidence.

**Non-goals (cut deliberately)**
- Map editor / map studio (the venue is seeded from a JSON file + SVG).
- Indoor routing and route graphs (a gig venue is one room; the map shows places and their live status).
- Ticketing, payments, real presale, real ticket swap transactions.
- Multi-event organiser accounts, analytics dashboards beyond one stats page.
- Call SDK, voice notes, multilingual.

**Anti-goals (failure even if it "works")**
- Chat that looks like chat but isn't Nexconn.
- AI or a raw attendee message changing official venue state without a human lead's approval.
- Inflated traction (bots, duplicate accounts).
- Joining takes more than ~30 seconds or needs a password.

## 3. Users & roles
| Role | How they get in | Can do |
|---|---|---|
| Attendee | Scan gig QR → enter display name | Gig room chat, vote, request songs, sign up to meetups, report to crew, follow own reports, fan opt-in, feedback |
| Crew | Gig link + crew code | Everything an attendee can do, plus crew console, incident rooms, comment, propose an update |
| Lead | Crew code with lead flag (separate lead code) | Approve or reject proposed updates, change phase, pin announcements |
| Artist | Artist code | Stage screen, answer the Q&A, post in the fan channel with an "Artist" badge |

Identity is guest-style: the server creates a user ID and sets a signed httpOnly cookie. Codes are per-event secrets stored in env/DB. **All permission checks run on the server.**

## 4. The experience

### Gig room — attendee (mobile web)
Header: gig name, artist, venue, phase pill (**Before · Live · After**), live banner for verified updates.
Tabs: **Room** (chat) · **Map** · **Crew** (my reports) · **Fan** (after phase).

The phase is computed from the event time, and a lead can override it (needed for the demo and the test session).

**Before phase:** chat, plus cards anyone can post from a "+" menu:
- **Setlist poll** (lead/artist creates; everyone votes, tallies update live)
- **Going solo**: a single "I'm going solo" card with a join button. It lists who's in, and tapping a name opens the room thread
- **Carpool / auto-share** offer card: from, time, seats. Join decrements the seats.

**Live phase:**
- **Song request queue**: request a song (card); others upvote it; the queue sorts by votes. The **Stage screen** (`/e/[slug]/screen`, for a projector or laptop) shows the top requests big, updating live.
- **Tell the crew** button: category (Lost item · Lost my group · Problem at a place · Need help) + pick a place on the map + note + optional photo. It creates an incident.

**After phase:** the room becomes the **Fan channel**:
- Photo drop (image messages; a gallery view of all images)
- Artist Q&A: question cards with upvotes, and artist answers are highlighted
- "Get first access to the next gig" opt-in (fan list counter, the business proof)
- One-tap feedback (1–5 + optional quote) for traction evidence

### Crew side
- **Crew console** (`/e/[slug]/crew`): incident queue (New, Checking, Verified, Resolved) beside the venue map with live condition badges.
- **Incident room**: a Nexconn group channel per incident, with the reporter, crew and leads. A header shows the place, category, status and photo. Structured action buttons: Acknowledge · On it · Resolved.
- **AI "Draft update"** button (crew): reads the room messages and incident, then posts a **Proposal card** into the incident room, e.g. *"Bar 2: Out of stock → send people to Bar 1. Audience notice: 'Bar 2 is out of stock — Bar 1 by the merch stand is serving.' Expires in 60 min."* The crew can edit it.
- **Lead taps Approve** on the card. The server checks the role, writes the condition and the audit record, then sends an **Announcement** custom message into the gig room. Every attendee's banner and map badge update without a refresh. The incident timeline records who approved and when.
- A reporter's own incident shows attendee-friendly states: Report received, Crew is checking, Sorted.

### Golden demo path (≈3 min)
1. Phone A joins by QR, in the Live phase. The room is busy: song requests are being voted up, and the stage screen reorders live.
2. Phone A: Tell the crew, "Problem at a place", Bar 2, "no water left".
3. Laptop (crew) sees the incident and its room opens. Crew chat with the reporter: "checking".
4. Crew taps Draft update. The AI proposal card appears in the chat.
5. Lead approves inside the chat. Phone A's map marks Bar 2 "Out of stock — use Bar 1" with a timestamp and "verified by Lead", and the gig room banner appears.
6. Switch to the After phase: fan channel, photo drop, opt-in counter, stats page with real users from the test session.

## 5. Approaches considered
1. **Audience-room-centred, crew loop as the wow (chosen).** Real users come from the audience side, and the crew loop provides the innovation. Trade-off: the crew side is thinner than the blueprint.
2. **Blueprint venue-ops product (lift outage, step-free routing).** Strongest "state changes" story, but few real users (only staff), heavy (map studio, routing), and no gig before the deadline makes it moot. Rejected.
3. **Gig room only (no crew side).** Fastest, but it looks like the "spectator chat" entries other teams will build. It loses the innovation edge. Rejected.

## 6. Technical design (my calls)
- **App:** Next.js 15 (App Router) + TypeScript + Tailwind, one deployable on **Vercel**. Mobile-first PWA manifest.
- **Chat:** `@nexconn/engine` + `@nexconn/chat` Web SDK on the client with **our own chat UI**. The prebuilt Chat UI is web components and its custom-message rendering is undocumented; we need cards.
- **Nexconn server API** (Next.js route handlers only; the App Secret never leaves the server): signature = SHA1(AppSecret + Nonce + Timestamp), base URL by region (Singapore `api.sg-light-api.com`, with `api-b.` as backup).
  - `POST /v4/auth/access-token/issue` → token per user
  - `POST /v4/group-channel/create` → gig room, incident rooms, crew room (channelId alphanumeric ≤64)
  - `POST /v4/group-channel/join` → server adds users after its own permission check
  - `POST /v4/group-channel/message/send` → server posts system/state cards (custom `messageType`)
- **Custom message types** (registered on the client before `connect`), prefix `BS:`: `BS:Poll`, `BS:SongReq`, `BS:Meetup`, `BS:Carpool`, `BS:Question`, `BS:Incident`, `BS:Proposal`, `BS:Announce`, `BS:State` (non-persisted signal: "refetch X").
- **Source of truth:** Postgres (Supabase), accessed only from the server with the service key. Nexconn is the transport. Votes, conditions, incidents and approvals are written via API, then the server sends a `BS:State`/`BS:Announce` message so every client refetches. **All live updates travel over Nexconn** (no second realtime system).
- **Storage:** Nexconn media messages for chat photos. Incident photos also go through a Nexconn image message in the incident room.
- **AI:** Gemini (free tier) via a small `ai.ts` adapter with JSON output, used for: (a) Draft update proposals, (b) category suggestion on reports. It only reads the incident and room messages; it never writes state.
- **Venue:** `seed/venue.json` (places with x/y on an SVG of a gig venue: Stage, Barrier, Bar 1, Bar 2, Merch, Toilets, Entry, Side exit, First aid, Water point) + an SVG floor illustration.
- **Data model (tables):** `events`, `users`, `memberships(event,user,role)`, `channels(context_type, context_id, nexconn_channel_id)`, `places`, `conditions(place, status, notice, approved_by, approved_at, expires_at)`, `incidents`, `incident_updates` (audit), `proposals`, `cards(id, type, event, payload)`, `card_votes`, `fan_optins`, `feedback`.
- **Stats page** `/e/[slug]/stats` (lead only): joined users, users who sent ≥1 message (from the webhook or client-reported sends), rooms with activity, incidents and time-to-verified, fan opt-ins, feedback quotes. Used for the traction evidence.

## 7. Constraints & dependencies
- **Needs from you (blocking):** a Nexconn account + app (choose the **Singapore** data centre) → App Key + App Secret. Plus a Supabase project, a Gemini API key, a Vercel account and a GitHub repo. Only you can create these accounts.
- Repo must be public at submission. Secrets live only in Vercel env vars.
- No gig before the deadline, so the **test session** is a smaller Raahe event (listening session or friends' meetup) on **Sat 21 Nov evening**, running the Live and After phases for real.

## 8. Schedule
| When | Exit criterion |
|---|---|
| Thu 19 Nov | Repo, scaffold, Nexconn token + server signing, two browser sessions exchange a real message in a real group channel. |
| Fri 20 Nov | Join flow, gig room chat UI, cards (poll, song queue, going-solo), stage screen, phases, deployed on Vercel. |
| Sat 21 Nov AM | Crew loop: report → incident room → AI proposal → lead approve → map + banner update. Fan channel + feedback + stats. |
| Sat 21 Nov PM | **Real-user test session.** Collect stats screenshots + quotes. |
| Sun 22 Nov | Fix what testers hit, polish, record demo video, write-up PDF, submit by 8 PM IST. |

## 9. Left to the builder
Visual style (dark, stage-lit, high-contrast, big tap targets), exact copy, card layouts, the SVG venue illustration, and error/empty/loading states (all required: no dead controls).

## 10. Risks
| Risk | Mitigation |
|---|---|
| Nexconn SDK quirks (SSR, custom msgs) | Prove send/receive day 1; load the SDK client-only (dynamic import). |
| Testers don't post | Seed the room with a lead-run poll and song-request prompt; the host announces "request a song in Backstage". |
| Gemini rate limits | Only two AI calls in the product, both user-triggered; fall back to a template proposal. |
| Name clash ("Backstage" = Spotify dev portal) | Fine for the hackathon; use "Backstage by Raahe" in the write-up. |
