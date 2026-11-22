import { z } from 'zod';
import { requireMember } from '@/lib/server/auth';
import { getCard, getChannel, updateCardPayload } from '@/lib/server/db';
import { errorResponse, HttpError } from '@/lib/server/http';
import { rolesFor } from '@/lib/shared/permissions';
import { signal } from '@/lib/server/broadcast';

/** Run next to the Supabase database (Sydney): every request makes several DB round trips. */
export const preferredRegion = 'syd1';

const body = z.object({ slug: z.string(), text: z.string().trim().min(1).max(500) });

export async function POST(req: Request, ctx: RouteContext<'/api/cards/[id]/answer'>) {
  try {
    const { id } = await ctx.params;
    const p = body.safeParse(await req.json().catch(() => ({})));
    if (!p.success) throw new HttpError(400, 'Write an answer first.');
    const c = await requireMember(p.data.slug, rolesFor('answerQuestion'));
    const card = await getCard(id);
    if (!card || card.eventId !== c.ev.id || card.type !== 'question') throw new HttpError(404, 'Question not found');
    await updateCardPayload(id, { ...card.payload, answer: p.data.text, answeredBy: c.name });
    await signal(await getChannel('gig', c.ev.id), { kind: 'card', id });
    return Response.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
