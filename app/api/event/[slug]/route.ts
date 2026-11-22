import { requireMember } from '@/lib/server/auth';
import { roomPreview, staffRoles, fanSummary, getChannel, listCards, listConditions, listIncidents, listPlaces, publicEvent } from '@/lib/server/db';
import { errorResponse } from '@/lib/server/http';
import { phaseOf } from '@/lib/shared/phase';
import { ensureChannel, isStaff } from '@/lib/server/rooms';
import { getMembership } from '@/lib/server/crew';
import { joinGroup } from '@/lib/server/nexconn';

/** Run next to the Supabase database (Sydney): every request makes several DB round trips. */
export const preferredRegion = 'syd1';

export async function GET(_req: Request, ctx: RouteContext<'/api/event/[slug]'>) {
  try {
    const { slug } = await ctx.params;
    const c = await requireMember(slug);
    const [places, conditions, cards, gig, crew, myIncidents, fan, roles, room] = await Promise.all([
      listPlaces(c.ev.id), listConditions(c.ev.id), listCards(c.ev.id),
      audienceRoomFor(c.ev.id, c.ev.title, c.userId, c.role), isStaff(c.role) ? getChannel('crew', c.ev.id) : Promise.resolve(null),
      listIncidents(c.ev.id, c.userId), fanSummary(c.ev.id, c.userId), staffRoles(c.ev.id), roomPreview(c.ev.id),
    ]);
    const phase = phaseOf(new Date(), new Date(c.ev.startsAt), new Date(c.ev.endsAt), c.ev.phaseOverride);
    return Response.json({
      event: publicEvent(c.ev), phase, places, conditions, cards, myIncidents, fan, roles, room,
      me: { userId: c.userId, name: c.name, role: c.role },
      channels: { gig, crew },
      serverTime: new Date().toISOString(),
    });
  } catch (e) {
    return errorResponse(e);
  }
}

/**
 * The audience room's Nexconn channel, with this person in it.
 * Only people who came through "Join the room" (/api/join) were ever added. Organisers who created the
 * event, crew who entered with a code and read-only viewers were not, so their chat stayed on
 * "Connecting to the room…". Create the room if it doesn't exist yet and add anyone who skipped that path.
 */
async function audienceRoomFor(eventId: string, title: string, userId: string, role: string) {
  const existing = await getChannel('gig', eventId);
  const channelId = existing ?? (await ensureChannel('gig', eventId, title, userId));
  // Plain audience members were joined by /api/join; everyone else is joined here (idempotent).
  const joinedByJoinFlow = existing && role === 'attendee' && (await getMembership(eventId, userId))?.team == null;
  if (!joinedByJoinFlow) await joinGroup(channelId, [userId]);
  return channelId;
}
