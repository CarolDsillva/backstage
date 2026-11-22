import { z } from 'zod';
import { requireCrew } from '@/lib/server/crewAuth';
import { ensureTeamChannel } from '@/lib/server/crew';
import { errorResponse, HttpError } from '@/lib/server/http';
import { post, signal } from '@/lib/server/broadcast';
import { BS_TYPES } from '@/lib/shared/types';

/** Run next to the Supabase database (Sydney): every request makes several DB round trips. */
export const preferredRegion = 'syd1';

const input = z.object({ text: z.string().trim().min(2).max(200) });

/** Show caller announcement to all hands (Control channel). Leads only. */
export async function POST(req: Request, ctx: RouteContext<'/api/crew/[slug]/announce'>) {
  try {
    const { slug } = await ctx.params;
    const p = input.safeParse(await req.json().catch(() => ({})));
    if (!p.success) throw new HttpError(400, 'Write the announcement (2–200 characters)');
    const c = await requireCrew(slug);
    if (c.role !== 'lead') throw new HttpError(403, 'Only the show caller can announce to all hands');
    const control = await ensureTeamChannel(c.ev.id, c.ev.title, 'control');
    await post(control, BS_TYPES.announce, { text: p.data.text, by: c.name, crew: true }, `📣 ${p.data.text}`);
    await signal(control, { kind: 'crew' });
    return Response.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
