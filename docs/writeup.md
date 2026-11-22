# Backstage: project write-up

**Nexconn Build Challenge 2026 · Team: Fire Exir**
**Live app:** _https://backstage-two-weld.vercel.app/_ · **Source:** _https://github.com/CarolDsillva/backstage_ · **Demo video:** _https://youtu.be/iqPTfotv9OU_
**Nexconn App Key:** _ik1qhw09iruep_

## Why we built it

We run gigs under the name(company) Raahe. On a gig night, conversation is scattered across tools. Before the show, people who come alone have no way to find each other, and rides are arranged in five different WhatsApp groups. During the show, a lost phone or a dry bar gets shouted at whichever volunteer is nearest, the crew discusses it in yet another group, and the audience never hears the answer. After the encore, the audience scatters, and the artist loses them to the algorithm.

Backstage gives every gig one room for its whole life, and connects that room to the crew.

## The problems it solves

1. **No front door for the audience.** One QR code puts everyone in the gig room in under 30 seconds: a name, no password, no app install.
2. **Reports get lost.** Every report opens its own private Nexconn room with the reporter and the crew, so nobody has to repeat the story.
3. **The audience never hears the fix, or hears rumours.** A drafted update is published only after a lead approves it inside the chat. Then the map and every phone in the gig room update live, with who confirmed it and when. Updates expire and show "needs reconfirmation" instead of going stale silently.
4. **The audience disappears after the show.** The room turns into the artist's fan club: early access opt-in, photos, Q&A.

## Features that use the Nexconn SDK

| Feature | Nexconn capability |
|---|---|
| Gig room, crew room, private report rooms | Group channels, created and joined from our server after role checks |
| Join in under 30 seconds | Server API access-token issuance; Web SDK connect with automatic token refresh |
| Polls, song requests, going-solo meetups, ride shares, artist Q&A | Custom message types (`BS:Poll`, `BS:SongReq`, `BS:Meetup`, `BS:Carpool`, `BS:Question`) rendered as interactive cards |
| Report card, drafted update, published notice | Custom messages `BS:Incident`, `BS:Proposal`, `BS:Announce`, sent from the server API |
| Live votes, map changes and phase changes on every screen | Non-persisted `BS:State` custom message as a real-time signal; no second real-time system |
| Photo drop and photo wall | Image messages + message history |
| Stage screen song queue | Live group-channel signals driving a projector view |

## Innovation

- **The conversation changes the venue, but only with approval.** AI (Gemini) drafts the audience-facing update from the crew's chat. It appears as a card inside the incident room, and only a lead's tap publishes it. The audit trail records who drafted, who approved and when.
- **A room with a life cycle.** Before, Live and After phases change what the room offers, from meetups to song voting to the fan club.

## Business

- **Who pays:** promoters and venues, per event, for the crew loop and the stats. Artists later pay for a fan-club tier.
- **Growth loop:** going-solo meetups and ride shares only work if friends join, so each attendee recruits more people. Each gig adds another room full of real users, and the fan club carries them to the next gig.

## Traction

_[Fill after the test session: people who joined, people who chatted (stats page screenshot), Nexconn console active users, rooms with activity, reports and median minutes to crew action, fan-club opt-ins, average rating, 3–5 quotes.]_

## What's next

Ticket-linked access, multiple events per organiser, venue templates, push notifications, and translated chat for touring artists.
