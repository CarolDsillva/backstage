import { describe, it, expect, vi } from 'vitest';
import { makeJoin, type JoinDeps } from '@/lib/server/join';
import type { Role } from '@/lib/shared/types';

function deps(overrides: Partial<JoinDeps> = {}) {
  const users = new Map<string, string>();
  const members = new Map<string, Role>();
  const d: JoinDeps = {
    getEvent: async () => ({
      id: 'ev1', slug: 'gig', title: 'Gig', artist: 'A', venue: 'V', startsAt: '', endsAt: '',
      phaseOverride: null, crewCode: 'crew1', leadCode: 'lead1', artistCode: 'art1',
    }),
    getUser: async (id) => (users.has(id) ? { id, name: users.get(id)! } : null),
    upsertUser: vi.fn(async (id, name) => { users.set(id, name); }),
    getRole: async (_e, u) => members.get(u) ?? null,
    setRole: vi.fn(async (_e, u, r) => { members.set(u, r); }),
    ensureChannel: vi.fn(async (t, id) => `${t}${id}`),
    joinGroup: vi.fn(async () => {}),
    issueToken: async (u) => `tok-${u}`,
    newId: (() => { let n = 0; return () => `u${++n}`; })(),
    openIncidentChannels: async () => ['incidentA', 'incidentB'],
    ...overrides,
  };
  return { d, users, members };
}

describe('join', () => {
  it.each(['', '   ', 'x'.repeat(33)])('rejects bad name %j', async (name) => {
    const { d } = deps();
    await expect(makeJoin(d)({ slug: 'gig', name }, null)).rejects.toMatchObject({ status: 400 });
  });

  it('404s on unknown event', async () => {
    const { d } = deps({ getEvent: async () => null });
    await expect(makeJoin(d)({ slug: 'x', name: 'Ann' }, null)).rejects.toMatchObject({ status: 404 });
  });

  it('stores html-looking names verbatim (escaped at render)', async () => {
    const { d, users } = deps();
    const r = await makeJoin(d)({ slug: 'gig', name: ' <b>x</b> ' }, null);
    expect(users.get(r.userId)).toBe('<b>x</b>');
  });

  it('attendee joins gig room only', async () => {
    const { d } = deps();
    const r = await makeJoin(d)({ slug: 'gig', name: 'Ann' }, null);
    expect(r).toMatchObject({ role: 'attendee', gigChannelId: 'gigev1', crewChannelId: null, token: 'tok-u1' });
    expect(d.joinGroup).toHaveBeenCalledWith('gigev1', ['u1']);
  });

  it('crew also joins crew room', async () => {
    const { d } = deps();
    const r = await makeJoin(d)({ slug: 'gig', name: 'Cat', code: 'crew1' }, null);
    expect(r.role).toBe('crew');
    expect(r.crewChannelId).toBe('crewev1');
    expect(d.joinGroup).toHaveBeenCalledWith('crewev1', ['u1']);
  });

  it('rejoin with existing cookie keeps the same user and never downgrades role', async () => {
    const { d, members } = deps();
    const join = makeJoin(d);
    const first = await join({ slug: 'gig', name: 'Lee', code: 'lead1' }, null);
    const again = await join({ slug: 'gig', name: 'Lee' }, first.userId);
    expect(again.userId).toBe(first.userId);
    expect(again.role).toBe('lead');
    expect(members.size).toBe(1);
  });

  it('crew who join late are added to every open report room (review I4)', async () => {
    const { d } = deps();
    await makeJoin(d)({ slug: 'gig', name: 'Cat', code: 'crew1' }, null);
    expect(d.joinGroup).toHaveBeenCalledWith('incidentA', ['u1']);
    expect(d.joinGroup).toHaveBeenCalledWith('incidentB', ['u1']);
  });

  it('attendees are never added to report rooms', async () => {
    const { d } = deps();
    await makeJoin(d)({ slug: 'gig', name: 'Ann' }, null);
    expect(d.joinGroup).not.toHaveBeenCalledWith('incidentA', expect.anything());
  });
});
