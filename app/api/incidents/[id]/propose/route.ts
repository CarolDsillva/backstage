import { z } from 'zod';
import { requireMember } from '@/lib/server/auth';
import { addAudit, getIncident, insertProposal, listPlaces } from '@/lib/server/db';
import { errorResponse, HttpError } from '@/lib/server/http';
import { rolesFor } from '@/lib/shared/permissions';
import { canDraft } from '@/lib/shared/incidents';
import { draftProposal } from '@/lib/server/ai';
import { newId } from '@/lib/server/ids';
import { post } from '@/lib/server/broadcast';
import { BS_TYPES } from '@/lib/shared/types';

const body = z.object({
  slug: z.string(),
  // The crew's client sends the recent room messages it already has.
  messages: z.array(z.object({ name: z.string().max(40), text: z.string().max(1000) })).max(30).default([]),
});

export async function POST(req: Request, ctx: RouteContext<'/api/incidents/[id]/propose'>) {
  try {
    const { id } = await ctx.params;
    const p = body.safeParse(await req.json().catch(() => ({})));
    if (!p.success) throw new HttpError(400, 'Invalid request');
    const c = await requireMember(p.data.slug, rolesFor('proposeUpdate'));
    const incident = await getIncident(id);
    if (!incident || incident.eventId !== c.ev.id) throw new HttpError(404, 'Report not found');
    if (!canDraft(incident)) throw new HttpError(400, 'Only open reports tied to a place can become an audience update.');
    const places = await listPlaces(c.ev.id);
    const place = places.find((x) => x.id === incident.placeId) ?? null;

    const draft = await draftProposal({ incident, place, places, messages: p.data.messages });
    const proposalId = newId('prop');
    await insertProposal({ id: proposalId, incidentId: id, ...draft });
    await addAudit(id, c.userId, 'drafted_update', null, `${draft.placeId}:${draft.status}`);
    await post(incident.channelId, BS_TYPES.proposal, { proposalId, draftedBy: c.name }, 'Update ready for a lead to approve');
    return Response.json({ proposalId, source: draft.source });
  } catch (e) {
    return errorResponse(e);
  }
}
