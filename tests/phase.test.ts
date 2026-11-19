import { describe, it, expect } from 'vitest';
import { phaseOf } from '@/lib/shared/phase';

const s = new Date('2026-11-21T18:00:00Z');
const e = new Date('2026-11-21T21:00:00Z');

describe('phaseOf', () => {
  it('before start', () => expect(phaseOf(new Date('2026-11-21T17:59:59Z'), s, e)).toBe('before'));
  it('exactly at start is live', () => expect(phaseOf(s, s, e)).toBe('live'));
  it('exactly at end is after', () => expect(phaseOf(e, s, e)).toBe('after'));
  it('override wins', () => expect(phaseOf(s, s, e, 'after')).toBe('after'));
  it('null override ignored', () => expect(phaseOf(s, s, e, null)).toBe('live'));
});
