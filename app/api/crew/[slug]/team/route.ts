import { z } from 'zod';
import { requireCrew } from '@/lib/server/crewAuth';
import { joinTeamChannels, setTeam } from '@/lib/server/crew';
import { errorResponse, HttpError } from '@/lib/server/http';
import { signal } from '@/lib/server/broadcast';
import { TEAM_IDS, channelsFor, type TeamId } from '@/lib/shared/teams';

const input = z.object({ team: z.enum(TEAM_IDS as [TeamId, ...TeamId[]]) });

/** Pick (or change) your team, then join Control + your team's channel (leads join every channel). */
export async function POST(req: Request, ctx: RouteContext<'/api/crew/[slug]/team'>) {
  try {
    const { slug } = await ctx.params;
    const p = input.safeParse(await req.json().catch(() => ({})));
    if (!p.success) throw new HttpError(400, 'Pick a team');
    const c = await requireCrew(slug);
    await setTeam(c.ev.id, c.userId, p.data.team);
    const channels = await joinTeamChannels(c.ev.id, c.ev.title, c.userId, c.role, p.data.team);
    if (channels.control) await signal(channels.control, { kind: 'crew' });
    return Response.json({ team: p.data.team, canOpen: channelsFor(c.role, p.data.team), channels });
  } catch (e) {
    return errorResponse(e);
  }
}
