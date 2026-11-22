import { z } from 'zod';
import { requireMember } from '@/lib/server/auth';
import { bumpActivity } from '@/lib/server/db';
import { errorResponse, HttpError } from '@/lib/server/http';

/** Run next to the Supabase database (Sydney): every request makes several DB round trips. */
export const preferredRegion = 'syd1';

const body = z.object({ slug: z.string(), n: z.number().int().min(1).max(200) });

/** Counts messages a person sent (for the traction stats). Called at most every 30s per tab. */
export async function POST(req: Request) {
  try {
    const p = body.safeParse(await req.json().catch(() => ({})));
    if (!p.success) throw new HttpError(400, 'Invalid');
    const c = await requireMember(p.data.slug);
    await bumpActivity(c.ev.id, c.userId, p.data.n);
    return Response.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
