import type { Role } from '@/lib/shared/types';

export type ContextType = 'gig' | 'crew' | 'incident';

export function roleForCode(
  ev: { crewCode: string; leadCode: string; artistCode: string },
  code?: string,
): Role {
  const c = code?.trim().toLowerCase();
  if (!c) return 'attendee';
  if (c === ev.leadCode.toLowerCase()) return 'lead';
  if (c === ev.crewCode.toLowerCase()) return 'crew';
  if (c === ev.artistCode.toLowerCase()) return 'artist';
  return 'attendee';
}

const RANK: Record<Role, number> = { attendee: 0, artist: 1, crew: 2, lead: 3 };

/** Roles only ever upgrade on rejoin. Artist and crew are siblings; keep the higher rank. */
export function mergeRole(existing: Role | null, incoming: Role): Role {
  if (!existing) return incoming;
  return RANK[incoming] > RANK[existing] ? incoming : existing;
}

export function isStaff(role: Role) {
  return role === 'crew' || role === 'lead';
}

export function channelIdFor(type: ContextType, ctxId: string): string {
  return `${type}${ctxId}`.replace(/[^A-Za-z0-9]/g, '').slice(0, 64);
}

import * as dbm from './db';
import * as nx from './nexconn';
import { SYSTEM_USER_ID } from '@/lib/shared/types';

let systemReady: Promise<string> | null = null;

/** Idempotent: one Nexconn group per (type, ctxId), recorded in the channels table. */
export async function ensureChannel(type: ContextType, ctxId: string, name: string, _owner: string) {
  const existing = await dbm.getChannel(type, ctxId);
  if (existing) return existing;
  const channelId = channelIdFor(type, ctxId);
  // System user owns rooms so ownership never depends on who joined first.
  // Issuing a token registers the user; once per server instance is enough.
  systemReady ??= nx.issueToken(SYSTEM_USER_ID, 'Backstage').catch((e) => { systemReady = null; throw e; });
  await systemReady;
  await nx.createGroup(channelId, name, SYSTEM_USER_ID, []); // callers join members explicitly
  await dbm.saveChannel(type, ctxId, channelId);
  return channelId;
}
