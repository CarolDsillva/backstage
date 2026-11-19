# Backstage

**One chat room for every gig.** It opens before the doors, runs the night, and stays open afterwards as the artist's fan club. When something goes wrong, the audience tells the crew, the crew sorts it out in a private room, and once a lead approves, the confirmed update reaches everyone's map and room live.

Built for the Nexconn Build Challenge 2026 with the **Nexconn Chat SDK**.

## What it does

| When | Audience | Crew |
|---|---|---|
| Before the show | Going-solo meetups, ride shares, setlist polls | |
| During the show | Song requests the crowd votes up (shown on a stage screen), "Tell the crew" | Private room per report, drafted audience update, lead approval |
| After the show | Fan club opt-in for the next gig, photo wall, artist Q&A, rating | Numbers for the night |

**The core loop:** an attendee reports "Bar 2 has no water" → Backstage opens a private Nexconn room with the reporter and the crew → the crew chats, then taps *Draft audience update* (Gemini drafts it from the conversation) → a **lead approves it inside the chat** → the map marks Bar 2, and every phone in the gig room gets the banner. Nothing the AI or a single attendee says changes what the audience sees without a lead's approval.

## How Nexconn is used

- **Group channels** for the gig room, the crew room, and one private room per report (created and joined from the server after role checks).
- **Server API**: access-token issuance, group creation and join, and server-sent messages (signed with SHA1(AppSecret+Nonce+Timestamp), with Singapore primary/backup failover).
- **9 custom message types**: `BS:Poll`, `BS:SongReq`, `BS:Meetup`, `BS:Carpool`, `BS:Question`, `BS:Incident`, `BS:Proposal`, `BS:Announce`, and the non-persisted `BS:State` signal. Every live update (votes, approvals, phase changes) travels over Nexconn.
- **Text and image messages** with message history.
- Connection status with automatic reconnect, fresh-token retry with backoff, and a one-tap "use it here" when another tab takes over.

## Run it

1. Create a Nexconn app (Singapore data centre), a Supabase project, and optionally a Gemini API key.
2. In the Supabase SQL editor, run `supabase/schema.sql`.
3. `cp .env.example .env.local` and fill it in.
4. `npm install`
5. `npx tsx --env-file=.env.local scripts/seed.ts 0` seeds the demo gig, starting now. Set the crew, lead and artist codes with `CREW_CODE`, `LEAD_CODE` and `ARTIST_CODE`.
6. `npm run dev`, then open `/e/raahe-live`.

Routes: `/e/<slug>` (the room), `/e/<slug>/screen` (the stage screen), `/e/<slug>/crew` (the crew console), and `/e/<slug>/stats` (the lead's numbers).

## Tests

`npm test` runs 66 unit tests covering request signing, join/role rules, votes, phases, conditions, incident permissions, AI fallback and lead approval.

## Stack

Next.js 16 · TypeScript · Tailwind 4 · Nexconn Web Chat SDK · Supabase Postgres · Gemini 2.5 Flash · Vercel.
