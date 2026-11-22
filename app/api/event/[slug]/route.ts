import { requireMember } from '@/lib/server/auth';
import { roomPreview, staffRoles, fanSummary, getChannel, listCards, listConditions, listIncidents, listPlaces, publicEvent } from '@/lib/server/db';
import { errorResponse } from '@/lib/server/http';
import { phaseOf } from '@/lib/shared/phase';
import { isStaff } from '@/lib/server/rooms';

/** Run next to the Supabase database (Sydney): every request makes several DB round trips. */
export const preferredRegion = 'syd1';

export async function GET(_req: Request, ctx: RouteContext<'/api/event/[slug]'>) {
  try {
    const { slug } = await ctx.params;
    const c = await requireMember(slug);
    const [places, conditions, cards, gig, crew, myIncidents, fan, roles, room] = await Promise.all([
      listPlaces(c.ev.id), listConditions(c.ev.id), listCards(c.ev.id),
      getChannel('gig', c.ev.id), isStaff(c.role) ? getChannel('crew', c.ev.id) : Promise.resolve(null),
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
