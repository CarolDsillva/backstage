import { z } from 'zod';
import { assertTeamAccess, requireCrew } from '@/lib/server/crewAuth';
import { clearRadio, ensureTeamChannel, listRadio, setRadio } from '@/lib/server/crew';
import { errorResponse, HttpError } from '@/lib/server/http';
import { post, signal } from '@/lib/server/broadcast';
import { BS_TYPES } from '@/lib/shared/types';
import { TEAM_IDS, team, type TeamId } from '@/lib/shared/teams';

const input = z.object({
  team: z.enum(TEAM_IDS as [TeamId, ...TeamId[]]),
  live: z.boolean(),
  callId: z.string().min(1).max(128).optional(),
});

/**
 * Records that a team's radio (a Nexconn group audio call started on the client with the Call SDK)
 * is on air, so people who open the channel later can join the same call by id.
 */
export async function POST(req: Request, ctx: RouteContext<'/api/crew/[slug]/radio'>) {
  try {
    const { slug } = await ctx.params;
    const p = input.safeParse(await req.json().catch(() => ({})));
    if (!p.success) throw new HttpError(400, 'Bad radio request');
    const c = await requireCrew(slug);
    assertTeamAccess(c, p.data.team);
    const channelId = await ensureTeamChannel(c.ev.id, c.ev.title, p.data.team);
    if (p.data.live) {
      if (!p.data.callId) throw new HttpError(400, 'Missing call id');
      const existing = (await listRadio(c.ev.id)).find((r) => r.team === p.data.team);
      if (existing && existing.callId !== p.data.callId) return Response.json({ callId: existing.callId, joinExisting: true });
      await setRadio(c.ev.id, p.data.team, p.data.callId, c.userId);
      await post(channelId, BS_TYPES.radio, { team: p.data.team, live: true, callId: p.data.callId, by: c.name },
        `📻 ${team(p.data.team).name} radio is live`);
    } else {
      await clearRadio(c.ev.id, p.data.team, p.data.callId);
      await post(channelId, BS_TYPES.radio, { team: p.data.team, live: false, by: c.name });
    }
    await signal(channelId, { kind: 'crew' });
    return Response.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
