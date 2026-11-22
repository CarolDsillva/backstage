import { requireCrew } from '@/lib/server/crewAuth';
import { listConditions, listPlaces, publicEvent } from '@/lib/server/db';
import { listCrew, listIssues, listRadio, teamChannelIds } from '@/lib/server/crew';
import { errorResponse } from '@/lib/server/http';
import { phaseOf } from '@/lib/shared/phase';

/**
 * Crew bootstrap: everything the HQ, channels and team rooms need, in ONE request.
 * All queries run in parallel, so the screen costs a single round trip to the database.
 */
export async function GET(_req: Request, ctx: RouteContext<'/api/crew/[slug]'>) {
  try {
    const { slug } = await ctx.params;
    const c = await requireCrew(slug);
    const [places, conditions, issues, crew, radio, channels] = await Promise.all([
      listPlaces(c.ev.id), listConditions(c.ev.id), listIssues(c.ev.id), listCrew(c.ev.id), listRadio(c.ev.id), teamChannelIds(c.ev.id),
    ]);
    const open = Object.fromEntries(Object.entries(channels).filter(([t]) => (c.canOpen as string[]).includes(t)));
    return Response.json({
      event: publicEvent(c.ev),
      phase: phaseOf(new Date(), new Date(c.ev.startsAt), new Date(c.ev.endsAt), c.ev.phaseOverride),
      me: { userId: c.userId, name: c.name, role: c.role, team: c.team },
      canOpen: c.canOpen,
      channels: open,
      places, conditions, issues, crew, radio,
      serverTime: new Date().toISOString(),
    }, { headers: { 'cache-control': 'no-store' } });
  } catch (e) {
    return errorResponse(e);
  }
}
