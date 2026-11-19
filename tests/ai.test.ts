import { describe, it, expect } from 'vitest';
import { draftProposal, parseDraft } from '@/lib/server/ai';
import type { Incident, Place } from '@/lib/shared/types';

const places: Place[] = [
  { id: 'bar1', name: 'Bar 1', kind: 'bar', x: 0, y: 0 },
  { id: 'bar2', name: 'Bar 2', kind: 'bar', x: 0, y: 0 },
];
const incident: Incident = {
  id: 'inc1', eventId: 'e', placeId: 'bar2', category: 'place_problem', note: 'No water left',
  status: 'checking', reporterId: 'u', reporterName: 'Ann', channelId: 'c', createdAt: '',
};
const input = { incident, place: places[1], places, messages: [{ name: 'Cat', text: 'Confirmed, bar 2 is dry' }] };

describe('draftProposal', () => {
  it('uses a valid AI draft', async () => {
    const gen = async () => JSON.stringify({ placeId: 'bar2', status: 'limited', notice: 'Bar 2 is out of water. Bar 1 is serving.', expiresMins: 45 });
    expect(await draftProposal(input, gen)).toEqual({
      placeId: 'bar2', status: 'limited', notice: 'Bar 2 is out of water. Bar 1 is serving.', expiresMins: 45, source: 'ai',
    });
  });
  it('falls back on malformed output', async () => {
    const r = await draftProposal(input, async () => 'sure! here is json: {oops');
    expect(r.source).toBe('fallback');
    expect(r.placeId).toBe('bar2');
    expect(r.notice).toBe('Bar 2: crew update — please follow staff directions.');
    expect(r.expiresMins).toBe(60);
  });
  it('falls back on an unknown place', async () => {
    const gen = async () => JSON.stringify({ placeId: 'moon', status: 'closed', notice: 'x', expiresMins: 30 });
    expect((await draftProposal(input, gen)).source).toBe('fallback');
  });
  it('falls back when generation throws (no key, timeout)', async () => {
    const r = await draftProposal(input, async () => { throw new Error('no key'); });
    expect(r.source).toBe('fallback');
  });
  it('clamps notice length and expiry', () => {
    const d = parseDraft(JSON.stringify({ placeId: 'bar1', status: 'closed', notice: 'x'.repeat(300), expiresMins: 9999 }), places);
    expect(d?.notice.length).toBeLessThanOrEqual(140);
    expect(d?.expiresMins).toBe(240);
  });
  it('falls back to the first place when the incident has none', async () => {
    const r = await draftProposal({ ...input, incident: { ...incident, placeId: null }, place: null }, async () => 'bad');
    expect(r.placeId).toBe('bar1');
    expect(r.notice).toBe('Crew update — please follow staff directions.');
  });
});
