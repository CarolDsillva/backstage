import { z } from 'zod';
import { assertTeamAccess, requireCrew } from '@/lib/server/crewAuth';
import { ensureTeamChannel, getIssue, updateIssue } from '@/lib/server/crew';
import { errorResponse, HttpError } from '@/lib/server/http';
import { post, signal } from '@/lib/server/broadcast';
import { BS_TYPES } from '@/lib/shared/types';
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
    const c = await requireCrew(slug);
    const issue = await getIssue(id);
    if (!issue || issue.eventId !== c.ev.id || !isTeam(issue.team)) throw new HttpError(404, 'Issue not found');
    assertTeamAccess(c, issue.team);

    const to = p.data.action === 'take' ? 'checking' : p.data.action === 'fix' ? 'resolved' : 'new';
    if (issue.status === to) return Response.json({ ok: true, unchanged: true });
    const assignee = p.data.action === 'reopen' ? null : c.userId;
    const ok = await updateIssue(id, issue.status, to, p.data.action === 'fix' ? issue.assigneeId ?? c.userId : assignee);
    if (!ok) throw new HttpError(409, 'Someone else just updated this. Pull to refresh.');

    const control = await ensureTeamChannel(c.ev.id, c.ev.title, 'control');
    // Saved already; the card is best-effort so a Nexconn hiccup never reports a failed update.
    await post(issue.channelId, BS_TYPES.issueUpdate, {
      issueId: id, team: issue.team, title: issue.title ?? issue.note, action: p.data.action, by: c.name, status: to,
    }).catch((e) => console.error('issue update card not delivered', id, e));
    await signal(control, { kind: 'crew', id });
    return Response.json({ ok: true, status: to });
  } catch (e) {
    return errorResponse(e);
  }
}
