import { z } from 'zod';
import { assertTeamAccess, requireCrew } from '@/lib/server/crewAuth';
import { actOnIssue, getIssue } from '@/lib/server/issues';
import { errorResponse, HttpError } from '@/lib/server/http';
import { isTeam } from '@/lib/shared/teams';

/** Run next to the Supabase database (Sydney): every request makes several DB round trips. */
export const preferredRegion = 'syd1';

const input = z.object({ action: z.enum(['take', 'fix', 'reopen']) });

/** "On it" (take), "Fixed" (fix) or reopen. Compare-and-set, so double taps can't both win. */
export async function PATCH(req: Request, ctx: RouteContext<'/api/crew/[slug]/issues/[id]'>) {
  try {
    const { slug, id } = await ctx.params;
    const p = input.safeParse(await req.json().catch(() => ({})));
    if (!p.success) throw new HttpError(400, 'Unknown action');
    const c = await requireCrew(slug, { write: true });
    const issue = await getIssue(id);
    if (!issue || issue.eventId !== c.ev.id || !isTeam(issue.team)) throw new HttpError(404, 'Issue not found');
    assertTeamAccess(c, issue.team);
    const r = await actOnIssue(c.ev, issue, p.data.action, { userId: c.userId, name: c.name });
    if (!r) throw new HttpError(409, 'Someone else just updated this.');
    return Response.json({ ok: true, ...r });
  } catch (e) {
    return errorResponse(e);
  }
}
