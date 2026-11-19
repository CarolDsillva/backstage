import crypto from 'node:crypto';

export const SESSION_COOKIE = 'bs_uid';
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30;

function mac(userId: string, secret: string) {
  return crypto.createHmac('sha256', secret).update(userId).digest('base64url');
}

export function signSession(userId: string, secret: string): string {
  return `${userId}.${mac(userId, secret)}`;
}

export function readSession(cookie: string | undefined, secret: string): string | null {
  if (!cookie) return null;
  const dot = cookie.lastIndexOf('.');
  if (dot <= 0) return null;
  const userId = cookie.slice(0, dot);
  const given = Buffer.from(cookie.slice(dot + 1));
  const expected = Buffer.from(mac(userId, secret));
  if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) return null;
  return userId;
}
