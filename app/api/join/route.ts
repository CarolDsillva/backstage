import crypto from 'node:crypto';
import { makeJoin } from '@/lib/server/join';
import * as dbm from '@/lib/server/db';
import { ensureChannel } from '@/lib/server/rooms';
import { issueToken, joinGroup } from '@/lib/server/nexconn';
import { currentUserId, setSessionCookie } from '@/lib/server/auth';
import { errorResponse } from '@/lib/server/http';

/** Run next to the Supabase database (Sydney): every request makes several DB round trips. */
export const preferredRegion = 'syd1';

const join = makeJoin({
  getEvent: dbm.getEventBySlug,
  getUser: dbm.getUser,
  upsertUser: dbm.upsertUser,
  getRole: dbm.getRole,
  setRole: dbm.setRole,
  ensureChannel,
  joinGroup,
  issueToken,
  newId: () => 'u' + crypto.randomUUID().replace(/-/g, '').slice(0, 20),
  openIncidentChannels: dbm.openIncidentChannels,
});

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const result = await join(body, await currentUserId());
    await setSessionCookie(result.userId);
    return Response.json(result);
  } catch (e) {
    return errorResponse(e);
  }
}
