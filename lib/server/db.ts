import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getEnv } from './env';
import type { EventRow, Place, Condition, Phase } from '@/lib/shared/types';

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
import type { Role } from '@/lib/shared/types';

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
