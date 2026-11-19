import { describe, it, expect } from 'vitest';
import { signSession, readSession } from '@/lib/server/session';
import { roleForCode, channelIdFor } from '@/lib/server/rooms';

const S = 'test-secret-value-1234567890';
const ev = { crewCode: 'crew1', leadCode: 'lead1', artistCode: 'art1' };

describe('session', () => {
  it('round-trips a user id', () => {
    expect(readSession(signSession('u123', S), S)).toBe('u123');
  });
  it('rejects a tampered cookie', () => {
    const c = signSession('u123', S);
    expect(readSession(c.replace('u123', 'u999'), S)).toBeNull();
    expect(readSession(c + 'x', S)).toBeNull();
    expect(readSession(undefined, S)).toBeNull();
    expect(readSession('garbage', S)).toBeNull();
  });
});

describe('roleForCode', () => {
  it('maps codes to roles', () => {
    expect(roleForCode(ev, 'lead1')).toBe('lead');
    expect(roleForCode(ev, 'crew1')).toBe('crew');
    expect(roleForCode(ev, 'art1')).toBe('artist');
    expect(roleForCode(ev, ' CREW1 ')).toBe('crew');
    expect(roleForCode(ev, 'nope')).toBe('attendee');
    expect(roleForCode(ev, undefined)).toBe('attendee');
  });
});

describe('channelIdFor', () => {
  it('is alphanumeric and <= 64 chars', () => {
    const id = channelIdFor('incident', 'ab-cd_ef'.repeat(20));
    expect(id).toMatch(/^[A-Za-z0-9]+$/);
    expect(id.length).toBeLessThanOrEqual(64);
  });
});
