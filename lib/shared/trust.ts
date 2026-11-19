import { SYSTEM_USER_ID } from './types';

const USER_TYPES = new Set(['RC:TxtMsg', 'RC:ImgMsg']);

/**
 * Backstage cards (BS:*) are only ever posted by the server. Anything with a BS:
 * type from another sender is forged (e.g. sent from devtools) and is not shown.
 */
export function isRenderable(m: { type: string; senderId: string }): boolean {
  if (USER_TYPES.has(m.type)) return true;
  if (m.type.startsWith('BS:')) return m.senderId === SYSTEM_USER_ID;
  return false;
}
