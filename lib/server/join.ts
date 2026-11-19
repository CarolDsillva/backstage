import { z } from 'zod';
import type { Role } from '@/lib/shared/types';
import type { EventSecrets } from './db';
import { roleForCode, mergeRole, isStaff, type ContextType } from './rooms';
import { HttpError } from './http';

export const joinInput = z.object({
  slug: z.string().min(1).max(64),
  name: z.string().trim().min(1, 'Name is required').max(32, 'Name must be 32 characters or fewer'),
  code: z.string().max(64).optional(),
});

export type JoinDeps = {
  getEvent(slug: string): Promise<EventSecrets | null>;
  getUser(id: string): Promise<{ id: string; name: string } | null>;
  upsertUser(id: string, name: string): Promise<void>;
  getRole(eventId: string, userId: string): Promise<Role | null>;
  setRole(eventId: string, userId: string, role: Role): Promise<void>;
  ensureChannel(type: ContextType, ctxId: string, name: string, owner: string): Promise<string>;
  joinGroup(channelId: string, userIds: string[]): Promise<void>;
  issueToken(userId: string, name: string): Promise<string>;
  newId(): string;
  /** Nexconn channels of reports that are not resolved yet. */
  openIncidentChannels(eventId: string): Promise<string[]>;
};

export type JoinResult = {
  userId: string;
  name: string;
  role: Role;
  token: string;
  gigChannelId: string;
  crewChannelId: string | null;
};

export function makeJoin(d: JoinDeps) {
  return async (raw: unknown, existingUserId: string | null): Promise<JoinResult> => {
    const parsed = joinInput.safeParse(raw);
    if (!parsed.success) throw new HttpError(400, parsed.error.issues[0].message);
    const { slug, name, code } = parsed.data;

    const ev = await d.getEvent(slug);
    if (!ev) throw new HttpError(404, 'Gig not found');

    // Independent steps run in parallel: each round trip is ~0.4 s on a far-away database.
    const [known, existingRole] = existingUserId
      ? await Promise.all([d.getUser(existingUserId), d.getRole(ev.id, existingUserId)])
      : [null, null];
    const userId = known?.id ?? d.newId();
    const prev = known ? existingRole : null;
    const role = mergeRole(prev, roleForCode(ev, code));
    const staff = isStaff(role);

    const [gigChannelId, crewChannelId, token] = await Promise.all([
      d.ensureChannel('gig', ev.id, ev.title, userId),
      staff ? d.ensureChannel('crew', ev.id, `${ev.title} · Crew`, userId) : Promise.resolve(null),
      d.issueToken(userId, name),
      (async () => {
        await d.upsertUser(userId, name); // the membership row references the user row
        if (role !== prev) await d.setRole(ev.id, userId, role);
      })(),
    ]);

    await Promise.all([
      d.joinGroup(gigChannelId, [userId]),
      crewChannelId ? d.joinGroup(crewChannelId, [userId]) : null,
      // Crew who arrive mid-show must be able to open reports filed before they joined.
      staff ? d.openIncidentChannels(ev.id).then((chs) => Promise.all(chs.map((ch) => d.joinGroup(ch, [userId])))) : null,
    ]);
    return { userId, name, role, token, gigChannelId, crewChannelId };
  };
}
