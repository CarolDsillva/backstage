import { z } from 'zod';
import { requireMember } from '@/lib/server/auth';
import { addVote, getCard, getChannel, removeVote } from '@/lib/server/db';
import { errorResponse, HttpError } from '@/lib/server/http';
import { decideVote } from '@/lib/shared/cards';
import { signal } from '@/lib/server/broadcast';

/** Run next to the Supabase database (Sydney): every request makes several DB round trips. */
export const preferredRegion = 'syd1';

const body = z.object({ slug: z.string(), option: z.number().int().optional() });

export async function POST(req: Request, ctx: RouteContext<'/api/cards/[id]/vote'>) {
  try {
    const { id } = await ctx.params;
    const p = body.safeParse(await req.json().catch(() => ({})));
    if (!p.success) throw new HttpError(400, 'Invalid vote');
    const c = await requireMember(p.data.slug);
    const card = await getCard(id);
    if (!card || card.eventId !== c.ev.id) throw new HttpError(404, 'That card is gone.');

    const d = decideVote(card, c.userId, p.data.option);
    if ('error' in d) throw new HttpError(d.error, d.message);
    if (d.action === 'add') await addVote(id, c.userId, d.value);
    else await removeVote(id, c.userId);

    await signal(await getChannel('gig', c.ev.id), { kind: 'card', id });
    return Response.json({ ok: true, action: d.action });
  } catch (e) {
    return errorResponse(e);
  }
}
