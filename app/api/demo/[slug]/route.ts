import { z } from 'zod';
import { requireCrew } from '@/lib/server/crewAuth';
import { react, tick } from '@/lib/server/demo';
import { errorResponse, HttpError } from '@/lib/server/http';
import { TEAM_IDS, type TeamId } from '@/lib/shared/teams';

export const preferredRegion = 'syd1';

const input = z.object({
  action: z.enum(['tick', 'took', 'message', 'fixed', 'call']),
  team: z.enum(TEAM_IDS as [TeamId, ...TeamId[]]).default('control'),
});

/** Demo events only: keep the show busy (tick) and let the demo crew answer the walkthrough. */
export async function POST(req: Request, ctx: RouteContext<'/api/demo/[slug]'>) {
  try {
    const { slug } = await ctx.params;
    const p = input.safeParse(await req.json().catch(() => ({})));
    if (!p.success) throw new HttpError(400, 'Bad demo request');
    const c = await requireCrew(slug);
    if (!c.ev.refs?.demo) throw new HttpError(404, 'Not a demo event');
    // Clips are served from this deployment's public/clips.
    const host = req.headers.get('x-forwarded-host') ?? new URL(req.url).host;
    const origin = `${req.headers.get('x-forwarded-proto') ?? new URL(req.url).protocol.replace(':', '')}://${host}`;
    if (p.data.action === 'tick') return Response.json(await tick(c.ev, origin));
    await react(c.ev, p.data.action, p.data.team, origin);
    return Response.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
