import { describe, it, expect, vi } from 'vitest';
import { makeDecide, type DecideDeps } from '@/lib/server/decide';
import type { Incident, Proposal, Role } from '@/lib/shared/types';

const proposal: Proposal = {
  id: 'p1', incidentId: 'inc1', placeId: 'bar2', status: 'limited', notice: 'Bar 2 is dry. Bar 1 is serving.',
  expiresMins: 60, state: 'pending', source: 'ai', decidedBy: null, decidedAt: null,
};
const incident: Incident = {
  id: 'inc1', eventId: 'ev1', placeId: 'bar2', category: 'place_problem', note: 'no water', status: 'checking',
  reporterId: 'u1', reporterName: 'Ann', channelId: 'incidentinc1', createdAt: '',
};

function deps(over: Partial<DecideDeps> = {}) {
  let p = { ...proposal };
  const d: DecideDeps = {
    getProposal: async () => p,
    getIncident: async () => incident,
    decide: vi.fn(async (_id, state, by) => {
      if (p.state !== 'pending') return false;
      p = { ...p, state, decidedBy: by };
      return true;
    }),
    upsertCondition: vi.fn(async () => {}),
    setIncidentStatus: vi.fn(async () => {}),
    addAudit: vi.fn(async () => {}),
    announce: vi.fn(async () => {}),
    signalRooms: vi.fn(async () => {}),
    now: () => new Date('2026-11-21T20:00:00Z'),
    ...over,
  };
  return d;
}

const ctx = (role: Role) => ({ eventId: 'ev1', userId: 'lead1', name: 'Lee', role });

describe('decide proposal', () => {
  it('a crew member cannot approve', async () => {
    const d = deps();
    await expect(makeDecide(d)(ctx('crew'), 'p1', 'approve')).rejects.toMatchObject({ status: 403 });
    expect(d.upsertCondition).not.toHaveBeenCalled();
  });

  it('lead approval writes condition, verifies incident, audits and announces', async () => {
    const d = deps();
    const r = await makeDecide(d)(ctx('lead'), 'p1', 'approve', 'Bar 2 is out of water. Use Bar 1.');
    expect(r).toEqual({ state: 'approved', changed: true });
    expect(d.upsertCondition).toHaveBeenCalledWith('ev1', {
      placeId: 'bar2', status: 'limited', notice: 'Bar 2 is out of water. Use Bar 1.', approvedBy: 'Lee',
      approvedAt: '2026-11-21T20:00:00.000Z', expiresAt: '2026-11-21T21:00:00.000Z',
    });
    expect(d.setIncidentStatus).toHaveBeenCalledWith('inc1', 'verified');
    expect(d.addAudit).toHaveBeenCalledWith('inc1', 'lead1', 'approved_update', null, 'bar2:limited');
    expect(d.announce).toHaveBeenCalledTimes(1);
  });

  it('approving twice is a no-op the second time', async () => {
    const d = deps();
    const decide = makeDecide(d);
    await decide(ctx('lead'), 'p1', 'approve');
    const again = await decide(ctx('lead'), 'p1', 'approve');
    expect(again).toEqual({ state: 'approved', changed: false });
    expect(d.announce).toHaveBeenCalledTimes(1);
  });

  it('reject writes no condition and no announcement', async () => {
    const d = deps();
    expect(await makeDecide(d)(ctx('lead'), 'p1', 'reject')).toEqual({ state: 'rejected', changed: true });
    expect(d.upsertCondition).not.toHaveBeenCalled();
    expect(d.announce).not.toHaveBeenCalled();
    expect(d.addAudit).toHaveBeenCalledWith('inc1', 'lead1', 'rejected_update', null, 'bar2:limited');
  });

  it('a proposal from another event is not found', async () => {
    const d = deps({ getIncident: async () => ({ ...incident, eventId: 'other' }) });
    await expect(makeDecide(d)(ctx('lead'), 'p1', 'approve')).rejects.toMatchObject({ status: 404 });
  });

  it('an approved "ok" update resolves the incident instead of verifying it', async () => {
    const d = deps({ getProposal: async () => ({ ...proposal, status: 'ok' }) });
    await makeDecide(d)(ctx('lead'), 'p1', 'approve');
    expect(d.setIncidentStatus).toHaveBeenCalledWith('inc1', 'resolved');
  });
});
