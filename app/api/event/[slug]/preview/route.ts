import { getEventBySlug, publicEvent, roomPreview } from '@/lib/server/db';
import { errorResponse, HttpError } from '@/lib/server/http';
import { phaseOf } from '@/lib/shared/phase';

/** Run next to the Supabase database (Sydney): every request makes several DB round trips. */
export const preferredRegion = 'syd1';

/** No login needed: what someone sees before they join. */
export async function GET(_req: Request, ctx: RouteContext<'/api/event/[slug]/preview'>) {
  try {
    const { slug } = await ctx.params;
    const ev = await getEventBySlug(slug);
    if (!ev) throw new HttpError(404, 'Gig not found');
    const phase = phaseOf(new Date(), new Date(ev.startsAt), new Date(ev.endsAt), ev.phaseOverride);
    return Response.json({ event: publicEvent(ev), phase, ...(await roomPreview(ev.id)) });
  } catch (e) {
    return errorResponse(e);
  }
}
