import { requireMember } from '@/lib/server/auth';
import { addOptin, upsertFeedback } from '@/lib/server/db';
import { errorResponse, HttpError } from '@/lib/server/http';
import { fanInput } from '@/lib/shared/fan';

/** Run next to the Supabase database (Sydney): every request makes several DB round trips. */
export const preferredRegion = 'syd1';

export async function POST(req: Request) {
  try {
    const p = fanInput.safeParse(await req.json().catch(() => ({})));
    if (!p.success) throw new HttpError(400, 'Pick a rating from 1 to 5.');
    const c = await requireMember(p.data.slug);
    if (p.data.action === 'optin') await addOptin(c.ev.id, c.userId);
    else await upsertFeedback(c.ev.id, c.userId, p.data.rating, p.data.quote);
    return Response.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
