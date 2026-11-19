import crypto from 'node:crypto';

/** Alphanumeric ids (Nexconn channel/user ids allow only letters and digits). */
export function newId(prefix: string) {
  return prefix + crypto.randomUUID().replace(/-/g, '').slice(0, 20);
}
