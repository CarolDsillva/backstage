import { requireMember } from '@/lib/server/auth';
import { getIncident, getProposal } from '@/lib/server/db';
import { errorResponse, HttpError } from '@/lib/server/http';
import { isStaff } from '@/lib/server/rooms';

/** Run next to the Supabase database (Sydney): every request makes several DB round trips. */
export const preferredRegion = 'syd1';

export async function GET(req: Request, ctx: RouteContext<'/api/proposals/[id]'>) {
  try {
    const { id } = await ctx.params;
    const c = await requireMember(new URL(req.url).searchParams.get('slug') ?? '');
    const p = await getProposal(id);
    const inc = p ? await getIncident(p.incidentId) : null;
    if (!p || !inc || inc.eventId !== c.ev.id) throw new HttpError(404, 'Update not found');
    if (!isStaff(c.role) && inc.reporterId !== c.userId) throw new HttpError(403, 'Not allowed');
    return Response.json({ proposal: p });
  } catch (e) {
    return errorResponse(e);
  }
}
