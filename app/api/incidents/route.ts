import { requireMember } from '@/lib/server/auth';
import { getChannel, insertIncident, listIncidents, listMemberIds, listPlaces } from '@/lib/server/db';
import { errorResponse, HttpError } from '@/lib/server/http';
import { incidentInput, CATEGORY_LABEL } from '@/lib/shared/incidents';
import { rolesFor } from '@/lib/shared/permissions';
import { ensureChannel } from '@/lib/server/rooms';
import { joinGroup } from '@/lib/server/nexconn';
import { newId } from '@/lib/server/ids';
import { post, signal } from '@/lib/server/broadcast';
import { BS_TYPES } from '@/lib/shared/types';

/** Run next to the Supabase database (Sydney): every request makes several DB round trips. */
export const preferredRegion = 'syd1';

export async function POST(req: Request) {
  try {
    const p = incidentInput.safeParse(await req.json().catch(() => ({})));
    if (!p.success) throw new HttpError(400, p.error.issues[0].message);
    const { slug, category, placeId, note } = p.data;
    const c = await requireMember(slug);
    const [places, staff, crew] = await Promise.all([
      listPlaces(c.ev.id), listMemberIds(c.ev.id, rolesFor('crewConsole')), getChannel('crew', c.ev.id),
    ]);
    const place = placeId ? places.find((x) => x.id === placeId) : null;
    if (placeId && !place) throw new HttpError(400, 'Pick a place from the map.');

    const id = newId('inc');
    const title = `${CATEGORY_LABEL[category]}${place ? `: ${place.name}` : ''}`;
    // Private room: the reporter plus everyone working tonight. Never the whole audience.
    const channelId = await ensureChannel('incident', id, title, c.userId);
    await Promise.all([
      joinGroup(channelId, [...new Set([c.userId, ...staff])]),
      insertIncident({ id, eventId: c.ev.id, placeId: place?.id ?? null, category, note, reporterId: c.userId, channelId }),
    ]);

    const card = { incidentId: id, category, placeId: place?.id ?? null, note, reporterName: c.name };
    await Promise.all([
      post(channelId, BS_TYPES.incident, card, `New report: ${title}`),
      crew ? post(crew, BS_TYPES.incident, card, `New report: ${title}`).then(() => signal(crew, { kind: 'incident', id })) : null,
    ]);
    return Response.json({ id, channelId });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function GET(req: Request) {
  try {
    const slug = new URL(req.url).searchParams.get('slug') ?? '';
    const c = await requireMember(slug, rolesFor('crewConsole'));
    return Response.json({ incidents: await listIncidents(c.ev.id) });
  } catch (e) {
    return errorResponse(e);
  }
}
