import { z } from 'zod';
import { assertTeamAccess, requireCrew } from '@/lib/server/crewAuth';
import { ensureTeamChannel, insertIssue } from '@/lib/server/crew';
import { listPlaces } from '@/lib/server/db';
import { errorResponse, HttpError } from '@/lib/server/http';
import { newId } from '@/lib/server/ids';
import { post, signal } from '@/lib/server/broadcast';
import { BS_TYPES } from '@/lib/shared/types';
import { TEAM_IDS, team, type TeamId } from '@/lib/shared/teams';

/** Run next to the Supabase database (Sydney): every request makes several DB round trips. */
export const preferredRegion = 'syd1';

const input = z.object({
  team: z.enum(TEAM_IDS as [TeamId, ...TeamId[]]),
  title: z.string().trim().min(2, 'Say what the problem is').max(80, 'Keep the title under 80 characters'),
  note: z.string().trim().max(400).default(''),
  severity: z.enum(['normal', 'urgent', 'critical']).default('normal'),
  placeId: z.string().max(40).nullable().default(null),
});

/** Raise an issue in a team room. It lands as a card in that room and on everyone's HQ map/feed. */
export async function POST(req: Request, ctx: RouteContext<'/api/crew/[slug]/issues'>) {
  try {
    const { slug } = await ctx.params;
    const p = input.safeParse(await req.json().catch(() => ({})));
    if (!p.success) throw new HttpError(400, p.error.issues[0].message);
    const c = await requireCrew(slug);
    assertTeamAccess(c, p.data.team);
    const [places, channelId, control] = await Promise.all([
      listPlaces(c.ev.id),
      ensureTeamChannel(c.ev.id, c.ev.title, p.data.team),
      ensureTeamChannel(c.ev.id, c.ev.title, 'control'),
    ]);
    const place = p.data.placeId ? places.find((x) => x.id === p.data.placeId) : null;
    if (p.data.placeId && !place) throw new HttpError(400, 'Pick a place from the map');

    const id = newId('iss');
    await insertIssue({ id, eventId: c.ev.id, team: p.data.team, title: p.data.title, note: p.data.note, severity: p.data.severity,
      placeId: place?.id ?? null, reporterId: c.userId, channelId });

    const card = { issueId: id, team: p.data.team, title: p.data.title, note: p.data.note, severity: p.data.severity,
      placeId: place?.id ?? null, placeName: place?.name ?? null, reporterName: c.name, status: 'new' };
    const push = `${p.data.severity === 'critical' ? '🔴 ' : ''}${team(p.data.team).name}: ${p.data.title}`;
    // The issue is saved. Posting the cards is best-effort: if Nexconn hiccups, we must not
    // return an error (the person would retry and create a duplicate); HQ still shows it on refetch.
    const sent = await Promise.allSettled([
      post(channelId, BS_TYPES.issue, card, push),
      // Critical issues are also called on Control so the show caller hears it immediately.
      p.data.severity === 'critical' && p.data.team !== 'control' ? post(control, BS_TYPES.issue, card, push) : null,
    ]);
    const failed = sent.filter((r) => r.status === 'rejected');
    if (failed.length) console.error('issue card not delivered', id, failed.map((f) => (f as PromiseRejectedResult).reason));
    await signal(control, { kind: 'crew', id });
    return Response.json({ id, delivered: failed.length === 0 });
  } catch (e) {
    return errorResponse(e);
  }
}
