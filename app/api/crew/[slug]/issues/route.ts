import { z } from 'zod';
import { assertTeamAccess, requireCrew } from '@/lib/server/crewAuth';
import { raiseIssue } from '@/lib/server/issues';
import { errorResponse, HttpError } from '@/lib/server/http';
import { TEAM_IDS, type TeamId } from '@/lib/shared/teams';

/** Run next to the Supabase database (Sydney): every request makes several DB round trips. */
export const preferredRegion = 'syd1';

const input = z.object({
  team: z.enum(TEAM_IDS as [TeamId, ...TeamId[]]),
  title: z.string().trim().min(2, 'Say what the problem is').max(80, 'Keep the title under 80 characters'),
  note: z.string().trim().max(400).default(''),
  severity: z.enum(['normal', 'urgent', 'critical']).default('normal'),
  placeId: z.string().max(40).nullable().default(null),
});

/** Raise an issue in a team room. It lands as a card in that room and on everyone's alerts + map. */
export async function POST(req: Request, ctx: RouteContext<'/api/crew/[slug]/issues'>) {
  try {
    const { slug } = await ctx.params;
    const p = input.safeParse(await req.json().catch(() => ({})));
    if (!p.success) throw new HttpError(400, p.error.issues[0].message);
    const c = await requireCrew(slug, { write: true });
    assertTeamAccess(c, p.data.team);
    // Saved first; card delivery is best-effort so a Nexconn hiccup never causes a duplicate retry.
    return Response.json(await raiseIssue(c.ev, { ...p.data, reporterId: c.userId, reporterName: c.name }));
  } catch (e) {
    return errorResponse(e);
  }
}
