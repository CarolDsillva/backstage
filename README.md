# Backstage

**The walkie-talkie and command centre for everyone working a live show.** Every team at a concert (artist team, production, hospitality, security, runners, stalls, front of house, medical) gets its own channel. The show caller hears them all. Problems raised in any room land on one live map, and the audience still has its own room for the night.

Built for the Nexconn Build Challenge 2026 with the **Nexconn Chat SDK**, the **Nexconn Chat UI kit** and the **Nexconn Call SDK**.

## Try it

Open the app. The home screen lists the events, with **Create event** at the top.

| Event | How to get in | What you see |
|---|---|---|
| **Sundown Sessions** (interactive demo) | No entry code required. Pick a role: Event manager, Security lead or Runner. | An event that is already running. Ten scripted demo crew members (labelled as a demo) keep posting real messages, issues, fixes and walkie clips through the Nexconn server API every ~20 s. As event manager you get a hands-on tour: a spotlight shows what to tap and waits for you to do it. You take a critical issue, message Security (they answer on the walkie), call the whole Security team (they call you back), key the walkie, check the map, then close the task in Tasks. |
| **Mic Drop** (Raahe's open mic at a café in Bangalore) | Viewer code `micdrop-watch` (read-only) or a crew/lead code. | A staged show night run by Smera, RJ, Shashi, Vaibhav, Niharika and Divyansh: sign-ups over capacity, a crackling mic, the coffee machine tripping the power, the crowd spilling onto the footpath, end-of-night walkie clips. **This is seeded demo data, not real usage.** It was sent through the real Nexconn server API by `scripts/seed-events.ts` and `scripts/seed-clips.ts`. The voice clips are Microsoft neural text-to-speech stand-ins made by `scripts/make-voices.py`. |
| **Raahe Unplugged** | Not open yet. | Listed as an upcoming event. |
| **Your own event** | Create event → name, venue, time, which teams. | You become its event manager and get a crew code (can talk), a viewer code (read-only), a link and a QR code to share. Only the teams you picked get channels. |

## Crew side (`/e/<slug>/crew`)

| Tab | What it does |
|---|---|
| **Alerts** | The event as an orb with every team orbiting it; teams with open issues light up. Open / critical / fixed counts, the latest all-hands call, every open issue with **I’m on it** / **Fixed** (compare-and-set, so two people can’t both take it), and a feed of everything happening across the event. Turn on browser alerts for critical issues. |
| **Tasks** | Every open task and who is working on what: “Need someone”, “Who’s on what” grouped by person, and “Done tonight”. Filter to just yours; take or close a task in one tap. |
| **Chats** | A messenger: one chat per team (Control, Artist, Production, Hospitality, Security, Runners, Stalls, FOH, Medical) with last message, unread count and a red dot when a critical issue is open. In a chat: text, photos, hold-the-mic voice clips, and **Raise issue** from the + menu. Viewers can read but not post. A “Classic inbox” entry opens the ready-made Nexconn Chat UI kit. |
| **Walkie** | A walkie-talkie: LCD screen, channel knob, big **push to talk**. Each transmission is a Nexconn HD voice message on that team’s channel, so it is also in the chat history; with the speaker on, new transmissions play out loud and the screen shows who is talking. **Open line** starts a live group audio call (Call SDK). |
| **Map** | The venue with every open issue pinned where it is; tap a spot to see its issues or raise one there. |
| **+** | Raise an issue: team, one-tap starters, severity, place. Critical issues are echoed to Control. |

**Voice call (delayed call):** the green phone in a team chat calls the whole team. Hold, speak, let go: your voice goes out as an HD voice message marked as a call, and every phone on the channel rings and plays it out loud (with Replay and Call back). It works without paid call minutes. Live calls on the Call SDK are wired up but switched off on our Nexconn account.

In-app toasts show new messages from other channels, issues beep (two tones for critical), and walkie transmissions play with a squelch chirp.

## Audience side (`/e/<slug>`)

The original gig room is unchanged: going-solo meetups, ride shares, song requests and polls, "Tell the crew" reports (now listed at `/e/<slug>/crew/reports`), and the after-show fan club.

## How Nexconn is used

- **Chat SDK (messages, channels, history):** one group channel per team, plus the gig, crew and per-report rooms; text, image and **HD voice** messages; message history; custom message types `BS:Issue`, `BS:IssueUpd`, `BS:Radio`, `BS:Announce` (and the audience cards), plus the non-persisted `BS:State` signal that refreshes HQ live. Cards are only rendered when the system user sent them (forged cards from devtools are ignored).
- **Server API:** token issuance, group create/join and server-sent cards (SHA1 signing, Singapore primary/backup failover).
- **Chat UI kit (`@nexconn/chatui`):** the Classic inbox. Initialised and `ready()` before connect, with our user/group names supplied through `ServiceHooks` and a custom element for Backstage cards.
- **Call SDK (`@nexconn/call`):** installed before the engine starts and initialised on every crew device. A live “open line” per team is implemented (below), but audio/video calls cost paid minutes, so they are switched off on our account and the app uses the voice-call messages above instead. Design: team radio = a multi-party **audio** call per channel. Mics are muted by default (`enableMicrophone(false)`) and opened only while you hold the button; `onRemoteMicrophoneStateChanged` shows who is talking; late joiners `joinCall(callId)` using the call id the server stores in `radio_sessions`.

**Why viewers sign in as pre-joined accounts:** Nexconn only shows a group’s history from the moment a member joined. So the seed script puts 40 read-only viewer accounts in every Mic Drop channel *before* replaying the night, and the viewer code signs you in as one of them.

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
5. Set `CREW_CODE`, `LEAD_CODE`, `ARTIST_CODE` and `VIEWER_CODE` in `.env.local`, then run `npx tsx --env-file=.env.local scripts/seed-events.ts` (creates Demo Fest and Mic Drop, enrols the crews and replays the night). After deploying, `npx tsx --env-file=.env.local scripts/seed-clips.ts https://<your-domain>` posts the walkie clips.
6. `npm run dev`, then open `/`.

## Tests

`npm test` runs 88 unit tests: request signing, join/role rules, channel access per team, forged-card filtering, votes, phases, conditions, incident permissions, AI fallback and lead approval.

## Stack

Next.js 16 · TypeScript · Tailwind 4 · Nexconn Chat SDK, Chat UI kit and Call SDK · Supabase Postgres · Gemini · Vercel.
