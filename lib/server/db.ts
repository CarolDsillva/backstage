import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getEnv } from './env';
import type { EventRow, Place, Condition, Phase } from '@/lib/shared/types';
import type { Role } from '@/lib/shared/types';
import type { Card, CardType } from '@/lib/shared/types';
import type { Incident, IncidentStatus, Proposal } from '@/lib/shared/types';

let client: SupabaseClient | null = null;

/** Server-only Supabase client using the service key. */
export function db(): SupabaseClient {
  if (!client) {
    const env = getEnv();
    client = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}

export function check<T>(r: { data: T; error: { message: string } | null }): T {
  if (r.error) throw new Error(`db: ${r.error.message}`);
  return r.data;
}

export type EventSecrets = EventRow & { crewCode: string; leadCode: string; artistCode: string };

type EventDb = {
  id: string; slug: string; title: string; artist: string; venue: string;
  starts_at: string; ends_at: string; phase_override: Phase | null;
  crew_code: string; lead_code: string; artist_code: string;
};

export function mapEvent(r: EventDb): EventSecrets {
  return {
    id: r.id, slug: r.slug, title: r.title, artist: r.artist, venue: r.venue,
    startsAt: r.starts_at, endsAt: r.ends_at, phaseOverride: r.phase_override,
    crewCode: r.crew_code, leadCode: r.lead_code, artistCode: r.artist_code,
  };
}

/** Strip secrets before sending to a client. */
export function publicEvent(e: EventSecrets): EventRow {
  const { crewCode: _c, leadCode: _l, artistCode: _a, ...rest } = e;
  return rest;
}

export async function getEventBySlug(slug: string): Promise<EventSecrets | null> {
  const r = await db().from('events').select('*').eq('slug', slug).maybeSingle();
  const row = check(r) as EventDb | null;
  return row ? mapEvent(row) : null;
}

export async function setPhaseOverride(eventId: string, phase: Phase | null) {
  check(await db().from('events').update({ phase_override: phase }).eq('id', eventId));
}

export async function listPlaces(eventId: string): Promise<Place[]> {
  const rows = check(await db().from('places').select('id,name,kind,x,y').eq('event_id', eventId)) as Place[];
  return rows;
}

export async function listConditions(eventId: string): Promise<Condition[]> {
  const rows = check(await db().from('conditions').select('*').eq('event_id', eventId)) as {
    place_id: string; status: Condition['status']; notice: string; approved_by: string;
    approved_at: string; expires_at: string | null;
  }[];
  return rows.map((r) => ({
    placeId: r.place_id, status: r.status, notice: r.notice, approvedBy: r.approved_by,
    approvedAt: r.approved_at, expiresAt: r.expires_at,
  }));
}

export async function upsertCondition(eventId: string, c: Condition) {
  check(
    await db().from('conditions').upsert({
      event_id: eventId, place_id: c.placeId, status: c.status, notice: c.notice,
      approved_by: c.approvedBy, approved_at: c.approvedAt, expires_at: c.expiresAt,
    }),
  );
}

// ---- users, memberships, channels ----

export async function getUser(id: string) {
  return check(await db().from('users').select('id,name').eq('id', id).maybeSingle()) as
    | { id: string; name: string }
    | null;
}

export async function upsertUser(id: string, name: string) {
  check(await db().from('users').upsert({ id, name }));
}

export async function getRole(eventId: string, userId: string): Promise<Role | null> {
  const r = check(
    await db().from('memberships').select('role').eq('event_id', eventId).eq('user_id', userId).maybeSingle(),
  ) as { role: Role } | null;
  return r?.role ?? null;
}

export async function setRole(eventId: string, userId: string, role: Role) {
  check(await db().from('memberships').upsert({ event_id: eventId, user_id: userId, role }));
}

export async function listMemberIds(eventId: string, roles: Role[]): Promise<string[]> {
  const rows = check(
    await db().from('memberships').select('user_id').eq('event_id', eventId).in('role', roles),
  ) as { user_id: string }[];
  return rows.map((r) => r.user_id);
}

export async function getChannel(type: string, ctxId: string): Promise<string | null> {
  const r = check(
    await db().from('channels').select('channel_id').eq('context_type', type).eq('context_id', ctxId).maybeSingle(),
  ) as { channel_id: string } | null;
  return r?.channel_id ?? null;
}

export async function saveChannel(type: string, ctxId: string, channelId: string) {
  check(
    await db().from('channels').upsert(
      { context_type: type, context_id: ctxId, channel_id: channelId },
      { onConflict: 'context_type,context_id', ignoreDuplicates: true },
    ),
  );
}

// ---- cards ----

type CardDb = {
  id: string; event_id: string; type: CardType; author_id: string; payload: Record<string, unknown>;
  created_at: string; users: { name: string } | null; card_votes: { user_id: string; value: string }[];
};

function mapCard(r: CardDb): Card {
  return {
    id: r.id, eventId: r.event_id, type: r.type, authorId: r.author_id,
    authorName: r.users?.name ?? 'Someone', payload: r.payload, createdAt: r.created_at,
    votes: r.card_votes.map((v) => (v.value ? `${v.user_id}:${v.value}` : v.user_id)),
  };
}

const CARD_SELECT = 'id,event_id,type,author_id,payload,created_at,users(name),card_votes(user_id,value)';

export async function listCards(eventId: string): Promise<Card[]> {
  const rows = check(
    await db().from('cards').select(CARD_SELECT).eq('event_id', eventId).order('created_at'),
  ) as unknown as CardDb[];
  return rows.map(mapCard);
}

export async function getCard(id: string): Promise<Card | null> {
  const r = check(await db().from('cards').select(CARD_SELECT).eq('id', id).maybeSingle()) as unknown as CardDb | null;
  return r ? mapCard(r) : null;
}

export async function insertCard(c: { id: string; eventId: string; type: CardType; authorId: string; payload: object }) {
  check(await db().from('cards').insert({
    id: c.id, event_id: c.eventId, type: c.type, author_id: c.authorId, payload: c.payload,
  }));
}

/** Insert-or-ignore: the (card_id,user_id) primary key makes double taps / races harmless. */
export async function addVote(cardId: string, userId: string, value = '') {
  check(await db().from('card_votes').upsert(
    { card_id: cardId, user_id: userId, value },
    { onConflict: 'card_id,user_id' },
  ));
}

export async function removeVote(cardId: string, userId: string) {
  check(await db().from('card_votes').delete().eq('card_id', cardId).eq('user_id', userId));
}

export async function updateCardPayload(id: string, payload: object) {
  check(await db().from('cards').update({ payload }).eq('id', id));
}

// ---- incidents & proposals ----

type IncidentDb = {
  id: string; event_id: string; place_id: string | null; category: Incident['category']; note: string;
  status: IncidentStatus; reporter_id: string; channel_id: string; created_at: string; users: { name: string } | null;
};

const INC_SELECT = 'id,event_id,place_id,category,note,status,reporter_id,channel_id,created_at,users(name)';

function mapIncident(r: IncidentDb): Incident {
  return {
    id: r.id, eventId: r.event_id, placeId: r.place_id, category: r.category, note: r.note, status: r.status,
    reporterId: r.reporter_id, reporterName: r.users?.name ?? 'Someone', channelId: r.channel_id, createdAt: r.created_at,
  };
}

export async function insertIncident(i: Omit<Incident, 'reporterName' | 'createdAt' | 'status'>) {
  check(await db().from('incidents').insert({
    id: i.id, event_id: i.eventId, place_id: i.placeId, category: i.category, note: i.note,
    reporter_id: i.reporterId, channel_id: i.channelId,
  }));
}

export async function getIncident(id: string): Promise<Incident | null> {
  const r = check(await db().from('incidents').select(INC_SELECT).eq('id', id).maybeSingle()) as unknown as IncidentDb | null;
  return r ? mapIncident(r) : null;
}

export async function listIncidents(eventId: string, reporterId?: string): Promise<Incident[]> {
  let q = db().from('incidents').select(INC_SELECT).eq('event_id', eventId).order('created_at', { ascending: false });
  if (reporterId) q = q.eq('reporter_id', reporterId);
  return (check(await q) as unknown as IncidentDb[]).map(mapIncident);
}

export async function setIncidentStatus(id: string, status: IncidentStatus) {
  const extra = status === 'verified' ? { verified_at: new Date().toISOString() }
    : status === 'resolved' ? { resolved_at: new Date().toISOString() } : {};
  check(await db().from('incidents').update({ status, ...extra }).eq('id', id));
}

export async function addAudit(incidentId: string, actorId: string, kind: string, oldV: string | null, newV: string | null) {
  check(await db().from('incident_updates').insert({ incident_id: incidentId, actor_id: actorId, kind, old: oldV, new: newV }));
}

export async function listAudit(incidentId: string) {
  return check(await db().from('incident_updates').select('kind,old,new,created_at,users(name)')
    .eq('incident_id', incidentId).order('created_at')) as unknown as
    { kind: string; old: string | null; new: string | null; created_at: string; users: { name: string } | null }[];
}

type ProposalDb = {
  id: string; incident_id: string; place_id: string; status: Proposal['status']; notice: string; expires_mins: number;
  state: Proposal['state']; source: Proposal['source']; decided_by: string | null; decided_at: string | null;
};

function mapProposal(r: ProposalDb): Proposal {
  return {
    id: r.id, incidentId: r.incident_id, placeId: r.place_id, status: r.status, notice: r.notice,
    expiresMins: r.expires_mins, state: r.state, source: r.source, decidedBy: r.decided_by, decidedAt: r.decided_at,
  };
}

export async function insertProposal(p: Omit<Proposal, 'state' | 'decidedBy' | 'decidedAt'>) {
  check(await db().from('proposals').insert({
    id: p.id, incident_id: p.incidentId, place_id: p.placeId, status: p.status, notice: p.notice,
    expires_mins: p.expiresMins, source: p.source,
  }));
}

export async function getProposal(id: string): Promise<Proposal | null> {
  const r = check(await db().from('proposals').select('*').eq('id', id).maybeSingle()) as ProposalDb | null;
  return r ? mapProposal(r) : null;
}

/** Compare-and-set: only a pending proposal can be decided. Returns false if someone already decided it. */
export async function decideProposal(id: string, state: 'approved' | 'rejected', by: string, notice?: string): Promise<boolean> {
  const r = check(await db().from('proposals')
    .update({ state, decided_by: by, decided_at: new Date().toISOString(), ...(notice ? { notice } : {}) })
    .eq('id', id).eq('state', 'pending').select('id')) as { id: string }[];
  return r.length === 1;
}

// ---- fan club, feedback, activity ----
export async function addOptin(eventId: string, userId: string) {
  check(await db().from('fan_optins').upsert({ event_id: eventId, user_id: userId }, { onConflict: 'event_id,user_id', ignoreDuplicates: true }));
}

export async function fanSummary(eventId: string, userId: string) {
  const [count, mine, rating] = await Promise.all([
    db().from('fan_optins').select('user_id', { count: 'exact', head: true }).eq('event_id', eventId),
    db().from('fan_optins').select('user_id').eq('event_id', eventId).eq('user_id', userId).maybeSingle(),
    db().from('feedback').select('rating').eq('event_id', eventId).eq('user_id', userId).maybeSingle(),
  ]);
  return {
    optins: count.count ?? 0,
    optedIn: !!mine.data,
    myRating: (rating.data as { rating: number } | null)?.rating ?? null,
  };
}

export async function upsertFeedback(eventId: string, userId: string, rating: number, quote?: string) {
  check(await db().from('feedback').upsert({ event_id: eventId, user_id: userId, rating, quote: quote || null }));
}

export async function bumpActivity(eventId: string, userId: string, n: number) {
  const r = await db().rpc('bump_activity', { p_event: eventId, p_user: userId, p_n: n });
  if (r.error) throw new Error(`db: ${r.error.message}`);
}

export async function eventStats(eventId: string) {
  const count = async (table: string, extra?: (q: any) => any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
    let q = db().from(table).select('*', { count: 'exact', head: true }).eq('event_id', eventId);
    if (extra) q = extra(q);
    const r = await q;
    return r.count ?? 0;
  };
  const [joined, chatters, optins, cards, incidentsAll, activity, feedback, incidents] = await Promise.all([
    count('memberships'),
    count('activity', (q) => q.gt('messages', 0)),
    count('fan_optins'),
    count('cards'),
    count('incidents'),
    db().from('activity').select('messages').eq('event_id', eventId),
    db().from('feedback').select('rating,quote,created_at,users(name)').eq('event_id', eventId).order('created_at', { ascending: false }),
    db().from('incidents').select('created_at,verified_at,resolved_at').eq('event_id', eventId),
  ]);
  const messages = ((activity.data ?? []) as { messages: number }[]).reduce((a, r) => a + r.messages, 0);
  const fb = (feedback.data ?? []) as unknown as { rating: number; quote: string | null; users: { name: string } | null }[];
  const mins = ((incidents.data ?? []) as { created_at: string; verified_at: string | null; resolved_at: string | null }[])
    .map((i) => {
      const done = i.verified_at ?? i.resolved_at;
      return done ? (new Date(done).getTime() - new Date(i.created_at).getTime()) / 60000 : null;
    })
    .filter((x): x is number => x !== null)
    .sort((a, b) => a - b);
  return {
    joined, chatters, messages, optins, cards, incidents: incidentsAll,
    medianMinutesToAction: mins.length ? Math.round(mins[Math.floor(mins.length / 2)] * 10) / 10 : null,
    avgRating: fb.length ? Math.round((fb.reduce((a, f) => a + f.rating, 0) / fb.length) * 10) / 10 : null,
    ratings: fb.length,
    quotes: fb.filter((f) => f.quote).slice(0, 12).map((f) => ({ quote: f.quote as string, name: f.users?.name ?? 'Someone', rating: f.rating })),
  };
}
