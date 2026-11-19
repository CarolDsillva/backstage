'use client';
import { useState } from 'react';
import type { ChatMsg } from '@/lib/client/nexconn';
import { postJson, type EventState } from '@/lib/client/useEventState';
import { CardRenderer } from './Cards/CardRenderer';
import { NewCardSheet } from './Cards/NewCardSheet';
import { BS_TYPES } from '@/lib/shared/types';

/** After the encore: the room becomes the artist's fan club. */
export function FanTab({ state, slug, messages, onChanged }: { state: EventState; slug: string; messages: ChatMsg[]; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const [asking, setAsking] = useState(false);
  const photos = messages.filter((m) => m.type === 'RC:ImgMsg');
  const questions = state.cards
    .filter((c) => c.type === 'question')
    .sort((a, b) => b.votes.length - a.votes.length || a.createdAt.localeCompare(b.createdAt));

  async function optin() {
    setBusy(true);
    try {
      await postJson('/api/fan', { slug, action: 'optin' });
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 pt-4 pb-8">
      <section className="rounded-3xl border border-spot/40 bg-spot/10 p-5">
        <h2 className="text-2xl font-bold leading-tight">Be first in line for {state.event.artist}’s next gig</h2>
        <p className="mt-2 text-sm text-haze">
          Get early access before tickets go public. {state.fan.optins} {state.fan.optins === 1 ? 'person has' : 'people have'} joined from tonight.
        </p>
        {state.fan.optedIn ? (
          <p className="mt-4 font-semibold text-spot">You’re on the list. We’ll message you here first.</p>
        ) : (
          <button onClick={optin} disabled={busy} className="mt-4 h-12 w-full rounded-xl bg-spot font-semibold text-ink disabled:opacity-40">
            {busy ? 'Adding you…' : 'Put me on the list'}
          </button>
        )}
      </section>

      <Feedback state={state} slug={slug} onChanged={onChanged} />

      <section className="mt-6">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-semibold">Ask {state.event.artist}</h2>
          <button onClick={() => setAsking(true)} className="text-sm text-spot underline underline-offset-4">Ask a question</button>
        </div>
        {questions.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-line p-4 text-sm text-haze">No questions yet. The most upvoted ones get answered.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {questions.map((q) => (
              <CardRenderer
                key={q.id}
                msg={{ id: q.id, channelId: '', senderId: q.authorId, senderName: q.authorName, type: BS_TYPES.question, content: { cardId: q.id }, sentAt: 0, mine: false }}
                state={state}
                slug={slug}
                onChanged={onChanged}
              />
            ))}
          </div>
        )}
      </section>

      <section className="mt-6">
        <h2 className="mb-2 font-semibold">Photos from tonight</h2>
        {photos.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-line p-4 text-sm text-haze">No photos yet. Share yours from the Room tab with 📷.</p>
        ) : (
          <ul className="grid grid-cols-3 gap-1.5">
            {photos.map((m) => (
              <li key={m.id}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={(m.content.remoteUrl as string) || `data:image/jpeg;base64,${m.content.thumbnailBase64 as string}`}
                  alt={`Photo from ${m.senderName}`}
                  className="aspect-square w-full rounded-lg object-cover"
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      {asking && <NewCardSheet state={state} slug={slug} onClose={() => { setAsking(false); onChanged(); }} onReport={() => setAsking(false)} />}
    </div>
  );
}

function Feedback({ state, slug, onChanged }: { state: EventState; slug: string; onChanged: () => void }) {
  const [rating, setRating] = useState<number | null>(state.fan.myRating);
  const [quote, setQuote] = useState('');
  const [sent, setSent] = useState(state.fan.myRating !== null);
  const [error, setError] = useState('');

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!rating) return;
    setError('');
    try {
      await postJson('/api/fan', { slug, action: 'feedback', rating, quote: quote || undefined });
      setSent(true);
      onChanged();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  if (sent) return <p className="mt-4 rounded-2xl bg-velvet p-4 text-sm text-haze">Thanks for rating the night. It helps the next one.</p>;
  return (
    <form onSubmit={send} className="mt-4 rounded-3xl border border-line bg-velvet p-4">
      <fieldset>
        <legend className="font-semibold">How was the night?</legend>
        <div className="mt-2 flex gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setRating(n)}
              aria-pressed={rating === n}
              aria-label={`${n} out of 5`}
              className={`h-11 flex-1 rounded-xl text-xl ${rating !== null && n <= rating ? 'bg-spot/20 text-spot' : 'bg-night text-haze'}`}
            >
              ★
            </button>
          ))}
        </div>
      </fieldset>
      <input
        value={quote}
        onChange={(e) => setQuote(e.target.value)}
        maxLength={280}
        placeholder="Anything Backstage made easier tonight? (optional)"
        aria-label="Your comment"
        className="mt-3 h-11 w-full rounded-xl border border-line bg-night px-3 outline-none placeholder:text-haze/60 focus:border-spot"
      />
      {error && <p role="alert" className="mt-1 text-xs text-gel">{error}</p>}
      <button disabled={!rating} className="mt-3 h-11 w-full rounded-xl bg-spot font-semibold text-ink disabled:opacity-40">Send rating</button>
    </form>
  );
}
