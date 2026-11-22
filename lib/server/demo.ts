import { db, check, listPlaces, upsertUser, type EventSecrets } from './db';
import { ensureTeamChannel, joinTeamChannels, listIssues } from './crew';
import { issueToken, sendGroupMessage } from './nexconn';
import { raiseIssue, actOnIssue } from './issues';
import type { TeamId } from '@/lib/shared/teams';

/**
 * Demo Fest: a public practice event. Ten scripted demo crew members (clearly a demo) post real
 * messages through the Nexconn server API so the event feels busy for whoever is trying it.
 */
export type Bot = { id: string; name: string; team: TeamId; role: 'crew' | 'lead' };

export const DEMO_BOTS: Bot[] = [
  { id: 'dm_isha', name: 'Isha · Stage manager', team: 'control', role: 'crew' },
  { id: 'dm_vikram', name: 'Vikram · Security', team: 'security', role: 'crew' },
  { id: 'dm_tara', name: 'Tara · Artist liaison', team: 'artist', role: 'crew' },
  { id: 'dm_kabir', name: 'Kabir · Sound', team: 'production', role: 'crew' },
  { id: 'dm_sam', name: 'Sam · Lights', team: 'production', role: 'crew' },
  { id: 'dm_neha', name: 'Neha · Green room', team: 'hospitality', role: 'crew' },
  { id: 'dm_rohan', name: 'Rohan · Runner', team: 'runners', role: 'crew' },
  { id: 'dm_farah', name: 'Farah · Bar 2', team: 'stalls', role: 'crew' },
  { id: 'dm_arjun', name: 'Arjun · Gate A', team: 'foh', role: 'crew' },
  { id: 'dm_meera', name: 'Dr Meera · First aid', team: 'medical', role: 'crew' },
];

export const PERSONAS = {
  lead: { label: 'Show caller', team: 'control' as TeamId, role: 'lead' as const, blurb: 'Hears every team. Runs the night.' },
  security: { label: 'Security', team: 'security' as TeamId, role: 'crew' as const, blurb: 'Gates, barriers and the crowd.' },
  runners: { label: 'Runner', team: 'runners' as TeamId, role: 'crew' as const, blurb: 'Fetch, carry, fix fast.' },
};
export type PersonaId = keyof typeof PERSONAS;

const bot = (id: string) => DEMO_BOTS.find((b) => b.id === id)!;

/** Send a plain text message as a crew member through the Nexconn server API. */
export async function say(ev: EventSecrets, from: { id: string; name: string }, teamId: TeamId, text: string) {
  const channelId = await ensureTeamChannel(ev.id, ev.title, teamId);
  await sendGroupMessage({
    from: from.id, channelId, type: 'RC:TxtMsg',
    content: { content: text, user: { id: from.id, name: from.name } },
    push: `${from.name.split(' · ')[0]}: ${text}`,
  });
}

/** Register the crew with Nexconn and the database, and put them in their team rooms. */
export async function enrolCrew(ev: EventSecrets, crew: Bot[]) {
  for (const b of crew) {
    await upsertUser(b.id, b.name);
    check(await db().from('memberships').upsert({ event_id: ev.id, user_id: b.id, role: b.role, team: b.team }));
    await issueToken(b.id, b.name); // registers the user with Nexconn
    await joinTeamChannels(ev.id, ev.title, b.id, b.role, b.team);
  }
}

/** The critical issue a new demo visitor practises on (only one open at a time). */
export async function kickoff(ev: EventSecrets) {
  const open = (await listIssues(ev.id)).find((i) => i.team === 'security' && i.severity === 'critical' && i.status === 'new');
  if (open) return open.id;
  const v = bot('dm_vikram');
  const r = await raiseIssue(ev, {
    team: 'security', title: 'Barrier B bowing, crowd pushing', note: 'Left of the speaker stack. Need 2 more hands now.',
    severity: 'critical', placeId: 'barrier', reporterId: v.id, reporterName: v.name,
  });
  return r.id;
}

type Line =
  | { kind: 'text'; by: string; team: TeamId; text: string }
  | { kind: 'issue'; by: string; team: TeamId; title: string; note: string; severity: 'normal' | 'urgent' | 'critical'; place: string | null }
  | { kind: 'fix'; by: string; team: TeamId };

