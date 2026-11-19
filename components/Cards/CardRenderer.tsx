'use client';
import { useState } from 'react';
import type { ChatMsg } from '@/lib/client/nexconn';
import { postJson, type EventState } from '@/lib/client/useEventState';
import { BS_TYPES, type Card } from '@/lib/shared/types';
import { hasVoted, myPollChoice, pollTally, seatsLeft } from '@/lib/shared/cards';
import { ProposalCard } from './ProposalCard';
import { IncidentCard } from './IncidentCard';

type Props = { msg: ChatMsg; state: EventState; slug: string; onChanged: () => void; refreshKey?: number };

/** Renders a Backstage custom message. Card data always comes from the live event state. */
export function CardRenderer({ msg, state, slug, onChanged, refreshKey = 0 }: Props) {
  const c = msg.content as Record<string, unknown>;
  if (msg.type === BS_TYPES.announce) return <AnnounceCard content={c} state={state} />;
  if (msg.type === BS_TYPES.incident) return <IncidentCard content={c} state={state} />;
  if (msg.type === BS_TYPES.proposal) return <ProposalCard proposalId={c.proposalId as string} slug={slug} state={state} refreshKey={refreshKey} />;

  const card = state.cards.find((x) => x.id === c.cardId);
  if (!card) return <p className="text-center text-xs text-haze">Loading…</p>;
  const props = { card, state, slug, onChanged };
  switch (card.type) {
    case 'song': return <SongCard {...props} />;
    case 'poll': return <PollCard {...props} />;
    case 'meetup': return <MeetupCard {...props} />;
    case 'carpool': return <CarpoolCard {...props} />;
    case 'question': return <QuestionCard {...props} />;
  }
}

type CardProps = { card: Card; state: EventState; slug: string; onChanged: () => void };

function useVote(card: Card, slug: string, onChanged: () => void) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function vote(option?: number) {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await postJson(`/api/cards/${card.id}/vote`, { slug, option });
      onChanged();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return { vote, busy, error };
}

function Byline({ card }: { card: Card }) {
  return <span className="text-xs text-haze">{card.authorName}</span>;
}

function SongCard({ card, state, slug, onChanged }: CardProps) {
  const { vote, busy, error } = useVote(card, slug, onChanged);
  const mine = hasVoted(card, state.me.userId);
  return (
    <div className="mx-auto w-[88%] max-w-sm">
      <div className="setlist flex -rotate-1 items-center gap-3 rounded-sm px-4 py-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs text-ink/60">{card.authorName} wants to hear</p>
          <p className="truncate font-hand text-xl leading-tight">{card.payload.title as string}</p>
        </div>
        <button
          onClick={() => vote()}
          disabled={busy || state.phase !== 'live'}
          aria-pressed={mine}
          aria-label={`${mine ? 'Remove your vote for' : 'Vote for'} ${card.payload.title as string}, ${card.votes.length} votes`}
          className={`flex h-12 min-w-14 flex-col items-center justify-center rounded-lg border-2 font-semibold ${
            mine ? 'border-gel bg-gel text-white' : 'border-ink/30 text-ink'
          } disabled:opacity-50`}
        >
          <span aria-hidden className="text-xs leading-none">▲</span>
          <span className="leading-none">{card.votes.length}</span>
        </button>
      </div>
      {error && <p role="alert" className="mt-1 text-center text-xs text-gel">{error}</p>}
    </div>
  );
}

function PollCard({ card, state, slug, onChanged }: CardProps) {
  const { vote, busy, error } = useVote(card, slug, onChanged);
  const tally = pollTally(card);
  const total = tally.reduce((a, b) => a + b, 0);
  const choice = myPollChoice(card, state.me.userId);
  const options = card.payload.options as string[];
  return (
    <section className="mx-auto w-full max-w-sm rounded-3xl border border-line bg-velvet p-4">
      <Byline card={card} />
      <h3 className="mt-0.5 text-lg font-semibold leading-snug">{card.payload.question as string}</h3>
      <ul className="mt-3 flex flex-col gap-2">
        {options.map((o, i) => {
          const pct = total ? Math.round((tally[i] / total) * 100) : 0;
          return (
            <li key={i}>
              <button
                onClick={() => vote(i)}
                disabled={busy}
                aria-pressed={choice === i}
                className={`relative flex h-11 w-full items-center justify-between overflow-hidden rounded-xl border px-3 text-left ${
                  choice === i ? 'border-spot' : 'border-line'
                }`}
              >
                <span className="absolute inset-y-0 left-0 bg-spot/15 transition-[width] duration-500" style={{ width: `${pct}%` }} aria-hidden />
                <span className="relative">{o}</span>
                <span className="relative text-sm text-haze">{choice !== null ? `${pct}%` : ''}</span>
              </button>
            </li>
          );
        })}
      </ul>
      <p className="mt-2 text-xs text-haze">{total} {total === 1 ? 'vote' : 'votes'}{choice === null ? '. Tap an option to vote.' : '. Tap your choice again to take it back.'}</p>
      {error && <p role="alert" className="mt-1 text-xs text-gel">{error}</p>}
    </section>
  );
}

