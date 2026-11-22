import { currentUserId } from './auth';
import { getEventBySlug, getUser, type EventSecrets } from './db';
import { getMembership } from './crew';
import { HttpError } from './http';
import { TEAM_IDS, channelsFor, isTeam, type TeamId } from '@/lib/shared/teams';
import type { Role } from '@/lib/shared/types';

export type CrewCtx = {
  ev: EventSecrets; userId: string; name: string; role: Role; team: TeamId | null; canOpen: TeamId[];
  /** Read-only guest (entered with the event's viewer code): sees every channel, can't post or act. */
  viewer: boolean;
};

const CREW_ROLES: Role[] = ['crew', 'lead', 'artist'];
/** Viewers are stored as audience members with this marker in memberships.team (no schema change needed). */
export const VIEWER_TEAM = 'viewer';

/**
 * Resolve event + crew member (membership, team and name in one parallel round trip).
 * Pass { write: true } on routes that change anything: viewers get a 403 there.
 */
export async function requireCrew(slug: string, opts: { write?: boolean } = {}): Promise<CrewCtx> {
  const userId = await currentUserId();
  if (!userId) throw new HttpError(401, 'Check in with your crew code first');
  const ev = await getEventBySlug(slug);
  if (!ev) throw new HttpError(404, 'Event not found');
  const [m, user] = await Promise.all([getMembership(ev.id, userId), getUser(userId)]);
  if (!m) throw new HttpError(401, 'Check in with your crew code first');
  const name = user?.name ?? 'Crew';
  if (m.team === VIEWER_TEAM) {
    if (opts.write) throw new HttpError(403, 'You’re watching as a viewer, so this is read-only.');
    return { ev, userId, name, role: m.role, team: null, canOpen: [...TEAM_IDS], viewer: true };
  }
  if (!CREW_ROLES.includes(m.role)) throw new HttpError(403, 'This is the crew side. Ask your lead for the crew code.');
  const myTeam = isTeam(m.team) ? m.team : m.role === 'artist' ? 'artist' : null;
  return { ev, userId, name, role: m.role, team: myTeam, canOpen: channelsFor(m.role, myTeam), viewer: false };
}

/** Throws 403 unless the member may use this team's channel. */
export function assertTeamAccess(c: CrewCtx, teamId: TeamId) {
  if (!c.canOpen.includes(teamId)) throw new HttpError(403, 'That channel belongs to another team.');
}
