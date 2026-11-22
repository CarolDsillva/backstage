import { check, db } from './db';
import { ensureChannel } from './rooms';
import * as nx from './nexconn';
import { channelsFor, team, teamContext, type TeamId } from '@/lib/shared/teams';
import type { Incident, IncidentStatus, Role } from '@/lib/shared/types';

/** Crew comms data access. All queries run server-side with the service key. */

export type CrewMember = { userId: string; name: string; role: Role; team: string | null };

export async function getMembership(eventId: string, userId: string) {
  return check(
    await db().from('memberships').select('role,team').eq('event_id', eventId).eq('user_id', userId).maybeSingle(),
  ) as { role: Role; team: string | null } | null;
}

export async function setTeam(eventId: string, userId: string, teamId: TeamId) {
  check(await db().from('memberships').update({ team: teamId }).eq('event_id', eventId).eq('user_id', userId));
}

/** Everyone on the crew side (no audience), with names. */
export async function listCrew(eventId: string): Promise<CrewMember[]> {
  const rows = check(
    await db().from('memberships').select('user_id,role,team,users(name)').eq('event_id', eventId).in('role', ['crew', 'lead', 'artist']),
  ) as unknown as { user_id: string; role: Role; team: string | null; users: { name: string } | null }[];
  return rows.map((r) => ({ userId: r.user_id, name: r.users?.name ?? 'Crew', role: r.role, team: r.team }));
}

/** One Nexconn group per team; idempotent. */
export function ensureTeamChannel(eventId: string, title: string, teamId: TeamId) {
  return ensureChannel('team', teamContext(eventId, teamId), `${title} · ${team(teamId).name}`, '');
}

/** Create (if needed) and join every channel this member may open. Returns team → channelId. */
export async function joinTeamChannels(eventId: string, title: string, userId: string, role: Role, myTeam: string | null) {
  const ids = channelsFor(role, myTeam);
  const pairs = await Promise.all(ids.map(async (t) => [t, await ensureTeamChannel(eventId, title, t)] as const));
  await Promise.all(pairs.map(([, ch]) => nx.joinGroup(ch, [userId])));
  return Object.fromEntries(pairs) as Partial<Record<TeamId, string>>;
}

/** Channel ids for every team that already has a room (one query). */
export async function teamChannelIds(eventId: string): Promise<Partial<Record<TeamId, string>>> {
  const rows = check(
    await db().from('channels').select('context_id,channel_id').eq('context_type', 'team').like('context_id', `${eventId}%`),
  ) as { context_id: string; channel_id: string }[];
  return Object.fromEntries(rows.map((r) => [r.context_id.slice(eventId.length), r.channel_id])) as Partial<Record<TeamId, string>>;
}

type IssueDb = {
  id: string; event_id: string; place_id: string | null; category: Incident['category']; note: string; status: IncidentStatus;
  reporter_id: string; channel_id: string; created_at: string; team: string | null; severity: string | null; title: string | null;
  assignee_id: string | null; reporter: { name: string } | null; assignee: { name: string } | null;
};

const ISSUE_SELECT =
  'id,event_id,place_id,category,note,status,reporter_id,channel_id,created_at,team,severity,title,assignee_id,' +
  'reporter:users!incidents_reporter_id_fkey(name),assignee:users!incidents_assignee_id_fkey(name)';

function mapIssue(r: IssueDb): Incident {
  return {
    id: r.id, eventId: r.event_id, placeId: r.place_id, category: r.category, note: r.note, status: r.status,
    reporterId: r.reporter_id, reporterName: r.reporter?.name ?? 'Someone', channelId: r.channel_id, createdAt: r.created_at,
    team: r.team, severity: r.severity ?? 'normal', title: r.title, assigneeId: r.assignee_id, assigneeName: r.assignee?.name ?? null,
  };
}

/** Crew issues across every team, newest first (resolved ones from the last 3 hours only). */
export async function listIssues(eventId: string): Promise<Incident[]> {
  const since = new Date(Date.now() - 3 * 3600_000).toISOString();
  const rows = check(
    await db().from('incidents').select(ISSUE_SELECT).eq('event_id', eventId).not('team', 'is', null)
      .or(`status.neq.resolved,created_at.gte.${since}`).order('created_at', { ascending: false }).limit(80),
  ) as unknown as IssueDb[];
  return rows.map(mapIssue);
}

export async function getIssue(id: string): Promise<Incident | null> {
  const r = check(await db().from('incidents').select(ISSUE_SELECT).eq('id', id).maybeSingle()) as unknown as IssueDb | null;
  return r ? mapIssue(r) : null;
}

export async function insertIssue(i: {
  id: string; eventId: string; team: TeamId; title: string; note: string; severity: string; placeId: string | null;
  reporterId: string; channelId: string;
}) {
  check(await db().from('incidents').insert({
    id: i.id, event_id: i.eventId, team: i.team, title: i.title, note: i.note, severity: i.severity, place_id: i.placeId,
    category: 'place_problem', reporter_id: i.reporterId, channel_id: i.channelId,
  }));
}

/** Compare-and-set on status so two people tapping "On it" can't both win. Returns false if it changed under us. */
export async function updateIssue(id: string, from: IncidentStatus, to: IncidentStatus, assigneeId: string | null) {
  const extra = to === 'resolved' ? { resolved_at: new Date().toISOString() } : to === 'checking' ? { verified_at: new Date().toISOString() } : {};
  const r = check(
    await db().from('incidents').update({ status: to, assignee_id: assigneeId, ...extra }).eq('id', id).eq('status', from).select('id'),
  ) as { id: string }[];
  return r.length === 1;
}

export type RadioSession = { team: string; callId: string; startedBy: string; startedAt: string };

export async function listRadio(eventId: string): Promise<RadioSession[]> {
  const rows = check(
    await db().from('radio_sessions').select('team,call_id,started_by,started_at').eq('event_id', eventId),
  ) as { team: string; call_id: string; started_by: string; started_at: string }[];
  return rows.map((r) => ({ team: r.team, callId: r.call_id, startedBy: r.started_by, startedAt: r.started_at }));
}

export async function setRadio(eventId: string, teamId: TeamId, callId: string, userId: string) {
  check(await db().from('radio_sessions').upsert({ event_id: eventId, team: teamId, call_id: callId, started_by: userId, started_at: new Date().toISOString() }));
}

export async function clearRadio(eventId: string, teamId: TeamId, callId?: string) {
  let q = db().from('radio_sessions').delete().eq('event_id', eventId).eq('team', teamId);
  if (callId) q = q.eq('call_id', callId);
  check(await q);
}
