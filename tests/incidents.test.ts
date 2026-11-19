import { describe, it, expect } from 'vitest';
import { canTransition, attendeeLabel, incidentInput } from '@/lib/shared/incidents';

describe('canTransition', () => {
  it('crew can pick up and resolve, only leads verify', () => {
    expect(canTransition('new', 'checking', 'crew')).toBe(true);
    expect(canTransition('new', 'checking', 'lead')).toBe(true);
    expect(canTransition('checking', 'verified', 'crew')).toBe(false);
    expect(canTransition('checking', 'verified', 'lead')).toBe(true);
    expect(canTransition('verified', 'resolved', 'crew')).toBe(true);
    expect(canTransition('new', 'resolved', 'crew')).toBe(true);
  });
  it('attendees and artists cannot change status', () => {
    for (const to of ['checking', 'verified', 'resolved'] as const) {
      expect(canTransition('new', to, 'attendee')).toBe(false);
      expect(canTransition('new', to, 'artist')).toBe(false);
    }
  });
  it('no-op and backwards moves are refused, except reopening', () => {
    expect(canTransition('checking', 'checking', 'lead')).toBe(false);
    expect(canTransition('verified', 'new', 'lead')).toBe(false);
    expect(canTransition('resolved', 'checking', 'crew')).toBe(true);
  });
});

describe('attendeeLabel', () => {
  it('uses plain language', () => {
    expect(attendeeLabel('new')).toBe('Report received');
    expect(attendeeLabel('checking')).toBe('Crew is checking');
    expect(attendeeLabel('verified')).toBe('Crew confirmed');
    expect(attendeeLabel('resolved')).toBe('Sorted');
  });
});

describe('incidentInput', () => {
  it('requires a known category and caps the note', () => {
    expect(incidentInput.safeParse({ slug: 'g', category: 'place_problem', placeId: 'bar2', note: 'No water' }).success).toBe(true);
    expect(incidentInput.safeParse({ slug: 'g', category: 'fire', note: 'x' }).success).toBe(false);
    expect(incidentInput.safeParse({ slug: 'g', category: 'help', note: 'x'.repeat(501) }).success).toBe(false);
    expect(incidentInput.safeParse({ slug: 'g', category: 'help', note: '  ' }).success).toBe(false);
  });
});
