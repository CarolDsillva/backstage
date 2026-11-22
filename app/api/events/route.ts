import crypto from 'node:crypto';
import { z } from 'zod';
import venue from '@/seed/venue.json';
import { currentUserId, setSessionCookie } from '@/lib/server/auth';
import { check, db, getUser, upsertUser } from '@/lib/server/db';
import { joinTeamChannels } from '@/lib/server/crew';
import { issueToken, joinGroup } from '@/lib/server/nexconn';
import { ensureChannel } from '@/lib/server/rooms';
import { errorResponse, HttpError } from '@/lib/server/http';
import { TEAM_IDS, type TeamId } from '@/lib/shared/teams';

export const preferredRegion = 'syd1';

const input = z.object({
  title: z.string().trim().min(3, 'Give the event a name (3+ characters)').max(48),
  venue: z.string().trim().min(2, 'Where is it?').max(64),
  city: z.string().trim().max(32).default(''),
  startsAt: z.string().datetime({ offset: true, message: 'Pick a date and time' }),
  hours: z.number().min(1).max(24).default(4),
  name: z.string().trim().min(1, 'Add your name').max(32),
  /** Who's performing. Optional: falls back to the event name (never the organiser's name). */
  artist: z.string().trim().max(48).default(''),
  teams: z.array(z.enum(TEAM_IDS as [TeamId, ...TeamId[]])).min(1, 'Pick at least one team').max(9),
});

const word = () => crypto.randomBytes(3).toString('hex');

/**
 * Create an event. The creator becomes its event manager (lead, on Control) and gets the codes
 * to invite crew (talk) and viewers (read-only). Team channels are Nexconn groups made on demand.
 */
export async function POST(req: Request) {
  try {
    const p = input.safeParse(await req.json().catch(() => ({})));
    if (!p.success) throw new HttpError(400, p.error.issues[0].message);
    const d = p.data;
    const start = new Date(d.startsAt);
    const end = new Date(start.getTime() + d.hours * 3_600_000);
    const base = d.title.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 32) || 'event';
    const slug = `${base}-${word().slice(0, 4)}`;
    const id = 'ev' + crypto.randomUUID().replace(/-/g, '').slice(0, 16);
    const teams = [...new Set<TeamId>(['control', ...d.teams])];
    const codes = { crew: `crew-${word()}`, lead: `lead-${word()}`, artist: `artist-${word()}`, viewer: `watch-${word()}` };

    check(await db().from('events').insert({
      id, slug, title: d.title, artist: d.artist || d.title, venue: d.city ? `${d.venue}, ${d.city}` : d.venue,
      starts_at: start.toISOString(), ends_at: end.toISOString(),
      crew_code: codes.crew, lead_code: codes.lead, artist_code: codes.artist,
      refs: { teams, viewerCode: codes.viewer, tagline: d.city || 'Your event', createdBy: d.name },
    }));
    // Default venue layout so the live map works from minute one.
    check(await db().from('places').insert(venue.places.map((pl) => ({ ...pl, event_id: id }))));

    const existing = await currentUserId();
    const known = existing ? await getUser(existing) : null;
    const userId = known?.id ?? 'u' + crypto.randomUUID().replace(/-/g, '').slice(0, 20);
    await upsertUser(userId, d.name);
    check(await db().from('memberships').upsert({ event_id: id, user_id: userId, role: 'lead', team: 'control' }));
    const [token] = await Promise.all([
      issueToken(userId, d.name),
      joinTeamChannels(id, d.title, userId, 'lead', 'control', teams),
      // The audience room too, so the organiser can talk to their audience from minute one.
      ensureChannel('gig', id, d.title, userId).then((gig) => joinGroup(gig, [userId])),
    ]);
    await setSessionCookie(userId);
    return Response.json({ slug, token, codes: { crew: codes.crew, viewer: codes.viewer } });
  } catch (e) {
    return errorResponse(e);
  }
}
