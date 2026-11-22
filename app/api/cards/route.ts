import { z } from 'zod';
import { requireMember } from '@/lib/server/auth';
import { getChannel, insertCard } from '@/lib/server/db';
import { errorResponse, HttpError } from '@/lib/server/http';
import { canCreate, cardInput, CARD_TITLE } from '@/lib/shared/cards';
import { phaseOf } from '@/lib/shared/phase';
import { CARD_MESSAGE_TYPE } from '@/lib/shared/types';
import { newId } from '@/lib/server/ids';
import { post, signal } from '@/lib/server/broadcast';

/** Run next to the Supabase database (Sydney): every request makes several DB round trips. */
export const preferredRegion = 'syd1';

const body = z.object({ slug: z.string() }).and(cardInput);

export async function POST(req: Request) {
  try {
    const parsed = body.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) throw new HttpError(400, 'Fill in every field before posting.');
    const { slug, type, payload } = parsed.data;
    const c = await requireMember(slug);
    const phase = phaseOf(new Date(), new Date(c.ev.startsAt), new Date(c.ev.endsAt), c.ev.phaseOverride);
    if (!canCreate(type, c.role, phase)) throw new HttpError(403, `${CARD_TITLE[type]} isn’t open right now.`);

    const id = newId('card');
    await insertCard({ id, eventId: c.ev.id, type, authorId: c.userId, payload });
    const gig = await getChannel('gig', c.ev.id);
    if (gig) {
      // The card itself is a persisted Nexconn custom message; live tallies come from the DB.
      await post(gig, CARD_MESSAGE_TYPE[type], { cardId: id, type, payload, authorName: c.name },
        `${c.name}: ${CARD_TITLE[type]}`);
      await signal(gig, { kind: 'card', id }); // every phone refetches so the card has data to render
    }
    return Response.json({ id });
  } catch (e) {
    return errorResponse(e);
  }
}
