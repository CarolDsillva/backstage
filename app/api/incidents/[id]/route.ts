import { z } from 'zod';
import { requireMember } from '@/lib/server/auth';
import { addAudit, getChannel, getIncident, listAudit, setIncidentStatus } from '@/lib/server/db';
import { errorResponse, HttpError } from '@/lib/server/http';
import { canTransition } from '@/lib/shared/incidents';
import { isStaff } from '@/lib/server/rooms';
import { signal } from '@/lib/server/broadcast';

/** Run next to the Supabase database (Sydney): every request makes several DB round trips. */
export const preferredRegion = 'syd1';

async function load(id: string, slug: string) {
  const c = await requireMember(slug);
  const inc = await getIncident(id);
  if (!inc || inc.eventId !== c.ev.id) throw new HttpError(404, 'Report not found');
  if (!isStaff(c.role) && inc.reporterId !== c.userId) throw new HttpError(403, 'Not your report');
  return { c, inc };
}

export async function GET(req: Request, ctx: RouteContext<'/api/incidents/[id]'>) {
  try {
    const { id } = await ctx.params;
    const { inc } = await load(id, new URL(req.url).searchParams.get('slug') ?? '');
    const audit = (await listAudit(id)).map((a) => ({ kind: a.kind, old: a.old, new: a.new, at: a.created_at, by: a.users?.name ?? 'Someone' }));
    return Response.json({ incident: inc, audit });
  } catch (e) {
    return errorResponse(e);
  }
}

const body = z.object({ slug: z.string(), status: z.enum(['new', 'checking', 'verified', 'resolved']) });

export async function PATCH(req: Request, ctx: RouteContext<'/api/incidents/[id]'>) {
  try {
    const { id } = await ctx.params;
    const p = body.safeParse(await req.json().catch(() => ({})));
    if (!p.success) throw new HttpError(400, 'Invalid status');
    const { c, inc } = await load(id, p.data.slug);
    if (!canTransition(inc.status, p.data.status, c.role)) {
      throw new HttpError(403, p.data.status === 'verified' ? 'Only a lead can confirm a report.' : 'That status change isn’t allowed.');
    }
    await setIncidentStatus(id, p.data.status);
    await addAudit(id, c.userId, 'status', inc.status, p.data.status);
    await signal(inc.channelId, { kind: 'incident', id });
    await signal(await getChannel('crew', c.ev.id), { kind: 'incident', id });
    return Response.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
