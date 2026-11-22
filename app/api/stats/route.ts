import { requireMember } from '@/lib/server/auth';
import { eventStats } from '@/lib/server/db';
import { errorResponse } from '@/lib/server/http';
import { rolesFor } from '@/lib/shared/permissions';

/** Run next to the Supabase database (Sydney): every request makes several DB round trips. */
export const preferredRegion = 'syd1';

export async function GET(req: Request) {
  try {
    const c = await requireMember(new URL(req.url).searchParams.get('slug') ?? '', rolesFor('stats'));
    return Response.json({ title: c.ev.title, stats: await eventStats(c.ev.id), at: new Date().toISOString() });
  } catch (e) {
    return errorResponse(e);
  }
}
