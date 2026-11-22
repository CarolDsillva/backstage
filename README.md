# Backstage

**The walkie-talkie and command centre for everyone working a live show.** Every team at a concert (artist team, production, hospitality, security, runners, stalls, front of house, medical) gets its own channel. The show caller hears them all. Problems raised in any room land on one live map, and the audience still has its own room for the night.

Built for the Nexconn Build Challenge 2026 with the **Nexconn Chat SDK**, the **Nexconn Chat UI kit** and the **Nexconn Call SDK**.

## Crew side (`/e/<slug>/crew`)

| Screen | What it does |
|---|---|
| **HQ** | Event card with a show clock (doors in / live / wrapped) and open-issue, crew and live-radio counts; quick refs (run of show, who to call, gate/wifi/emergency notes); show-caller announcements to all hands; a **live map** where every open issue is a pin coloured by team; a **live feed** of issues, fixes, radio calls and announcements from every room you hear. |
| **Channels** | The walkie dial: CH01 Control to CH09 Medical, each with unread count, open issues and an ON AIR light. Crew hear Control + their own team; the show caller hears everything. |
| **Team room** | Chat with issue cards and an issue strip (**On it** / **Fixed**, compare-and-set so two people can't both take it). A big **hold-to-talk** button: when the channel's radio is live it opens your mic on the group audio call; off air, holding it records a voice clip that drops into the chat (and plays out loud for anyone with *Radio on*). **Raise issue** with one-tap starters per team, severity and place. Critical issues are also called on Control. |
| **Inbox** | Every channel and message in one place, using the ready-made **Nexconn Chat UI kit**, with Backstage cards rendered inside it. |
| **First-time demo** | "The night heats up": team passes fanning in, issues popping onto the map as the clock runs and a heat meter climbs, a walkie keying up, an issue going Open → On it → Fixed. Replay it from the ▶ button. |

## Audience side (`/e/<slug>`)

The original gig room is unchanged: going-solo meetups, ride shares, song requests and polls, "Tell the crew" reports (now listed at `/e/<slug>/crew/reports`), and the after-show fan club.

## How Nexconn is used

- **Chat SDK (messages, channels, history):** one group channel per team, plus the gig, crew and per-report rooms; text, image and **HD voice** messages; message history; custom message types `BS:Issue`, `BS:IssueUpd`, `BS:Radio`, `BS:Announce` (and the audience cards), plus the non-persisted `BS:State` signal that refreshes HQ live. Cards are only rendered when the system user sent them (forged cards from devtools are ignored).
- **Server API:** token issuance, group create/join and server-sent cards (SHA1 signing, Singapore primary/backup failover).
- **Chat UI kit (`@nexconn/chatui`):** the Inbox. Initialised and `ready()` before connect, with our user/group names supplied through `ServiceHooks` and a custom element for Backstage cards.
- **Call SDK (`@nexconn/call`):** team radio = a multi-party **audio** call per channel. Mics are muted by default (`enableMicrophone(false)`) and opened only while you hold the button; `onRemoteMicrophoneStateChanged` shows who is talking; late joiners `joinCall(callId)` using the call id the server stores in `radio_sessions`.

## Verified vs not yet verified (22 Nov 2026)

Tested live with two separate sessions (show caller on `localhost`, a Security crew member on `127.0.0.1`, separate cookies):

- ✅ A critical issue raised by Security appeared on the show caller's HQ (feed, map hot spot, critical count) without a reload.
- ✅ Text sent in the Security room reached the other session in under 3 s; history reloads after a refresh.
- ✅ A hold-to-talk voice clip (HD voice) reached the other session and played.
- ✅ "Fixed" updated the issue for both and posted the update card.
- ✅ The Chat UI kit inbox lists channels with live previews and shows history, including our custom cards (in a **production build**; see below).
- ❌ **Live radio (Call SDK) is not working yet:** `startCall` returns `80006 VOIP_SERVICE_UNAVAILABLE`. Audio/video calls must be enabled for the app in the Nexconn console. The code path is written against the SDK's published types but has not carried audio yet.
- ⚠️ In `next dev` only, the Chat UI kit's message pane fails (`_$initialize is not a function`): the kit ships production-mangled `lit` internals, and Next dev loads lit's development build. `next build` / production is fine.
- ⚠️ `@nexconn/call` pins `@nexconn/chat` 26.2.0 while `@nexconn/chatui` needs 26.5.x, so `.npmrc` sets `legacy-peer-deps=true`.

## Run it

1. Create a Nexconn app (Singapore data centre), a Supabase project, and optionally a Gemini API key.
2. In the Supabase SQL editor, run `supabase/schema.sql`, then `supabase/2026-11-22-crew-comms.sql`.
3. `cp .env.example .env.local` and fill it in.
4. `npm install`
5. `npx tsx --env-file=.env.local scripts/seed.ts 0` seeds the demo gig. Set the crew, lead and artist codes with `CREW_CODE`, `LEAD_CODE` and `ARTIST_CODE`.
6. `npm run dev`, then open `/e/raahe-live/crew` (crew) or `/e/raahe-live` (audience).

## Tests

`npm test` runs 88 unit tests: request signing, join/role rules, channel access per team, forged-card filtering, votes, phases, conditions, incident permissions, AI fallback and lead approval.

## Stack

Next.js 16 · TypeScript · Tailwind 4 · Nexconn Chat SDK, Chat UI kit and Call SDK · Supabase Postgres · Gemini · Vercel.