/** A loop of show-night traffic. One line every ~20 s while someone has the demo open. */
const SCRIPT: Line[] = [
  { kind: 'text', by: 'dm_arjun', team: 'foh', text: 'Gate A queue past the chai stall. Opening lane 3.' },
  { kind: 'text', by: 'dm_isha', team: 'control', text: 'All teams: doors in 10. Radio check on your channels please.' },
  { kind: 'issue', by: 'dm_farah', team: 'stalls', title: 'Card machine down at Bar 2', note: 'Cash only for now, queue growing.', severity: 'urgent', place: 'bar2' },
  { kind: 'text', by: 'dm_kabir', team: 'production', text: 'Line check done. Vocal mic 2 is crackling, swapping it.' },
  { kind: 'text', by: 'dm_neha', team: 'hospitality', text: 'Green room restocked. Artist asked for warm water, not cold.' },
  { kind: 'text', by: 'dm_tara', team: 'artist', text: 'Neon Monsoon wants to add one song in the encore. +4 min.' },
  { kind: 'fix', by: 'dm_rohan', team: 'stalls' },
  { kind: 'text', by: 'dm_rohan', team: 'runners', text: 'Spare card machine delivered to Bar 2 ✅' },
  { kind: 'issue', by: 'dm_meera', team: 'medical', title: 'Person feeling faint near Toilets', note: 'Conscious, sitting down. Bringing water.', severity: 'urgent', place: 'toilets' },
  { kind: 'text', by: 'dm_sam', team: 'production', text: 'Haze is heavy on stage left, dialing it down.' },
  { kind: 'text', by: 'dm_vikram', team: 'security', text: 'Side exit clear. Two more volunteers on the barrier.' },
  { kind: 'fix', by: 'dm_meera', team: 'medical' },
  { kind: 'text', by: 'dm_isha', team: 'control', text: 'Set 1 starts in 2. Houselights to half on my go.' },
  { kind: 'issue', by: 'dm_arjun', team: 'foh', title: 'Wristbands running low at Gate A', note: 'About 80 left.', severity: 'normal', place: 'entry' },
  { kind: 'text', by: 'dm_rohan', team: 'runners', text: 'On my way to Gate A with a box of wristbands.' },
  { kind: 'fix', by: 'dm_arjun', team: 'foh' },
];

/** Post the next scripted line. Several open tabs can call this; a per-slot row makes sure only one posts. */
export async function tick(ev: EventSecrets) {
  const slot = Math.floor(Date.now() / 20_000);
  const claim = await db().from('channels').insert({ context_type: 'demotick', context_id: `${ev.id}:${slot}`, channel_id: `tick${ev.id}${slot}` });
  if (claim.error) return { posted: false };
  void db().from('channels').delete().eq('context_type', 'demotick').lt('created_at', new Date(Date.now() - 3600_000).toISOString());
  const line = SCRIPT[slot % SCRIPT.length];
  const who = bot(line.by);
  if (line.kind === 'text') await say(ev, who, line.team, line.text);
  else if (line.kind === 'issue') {
    const places = await listPlaces(ev.id);
    await raiseIssue(ev, { team: line.team, title: line.title, note: line.note, severity: line.severity,
      placeId: line.place && places.some((p) => p.id === line.place) ? line.place : null, reporterId: who.id, reporterName: who.name });
  } else {
    const issue = (await listIssues(ev.id)).find((i) => i.team === line.team && i.status !== 'resolved' && i.reporterId.startsWith('dm_'));
    if (issue) await actOnIssue(ev, issue, 'fix', { userId: who.id, name: who.name });
  }
  return { posted: true };
}

/** Replies from the demo crew to what the visitor just did in the walkthrough. */
export async function react(ev: EventSecrets, kind: 'took' | 'message' | 'fixed', team: TeamId) {
  const replyFrom = DEMO_BOTS.find((b) => b.team === team) ?? bot('dm_isha');
  const text =
    kind === 'took' ? 'Thank you! Barrier B is the one left of the speaker stack. Bring two people.'
    : kind === 'fixed' ? 'Barrier is holding now. Crowd moved back a metre. 🙏'
    : 'Copy that 👍 On it.';
  await say(ev, replyFrom, kind === 'message' ? team : 'security', text);
}
