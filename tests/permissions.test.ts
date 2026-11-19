import { describe, it, expect } from 'vitest';
import { can } from '@/lib/shared/permissions';

describe('can', () => {
  it('only leads change phase, approve updates and see stats', () => {
    for (const a of ['phase', 'approveUpdate', 'stats'] as const) {
      expect(can('lead', a)).toBe(true);
      expect(can('crew', a)).toBe(false);
      expect(can('attendee', a)).toBe(false);
      expect(can('artist', a)).toBe(false);
    }
  });
  it('crew and leads use the crew console and propose updates', () => {
    for (const a of ['crewConsole', 'proposeUpdate', 'updateIncident'] as const) {
      expect(can('crew', a)).toBe(true);
      expect(can('lead', a)).toBe(true);
      expect(can('attendee', a)).toBe(false);
    }
  });
  it('polls are created by lead or artist', () => {
    expect(can('artist', 'createPoll')).toBe(true);
    expect(can('lead', 'createPoll')).toBe(true);
    expect(can('crew', 'createPoll')).toBe(false);
    expect(can('attendee', 'createPoll')).toBe(false);
  });
});
