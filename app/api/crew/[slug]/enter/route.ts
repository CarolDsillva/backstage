import crypto from 'node:crypto';
import { z } from 'zod';
import { currentUserId, setSessionCookie } from '@/lib/server/auth';
import { check, db, getEventBySlug, getUser, upsertUser } from '@/lib/server/db';
import { joinTeamChannels } from '@/lib/server/crew';
import { issueToken } from '@/lib/server/nexconn';
import { VIEWER_TEAM } from '@/lib/server/crewAuth';
import { kickoff, PERSONAS, type PersonaId } from '@/lib/server/demo';
import { roleForCode } from '@/lib/server/rooms';
import { errorResponse, HttpError } from '@/lib/server/http';
import type { Role } from '@/lib/shared/types';

export const preferredRegion = 'syd1';

const input = z.object({
  code: z.string().trim().max(64).optional(),
  name: z.string().trim().max(32).optional(),
  persona: z.enum(['lead', 'security', 'runners']).optional(),
});

/**
 * One front door for the crew app:
 *  - demo events: pick a role (no code),
 *  - viewer code: read-only guest who sees every channel,
 *  - crew / lead / artist code: the real crew.
 */
export async function POST(req: Request, ctx: RouteContext<'/api/crew/[slug]/enter'>) {
  try {
    const { slug } = await ctx.params;
    const p = input.safeParse(await req.json().catch(() => ({})));
    if (!p.success) throw new HttpError(400, p.error.issues[0].message);
    const ev = await getEventBySlug(slug);
    if (!ev) throw new HttpError(404, 'Event not found');
    const { code, persona } = p.data;

    let role: Role;
    let team: string | null;
    let name = p.data.name ?? '';
    if (persona) {
      if (!ev.refs?.demo) throw new HttpError(400, 'This event needs a code.');
      const pr = PERSONAS[persona as PersonaId];
      role = pr.role; team = pr.team; name ||= `You · ${pr.label}`;
    } else if (code && ev.refs?.viewerCode && code.toLowerCase() === ev.refs.viewerCode.toLowerCase()) {
      role = 'attendee'; team = VIEWER_TEAM; name ||= 'Viewer';
    } else {
      role = roleForCode(ev, code);
      if (role === 'attendee') throw new HttpError(400, 'That code isn’t right. Check it with the show caller.');
      if (!name) throw new HttpError(400, 'Add your name so the crew knows who’s talking.');
      team = role === 'lead' ? 'control' : role === 'artist' ? 'artist' : null;
    }

    // A fresh identity per demo/viewer entry so two judges never share a session.
    if (team === VIEWER_TEAM && ev.refs?.viewerPool) {
      // Viewers sign in as one of the read-only accounts that were in every room during the show,
      // because Nexconn only shows a group's history from when a member joined.
      const n = 1 + Math.floor(Math.random() * ev.refs.viewerPool);
      const userId = `rv_${String(n).padStart(2, '0')}`;
      const token = await issueToken(userId, 'Viewer');
      await setSessionCookie(userId);
      return Response.json({ userId, name: 'Viewer', role, team, token });
    }
    const existing = persona || team === VIEWER_TEAM ? null : await currentUserId();
    const known = existing ? await getUser(existing) : null;
    const userId = known?.id ?? 'u' + crypto.randomUUID().replace(/-/g, '').slice(0, 20);

    await upsertUser(userId, name);
    const [token] = await Promise.all([
      issueToken(userId, name),
      (async () => {
        check(await db().from('memberships').upsert({ event_id: ev.id, user_id: userId, role, team }));
        // Viewers hear every channel (read-only in the app); crew join Control + their team.
        if (team) await joinTeamChannels(ev.id, ev.title, userId, team === VIEWER_TEAM ? 'lead' : role, team === VIEWER_TEAM ? null : team);
      })(),
      persona ? kickoff(ev).catch((e) => console.error('demo kickoff', e)) : null,
    ]);
    await setSessionCookie(userId);
    return Response.json({ userId, name, role, team, token });
  } catch (e) {
    return errorResponse(e);
  }
}
