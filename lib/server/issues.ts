import { ensureTeamChannel, getIssue, insertIssue, updateIssue } from './crew';
import { listPlaces, type EventSecrets } from './db';
import { newId } from './ids';
import { post, signal } from './broadcast';
import { HttpError } from './http';
import { BS_TYPES, type Incident } from '@/lib/shared/types';
import { team, type TeamId } from '@/lib/shared/teams';

export type RaiseInput = {
  team: TeamId; title: string; note: string; severity: 'normal' | 'urgent' | 'critical'; placeId: string | null;
  reporterId: string; reporterName: string;
};

/**
 * Save an issue, then post its card into the team room (and Control when critical).
 * Posting is best-effort: the issue is saved either way, and HQ shows it on refetch.
 */
export async function raiseIssue(ev: EventSecrets, i: RaiseInput) {
  const [places, channelId, control] = await Promise.all([
    listPlaces(ev.id),
    ensureTeamChannel(ev.id, ev.title, i.team),
    ensureTeamChannel(ev.id, ev.title, 'control'),
  ]);
  const place = i.placeId ? places.find((x) => x.id === i.placeId) : null;
  if (i.placeId && !place) throw new HttpError(400, 'Pick a place from the map');

  const id = newId('iss');
  await insertIssue({ id, eventId: ev.id, team: i.team, title: i.title, note: i.note, severity: i.severity,
    placeId: place?.id ?? null, reporterId: i.reporterId, channelId });

  const card = { issueId: id, team: i.team, title: i.title, note: i.note, severity: i.severity,
    placeId: place?.id ?? null, placeName: place?.name ?? null, reporterName: i.reporterName, status: 'new' };
  const push = `${i.severity === 'critical' ? '🔴 ' : ''}${team(i.team).name}: ${i.title}`;
  const sent = await Promise.allSettled([
    post(channelId, BS_TYPES.issue, card, push),
    // Critical issues are also called on Control so the show caller hears it immediately.
    i.severity === 'critical' && i.team !== 'control' ? post(control, BS_TYPES.issue, card, push) : null,
  ]);
  const failed = sent.filter((r) => r.status === 'rejected');
  if (failed.length) console.error('issue card not delivered', id, failed.map((f) => (f as PromiseRejectedResult).reason));
  await signal(control, { kind: 'crew', id });
  return { id, delivered: failed.length === 0 };
}

export type IssueAction = 'take' | 'fix' | 'reopen';

/** "On it" / "Fixed" / reopen with compare-and-set. Returns null when someone else changed it first. */
export async function actOnIssue(ev: EventSecrets, issue: Incident, action: IssueAction, by: { userId: string; name: string }) {
  const to = action === 'take' ? 'checking' : action === 'fix' ? 'resolved' : 'new';
  if (issue.status === to) return { status: to, unchanged: true };
  const assignee = action === 'reopen' ? null : action === 'fix' ? issue.assigneeId ?? by.userId : by.userId;
  const ok = await updateIssue(issue.id, issue.status, to, assignee);
  if (!ok) return null;
  const control = await ensureTeamChannel(ev.id, ev.title, 'control');
  await post(issue.channelId, BS_TYPES.issueUpdate, {
    issueId: issue.id, team: issue.team, title: issue.title ?? issue.note, action, by: by.name, status: to,
  }).catch((e) => console.error('issue update card not delivered', issue.id, e));
  await signal(control, { kind: 'crew', id: issue.id });
  return { status: to, unchanged: false };
}

export { getIssue };
