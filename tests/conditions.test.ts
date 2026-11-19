import { describe, it, expect } from 'vitest';
import { effectiveCondition } from '@/lib/shared/conditions';
import type { Condition } from '@/lib/shared/types';

const now = new Date('2026-11-21T20:00:00Z');
const base: Condition = {
  placeId: 'bar2', status: 'closed', notice: 'Bar 2 is out of stock — Bar 1 is serving.',
  approvedBy: 'Lee', approvedAt: '2026-11-21T19:30:00Z', expiresAt: '2026-11-21T20:30:00Z',
};

describe('effectiveCondition', () => {
  it('no condition means ok', () => {
    expect(effectiveCondition(undefined, now)).toEqual({ status: 'ok' });
  });
  it('unexpired passes through with provenance', () => {
    expect(effectiveCondition(base, now)).toEqual({
      status: 'closed', notice: base.notice, approvedBy: 'Lee', approvedAt: base.approvedAt,
    });
  });
  it('expired becomes stale and drops the notice', () => {
    const e = effectiveCondition({ ...base, expiresAt: '2026-11-21T19:59:59Z' }, now);
    expect(e.status).toBe('stale');
    expect(e.notice).toBeUndefined();
  });
  it('no expiry never goes stale', () => {
    expect(effectiveCondition({ ...base, expiresAt: null }, now).status).toBe('closed');
  });
  it('an approved ok condition reads as ok', () => {
    expect(effectiveCondition({ ...base, status: 'ok' }, now).status).toBe('ok');
  });
});
