import { z } from 'zod';
import { requireMember } from '@/lib/server/auth';
import { getChannel, setPhaseOverride } from '@/lib/server/db';
import { errorResponse, HttpError } from '@/lib/server/http';
import { rolesFor } from '@/lib/shared/permissions';
import { signal } from '@/lib/server/broadcast';

/** Run next to the Supabase database (Sydney): every request makes several DB round trips. */
export const preferredRegion = 'syd1';

const body = z.object({ phase: z.enum(['before', 'live', 'after']).nullable() });

export async function POST(req: Request, ctx: RouteContext<'/api/event/[slug]/phase'>) {
  try {
    const { slug } = await ctx.params;
    const c = await requireMember(slug, rolesFor('phase'));
    const p = body.safeParse(await req.json().catch(() => ({})));
    if (!p.success) throw new HttpError(400, 'Invalid phase');
    await setPhaseOverride(c.ev.id, p.data.phase);
    await signal(await getChannel('gig', c.ev.id), { kind: 'event' });
    return Response.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
