import { z } from 'zod';
import { requireMember } from '@/lib/server/auth';
import * as dbm from '@/lib/server/db';
import { errorResponse, HttpError } from '@/lib/server/http';
import { makeDecide } from '@/lib/server/decide';
import { post, signal } from '@/lib/server/broadcast';
import { BS_TYPES } from '@/lib/shared/types';

/** Run next to the Supabase database (Sydney): every request makes several DB round trips. */
export const preferredRegion = 'syd1';

const body = z.object({
  slug: z.string(),
  decision: z.enum(['approve', 'reject']),
  notice: z.string().max(140).optional(),
});

export async function POST(req: Request, ctx: RouteContext<'/api/proposals/[id]/approve'>) {
  try {
    const { id } = await ctx.params;
    const p = body.safeParse(await req.json().catch(() => ({})));
    if (!p.success) throw new HttpError(400, 'Invalid decision');
    const c = await requireMember(p.data.slug);
    const [gig, crew] = await Promise.all([dbm.getChannel('gig', c.ev.id), dbm.getChannel('crew', c.ev.id)]);

    const decide = makeDecide({
      getProposal: dbm.getProposal,
      getIncident: dbm.getIncident,
      decide: dbm.decideProposal,
      upsertCondition: dbm.upsertCondition,
      setIncidentStatus: dbm.setIncidentStatus,
      addAudit: dbm.addAudit,
      now: () => new Date(),
      announce: async ({ condition }) => {
        if (!gig) return;
        await post(gig, BS_TYPES.announce, {
          placeId: condition.placeId, notice: condition.notice, status: condition.status, approvedBy: condition.approvedBy,
        }, condition.notice);
      },
      signalRooms: async (inc) => {
        await Promise.all([
          signal(inc.channelId, { kind: 'proposal', id }),
          signal(gig, { kind: 'conditions' }),
          signal(crew, { kind: 'conditions' }),
        ]);
      },
    });

    const result = await decide({ eventId: c.ev.id, userId: c.userId, name: c.name, role: c.role }, id, p.data.decision, p.data.notice);
    return Response.json(result);
  } catch (e) {
    return errorResponse(e);
  }
}
