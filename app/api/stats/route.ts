import { requireMember } from '@/lib/server/auth';
import { eventStats } from '@/lib/server/db';
import { errorResponse } from '@/lib/server/http';
import { rolesFor } from '@/lib/shared/permissions';

export async function GET(req: Request) {
  try {
    const c = await requireMember(new URL(req.url).searchParams.get('slug') ?? '', rolesFor('stats'));
    return Response.json({ title: c.ev.title, stats: await eventStats(c.ev.id), at: new Date().toISOString() });
  } catch (e) {
    return errorResponse(e);
  }
}
