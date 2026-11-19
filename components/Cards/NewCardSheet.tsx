'use client';
import { useState } from 'react';
import { Sheet, inputCls, primaryCls } from '../Sheet';
import { postJson, type EventState } from '@/lib/client/useEventState';
import { canCreate } from '@/lib/shared/cards';
import type { CardType } from '@/lib/shared/types';

const OPTIONS: { type: CardType; label: string; hint: string }[] = [
  { type: 'song', label: 'Request a song', hint: 'The crowd votes; the top songs show on the stage screen.' },
  { type: 'meetup', label: 'I’m going solo', hint: 'Let others on their own find you before the doors open.' },
  { type: 'carpool', label: 'Share a ride', hint: 'Offer seats in your car or auto.' },
  { type: 'poll', label: 'Start a poll', hint: 'Ask the room to pick: the opener, the encore, anything.' },
  { type: 'question', label: 'Ask the artist', hint: 'The most upvoted questions get answered.' },
];

export function NewCardSheet({
  state,
  slug,
  onClose,
  onReport,
}: {
  state: EventState;
  slug: string;
  onClose: () => void;
  onReport: () => void;
}) {
  const [type, setType] = useState<CardType | null>(null);
  const available = OPTIONS.filter((o) => canCreate(o.type, state.me.role, state.phase));

  return (
    <Sheet title={type ? OPTIONS.find((o) => o.type === type)!.label : 'Add to the room'} onClose={onClose}>
      {type ? (
        <CardForm type={type} slug={slug} onDone={onClose} onBack={() => setType(null)} />
      ) : (
        <ul className="flex flex-col gap-2">
          {available.map((o) => (
            <li key={o.type}>
              <button onClick={() => setType(o.type)} className="w-full rounded-2xl border border-line bg-night px-4 py-3 text-left">
                <span className="block font-semibold">{o.label}</span>
                <span className="block text-sm text-haze">{o.hint}</span>
              </button>
            </li>
          ))}
          <li>
            <button onClick={onReport} className="w-full rounded-2xl border border-gel/40 bg-gel/10 px-4 py-3 text-left">
              <span className="block font-semibold text-gel">Tell the crew</span>
              <span className="block text-sm text-haze">Lost something, lost your group, or something’s wrong at the venue.</span>
            </button>
          </li>
        </ul>
      )}
    </Sheet>
  );
}

function CardForm({ type, slug, onDone, onBack }: { type: CardType; slug: string; onDone: () => void; onBack: () => void }) {
  const [f, setF] = useState<Record<string, string>>({ seats: '3', o0: '', o1: '', o2: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setF((x) => ({ ...x, [k]: e.target.value }));

  function payload() {
    switch (type) {
      case 'song': return { title: f.title ?? '' };
      case 'meetup': return { note: f.note ?? '' };
      case 'carpool': return { from: f.from ?? '', time: f.time ?? '', seats: Number(f.seats) };
      case 'question': return { text: f.text ?? '' };
      case 'poll': return { question: f.question ?? '', options: [f.o0, f.o1, f.o2].map((o) => o.trim()).filter(Boolean) };
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await postJson('/api/cards', { slug, type, payload: payload() });
      onDone();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      {type === 'song' && <input className={inputCls} placeholder="Song name" maxLength={80} value={f.title ?? ''} onChange={set('title')} aria-label="Song name" required />}
      {type === 'meetup' && <input className={inputCls} placeholder="Optional: where you’ll be, what you’re wearing" maxLength={140} value={f.note ?? ''} onChange={set('note')} aria-label="Note for others going solo" />}
      {type === 'carpool' && (
        <>
          <input className={inputCls} placeholder="Leaving from" maxLength={60} value={f.from ?? ''} onChange={set('from')} aria-label="Leaving from" required />
          <input className={inputCls} placeholder="Leaving at (e.g. 6:30 pm)" maxLength={30} value={f.time ?? ''} onChange={set('time')} aria-label="Leaving at" required />
          <label className="flex items-center justify-between text-sm text-haze">
            Seats free
            <input type="number" min={1} max={8} className={`${inputCls} w-24`} value={f.seats} onChange={set('seats')} />
          </label>
        </>
      )}
      {type === 'question' && <input className={inputCls} placeholder="Your question" maxLength={200} value={f.text ?? ''} onChange={set('text')} aria-label="Your question" required />}
      {type === 'poll' && (
        <>
          <input className={inputCls} placeholder="Question" maxLength={120} value={f.question ?? ''} onChange={set('question')} aria-label="Poll question" required />
          {['o0', 'o1', 'o2'].map((k, i) => (
            <input key={k} className={inputCls} placeholder={i < 2 ? `Option ${i + 1}` : 'Option 3 (optional)'} maxLength={60} value={f[k]} onChange={set(k)} aria-label={`Option ${i + 1}`} required={i < 2} />
          ))}
        </>
      )}
      {error && <p role="alert" className="text-sm text-gel">{error}</p>}
      <button disabled={busy} className={primaryCls}>{busy ? 'Posting…' : 'Post to the room'}</button>
      <button type="button" onClick={onBack} className="text-sm text-haze">Back</button>
    </form>
  );
}
