import { describe, it, expect } from 'vitest';
import { toggleVote, songQueue, seatsLeft, canCreate, pollTally, cardInput, myPollChoice } from '@/lib/shared/cards';
import type { Card } from '@/lib/shared/types';

function card(p: Partial<Card>): Card {
  return {
    id: 'c', eventId: 'e', type: 'song', authorId: 'a', authorName: 'A', payload: {},
    createdAt: '2026-11-21T19:00:00Z', votes: [], ...p,
  };
}

describe('toggleVote', () => {
  it('toggles twice back to not voted', () => {
    expect(toggleVote(toggleVote([], 'u1'), 'u1')).toEqual([]);
  });
  it('single-choice poll replaces the previous option', () => {
    expect(toggleVote(['u1:0', 'u2:1'], 'u1:2', { single: true })).toEqual(['u2:1', 'u1:2']);
  });
  it('single-choice: same option again removes it', () => {
    expect(toggleVote(['u1:0'], 'u1:0', { single: true })).toEqual([]);
  });
});

describe('songQueue', () => {
  it('sorts by votes desc, ties by earlier request', () => {
    const q = songQueue([
      card({ id: 'late', votes: ['a', 'b'], createdAt: '2026-11-21T19:05:00Z' }),
      card({ id: 'early', votes: ['c', 'd'], createdAt: '2026-11-21T19:01:00Z' }),
      card({ id: 'top', votes: ['a', 'b', 'c'] }),
      card({ id: 'poll', type: 'poll', votes: ['x', 'y', 'z', 'w'] }),
    ]);
    expect(q.map((c) => c.id)).toEqual(['top', 'early', 'late']);
  });
});

describe('seatsLeft', () => {
  it('never goes below zero', () => {
    expect(seatsLeft(card({ type: 'carpool', payload: { seats: 2 }, votes: ['a', 'b', 'c'] }))).toBe(0);
    expect(seatsLeft(card({ type: 'carpool', payload: { seats: 3 }, votes: ['a'] }))).toBe(2);
  });
});

describe('canCreate', () => {
  it('enforces role and phase', () => {
    expect(canCreate('song', 'attendee', 'before')).toBe(false);
    expect(canCreate('song', 'attendee', 'live')).toBe(true);
    expect(canCreate('poll', 'attendee', 'before')).toBe(false);
    expect(canCreate('poll', 'artist', 'before')).toBe(true);
    expect(canCreate('question', 'attendee', 'live')).toBe(false);
    expect(canCreate('question', 'attendee', 'after')).toBe(true);
    expect(canCreate('meetup', 'attendee', 'before')).toBe(true);
    expect(canCreate('carpool', 'attendee', 'after')).toBe(false);
  });
});

describe('pollTally', () => {
  it('counts votes per option', () => {
    const c = card({ type: 'poll', payload: { options: ['A', 'B', 'C'] }, votes: ['u1:0', 'u2:2', 'u3:2'] });
    expect(pollTally(c)).toEqual([1, 0, 2]);
    expect(myPollChoice(c, 'u2')).toBe(2);
    expect(myPollChoice(c, 'nobody')).toBeNull();
  });
});

describe('cardInput', () => {
  it('validates payloads per type', () => {
    expect(cardInput.safeParse({ type: 'song', payload: { title: 'Tum Se' } }).success).toBe(true);
    expect(cardInput.safeParse({ type: 'song', payload: { title: '' } }).success).toBe(false);
    expect(cardInput.safeParse({ type: 'poll', payload: { question: 'Opener?', options: ['A'] } }).success).toBe(false);
    expect(cardInput.safeParse({ type: 'poll', payload: { question: 'Opener?', options: ['A', 'B'] } }).success).toBe(true);
    expect(cardInput.safeParse({ type: 'carpool', payload: { from: 'Bandra', time: '7pm', seats: 0 } }).success).toBe(false);
    expect(cardInput.safeParse({ type: 'carpool', payload: { from: 'Bandra', time: '7pm', seats: 3 } }).success).toBe(true);
  });
});

import { decideVote } from '@/lib/shared/cards';

describe('decideVote', () => {
  it('adds then removes for songs', () => {
    expect(decideVote(card({}), 'u1')).toEqual({ action: 'add', value: '' });
    expect(decideVote(card({ votes: ['u1'] }), 'u1')).toEqual({ action: 'remove' });
  });
  it('rejects joining a full ride but allows leaving it', () => {
    const full = card({ type: 'carpool', payload: { seats: 1 }, votes: ['u9'] });
    expect(decideVote(full, 'u1')).toEqual({ error: 409, message: 'This ride is full.' });
    expect(decideVote({ ...full, votes: ['u1'] }, 'u1')).toEqual({ action: 'remove' });
  });
  it('poll needs a valid option and switches choice', () => {
    const p = card({ type: 'poll', payload: { options: ['A', 'B'] }, votes: ['u1:0'] });
    expect(decideVote(p, 'u1')).toMatchObject({ error: 400 });
    expect(decideVote(p, 'u1', 5)).toMatchObject({ error: 400 });
    expect(decideVote(p, 'u1', 1)).toEqual({ action: 'add', value: '1' });
    expect(decideVote(p, 'u1', 0)).toEqual({ action: 'remove' });
  });
});