function MeetupCard({ card, state, slug, onChanged }: CardProps) {
  const { vote, busy, error } = useVote(card, slug, onChanged);
  const joined = hasVoted(card, state.me.userId);
  const people = 1 + card.votes.length;
  return (
    <section className="mx-auto w-full max-w-sm rounded-3xl border border-line bg-velvet p-4">
      <p className="text-sm text-haze">{card.authorName} is going solo</p>
      {card.payload.note ? <p className="mt-1">{card.payload.note as string}</p> : null}
      <p className="mt-2 text-sm">
        {people} {people === 1 ? 'person' : 'people'} so far. Say hi in the room and meet up at the door.
      </p>
      {card.authorId !== state.me.userId && (
        <button
          onClick={() => vote()}
          disabled={busy}
          aria-pressed={joined}
          className={`mt-3 h-11 w-full rounded-xl font-semibold ${joined ? 'border border-line text-haze' : 'bg-spot text-ink'}`}
        >
          {joined ? 'You’re in. Tap to leave' : 'I’m going solo too'}
        </button>
      )}
      {error && <p role="alert" className="mt-1 text-xs text-gel">{error}</p>}
    </section>
  );
}

function CarpoolCard({ card, state, slug, onChanged }: CardProps) {
  const { vote, busy, error } = useVote(card, slug, onChanged);
  const joined = hasVoted(card, state.me.userId);
  const left = seatsLeft(card);
  return (
    <section className="mx-auto w-full max-w-sm rounded-3xl border border-line bg-velvet p-4">
      <p className="text-sm text-haze">{card.authorName} is sharing a ride</p>
      <p className="mt-1 text-lg font-semibold">From {card.payload.from as string}, leaving {card.payload.time as string}</p>
      <p className="mt-1 text-sm">{left === 0 ? 'Full' : `${left} ${left === 1 ? 'seat' : 'seats'} left`}</p>
      {card.authorId !== state.me.userId && (
        <button
          onClick={() => vote()}
          disabled={busy || (!joined && left === 0)}
          aria-pressed={joined}
          className={`mt-3 h-11 w-full rounded-xl font-semibold disabled:opacity-40 ${joined ? 'border border-line text-haze' : 'bg-spot text-ink'}`}
        >
          {joined ? 'You have a seat. Tap to give it up' : left === 0 ? 'Ride is full' : 'Take a seat'}
        </button>
      )}
      {error && <p role="alert" className="mt-1 text-xs text-gel">{error}</p>}
    </section>
  );
}

function QuestionCard({ card, state, slug, onChanged }: CardProps) {
  const { vote, busy, error } = useVote(card, slug, onChanged);
  const [answer, setAnswer] = useState('');
  const [sending, setSending] = useState(false);
  const [answerError, setAnswerError] = useState('');
  const canAnswer = state.me.role === 'artist' || state.me.role === 'lead';
  const mine = hasVoted(card, state.me.userId);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    setAnswerError('');
    try {
      await postJson(`/api/cards/${card.id}/answer`, { slug, text: answer });
      setAnswer('');
      onChanged();
    } catch (e) {
      setAnswerError((e as Error).message);
    } finally {
      setSending(false);
    }
  }

  return (
    <section className="mx-auto w-full max-w-sm rounded-3xl border border-line bg-velvet p-4">
      <div className="flex items-start gap-3">
        <div className="flex-1">
          <p className="text-xs text-haze">{card.authorName} asks {state.event.artist}</p>
          <p className="mt-0.5 font-semibold leading-snug">{card.payload.text as string}</p>
        </div>
        <button
          onClick={() => vote()}
          disabled={busy}
          aria-pressed={mine}
          aria-label={`${mine ? 'Remove upvote' : 'Upvote'}, ${card.votes.length} upvotes`}
          className={`flex h-11 min-w-11 flex-col items-center justify-center rounded-lg border text-sm ${mine ? 'border-spot text-spot' : 'border-line text-haze'}`}
        >
          <span aria-hidden className="text-[10px] leading-none">▲</span>
          {card.votes.length}
        </button>
      </div>
      {card.payload.answer ? (
        <div className="mt-3 rounded-2xl bg-spot/10 p-3">
          <p className="text-xs font-semibold text-spot">{(card.payload.answeredBy as string) ?? state.event.artist} answered</p>
          <p className="mt-0.5">{card.payload.answer as string}</p>
        </div>
      ) : canAnswer ? (
        <form onSubmit={send} className="mt-3 flex gap-2">
          <input
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder="Answer as the artist"
            aria-label="Your answer"
            className="h-10 flex-1 rounded-xl border border-line bg-night px-3 outline-none focus:border-spot"
          />
          <button disabled={sending || !answer.trim()} className="h-10 rounded-xl bg-spot px-3 font-semibold text-ink disabled:opacity-40">Answer</button>
        </form>
      ) : null}
      {(error || answerError) && <p role="alert" className="mt-1 text-xs text-gel">{error || answerError}</p>}
    </section>
  );
}

function AnnounceCard({ content, state }: { content: Record<string, unknown>; state: EventState }) {
  const place = state.places.find((p) => p.id === content.placeId);
  return (
    <section className="mx-auto w-full max-w-sm rounded-3xl border border-warn/50 bg-warn/10 p-4">
      <p className="text-xs font-semibold text-warn">Crew update{place ? `: ${place.name}` : ''}</p>
      <p className="mt-1 font-semibold">{content.notice as string}</p>
      <p className="mt-1 text-xs text-haze">Confirmed by {content.approvedBy as string}</p>
    </section>
  );
}
