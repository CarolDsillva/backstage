import { z } from 'zod';
import type { Card, CardType, Phase, Role } from './types';

/** Votes are userIds, or "userId:optionIndex" for polls. */
export function toggleVote(votes: string[], vote: string, opts: { single?: boolean } = {}): string[] {
  if (votes.includes(vote)) return votes.filter((v) => v !== vote);
  if (opts.single) {
    const user = vote.split(':')[0];
    return [...votes.filter((v) => v.split(':')[0] !== user), vote];
  }
  return [...votes, vote];
}

export function songQueue(cards: Card[]): Card[] {
  return cards
    .filter((c) => c.type === 'song')
    .sort((a, b) => b.votes.length - a.votes.length || a.createdAt.localeCompare(b.createdAt));
}

export function seatsLeft(card: Card): number {
  return Math.max(0, Number(card.payload.seats ?? 0) - card.votes.length);
}

export function pollTally(card: Card): number[] {
  const options = (card.payload.options as string[] | undefined) ?? [];
  const counts = options.map(() => 0);
  for (const v of card.votes) {
    const i = Number(v.split(':')[1]);
    if (Number.isInteger(i) && i >= 0 && i < counts.length) counts[i]++;
  }
  return counts;
}

export function myPollChoice(card: Card, userId: string): number | null {
  const v = card.votes.find((x) => x.split(':')[0] === userId);
  return v ? Number(v.split(':')[1]) : null;
}

export function hasVoted(card: Card, userId: string) {
  return card.votes.some((v) => v.split(':')[0] === userId);
}

const PHASES: Record<CardType, Phase[]> = {
  poll: ['before', 'live', 'after'],
  song: ['live'],
  meetup: ['before', 'live'],
  carpool: ['before', 'live'],
  question: ['after'],
};

export function canCreate(type: CardType, role: Role, phase: Phase): boolean {
  if (!PHASES[type].includes(phase)) return false;
  if (type === 'poll') return role === 'lead' || role === 'artist';
  return true;
}

const text = (max: number) => z.string().trim().min(1).max(max);

export const cardInput = z.discriminatedUnion('type', [
  z.object({ type: z.literal('poll'), payload: z.object({ question: text(120), options: z.array(text(60)).min(2).max(6) }) }),
  z.object({ type: z.literal('song'), payload: z.object({ title: text(80) }) }),
  z.object({ type: z.literal('meetup'), payload: z.object({ note: z.string().trim().max(140).default('') }) }),
  z.object({
    type: z.literal('carpool'),
    payload: z.object({ from: text(60), time: text(30), seats: z.number().int().min(1).max(8) }),
  }),
  z.object({ type: z.literal('question'), payload: z.object({ text: text(200) }) }),
]);

export type CardInput = z.infer<typeof cardInput>;

export const CARD_TITLE: Record<CardType, string> = {
  poll: 'Poll',
  song: 'Song request',
  meetup: 'Going solo',
  carpool: 'Ride share',
  question: 'Question for the artist',
};

export type VoteDecision =
  | { action: 'add'; value: string }
  | { action: 'remove' }
  | { error: 400 | 409; message: string };

/** What a tap on a card means for this user. Repeats are safe: add is an upsert. */
export function decideVote(card: Card, userId: string, option?: number): VoteDecision {
  if (card.type === 'poll') {
    const n = ((card.payload.options as unknown[]) ?? []).length;
    if (option === undefined || !Number.isInteger(option) || option < 0 || option >= n) {
      return { error: 400, message: 'Pick one of the options.' };
    }
    return myPollChoice(card, userId) === option ? { action: 'remove' } : { action: 'add', value: String(option) };
  }
  if (hasVoted(card, userId)) return { action: 'remove' };
  if (card.type === 'carpool' && seatsLeft(card) === 0) return { error: 409, message: 'This ride is full.' };
  return { action: 'add', value: '' };
}
