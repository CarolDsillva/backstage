import { cookies } from 'next/headers';
import { getEnv } from './env';
import { readSession, signSession, SESSION_COOKIE, SESSION_MAX_AGE } from './session';
import { getEventBySlug, getRole, getUser, type EventSecrets } from './db';
import { HttpError } from './http';
import type { Role } from '@/lib/shared/types';

export async function currentUserId(): Promise<string | null> {
  const jar = await cookies();
  return readSession(jar.get(SESSION_COOKIE)?.value, getEnv().SESSION_SECRET);
}

export async function setSessionCookie(userId: string) {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, signSession(userId, getEnv().SESSION_SECRET), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: SESSION_MAX_AGE,
    path: '/',
  });
}

export type Ctx = { ev: EventSecrets; userId: string; name: string; role: Role };

/** Resolve event + member, or throw 401/403/404. Pass allowed roles to restrict. */
export async function requireMember(slug: string, allowed?: Role[]): Promise<Ctx> {
  const userId = await currentUserId();
  if (!userId) throw new HttpError(401, 'Join the gig first');
  const ev = await getEventBySlug(slug);
  if (!ev) throw new HttpError(404, 'Gig not found');
  const [role, user] = await Promise.all([getRole(ev.id, userId), getUser(userId)]);
  if (!role) throw new HttpError(401, 'Join the gig first');
  if (allowed && !allowed.includes(role)) throw new HttpError(403, 'Not allowed for your role');
  return { ev, userId, name: user?.name ?? 'Someone', role };
}
