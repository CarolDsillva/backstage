'use client';
import { useRef, useState } from 'react';
import type { ChatMsg } from '@/lib/client/nexconn';
import { postJson, type EventState } from '@/lib/client/useEventState';
import { CardRenderer } from './Cards/CardRenderer';
import { NewCardSheet } from './Cards/NewCardSheet';
import { BS_TYPES } from '@/lib/shared/types';
import { Avatar, AvatarStack } from './ui/Avatar';
import { BellRing, ImagePlus, MessageCircleQuestion, Star, Images, Check } from 'lucide-react';

type Section = 'qa' | 'photos' | 'rate';

/** After the encore: the room becomes the artist's fan club. */
export function FanTab({
  state,
  slug,
  messages,
  onChanged,
  onSendPhoto,
}: {
  state: EventState;
  slug: string;
  messages: ChatMsg[];
  onChanged: () => void;
  onSendPhoto?: (f: File, onProgress: (p: number) => void) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [optinError, setOptinError] = useState('');
  const [asking, setAsking] = useState(false);
  const [section, setSection] = useState<Section>('qa');
  const artist = state.event.artist;

  async function optin() {
    setBusy(true);
    setOptinError('');
    try {
      await postJson('/api/fan', { slug, action: 'optin' });
      onChanged();
    } catch (e) {
      setOptinError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex-1 overflow-y-auto pb-8">
      <div className="px-4">
        {state.fan.optedIn ? (
          <MemberCard name={state.me.name} seed={state.me.userId} artist={artist} members={state.fan.optins} />
        ) : (
          <section className="poster rounded-[1.75rem] p-5">
            <p className="text-sm font-semibold text-white/80">Thank you for tonight</p>
            <h2 className="mt-1 text-3xl font-extrabold leading-tight text-white">Be first in line for {artist}’s next gig</h2>
            <p className="mt-2 text-sm text-white/80">Early access before tickets go public. You’ll hear about it right here.</p>
            <div className="mt-4 flex items-center gap-2 text-sm text-white/85">
              {state.fan.optins > 0 && <AvatarStack names={state.room.faces.slice(0, state.fan.optins)} total={state.fan.optins} size={24} />}
              {state.fan.optins > 0 ? `${state.fan.optins} already in` : 'Be the first one in'}
            </div>
            <button onClick={optin} disabled={busy} className="mt-5 flex h-13 w-full items-center justify-center gap-2 rounded-full bg-spot py-3.5 text-lg font-bold text-ink disabled:opacity-40">
              <BellRing size={20} aria-hidden /> {busy ? 'Adding you…' : 'Join the fan club'}
            </button>
            {optinError && <p role="alert" className="mt-2 text-sm text-white">{optinError}</p>}
          </section>
        )}
      </div>

      <div className="mt-6 flex gap-2 overflow-x-auto px-4" role="tablist" aria-label="Fan club">
        {([
          ['qa', 'Q&A', MessageCircleQuestion],
          ['photos', 'Photos', Images],
          ['rate', 'Rate the night', Star],
        ] as const).map(([id, label, Icon]) => (
          <button
            key={id}
            role="tab"
            aria-selected={section === id}
            onClick={() => setSection(id)}
            className={`flex h-10 shrink-0 items-center gap-1.5 rounded-full px-4 text-sm font-semibold whitespace-nowrap ${section === id ? 'bg-spot text-ink' : 'bg-velvet text-haze'}`}
          >
            <Icon size={16} aria-hidden /> {label}
          </button>
        ))}
      </div>

      <div className="mt-4 px-4">
        {section === 'qa' && <QA state={state} slug={slug} onChanged={onChanged} onAsk={() => setAsking(true)} />}
        {section === 'photos' && <Photos messages={messages} onSendPhoto={onSendPhoto} />}
        {section === 'rate' && <Feedback state={state} slug={slug} onChanged={onChanged} />}
      </div>

      {asking && (
        <NewCardSheet
          state={state}
          slug={slug}
          initialType="question"
          onClose={() => setAsking(false)}
          onPosted={() => { setAsking(false); onChanged(); }}
          onReport={() => setAsking(false)}
        />
      )}
    </div>
  );
}

function MemberCard({ name, seed, artist, members }: { name: string; seed: string; artist: string; members: number }) {
  return (
    <section className="relative overflow-hidden rounded-[1.75rem] bg-gradient-to-br from-spot via-lime-200 to-emerald-300 p-5 text-ink shadow-[0_20px_40px_-20px_rgb(198_243_107/.6)]">
      <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/30 blur-2xl" aria-hidden />
      <div className="relative flex items-start justify-between">
        <span>
          <span className="block text-xs font-bold">FAN CLUB</span>
          <span className="block text-2xl font-extrabold leading-tight">{artist}</span>
        </span>
        <span className="flex items-center gap-1 rounded-full bg-ink px-2.5 py-1 text-xs font-bold text-spot"><Check size={14} aria-hidden /> Member</span>
      </div>
      <div className="relative mt-8 flex items-end justify-between">
        <span className="flex items-center gap-3">
          <Avatar name={name} seed={seed} size={44} />
          <span>
            <span className="block font-extrabold">{name}</span>
            <span className="block text-xs font-semibold opacity-70">First access to the next gig</span>
          </span>
        </span>
        <span className="text-right text-xs font-semibold opacity-70">{members} {members === 1 ? 'member' : 'members'}</span>
      </div>
    </section>
  );
}

function QA({ state, slug, onChanged, onAsk }: { state: EventState; slug: string; onChanged: () => void; onAsk: () => void }) {
  const questions = state.cards
    .filter((c) => c.type === 'question')
    .sort((a, b) => b.votes.length - a.votes.length || a.createdAt.localeCompare(b.createdAt));
  return (
    <>
      <button onClick={onAsk} className="flex w-full items-center gap-3 rounded-[1.5rem] border border-dashed border-line p-4 text-left">
        <span className="grid h-10 w-10 place-items-center rounded-2xl bg-gel/15 text-gel" aria-hidden><MessageCircleQuestion size={20} /></span>
        <span>
          <span className="block font-bold">Ask {state.event.artist} something</span>
          <span className="block text-xs text-haze">The most upvoted questions get answered</span>
        </span>
      </button>
      <div className="mt-3 flex flex-col gap-3">
        {questions.map((q, i) => (
          <div key={q.id} className={i === 0 && q.votes.length > 0 ? 'rounded-[1.75rem] ring-2 ring-spot/40' : ''}>
            <CardRenderer
              msg={{ id: q.id, channelId: '', senderId: q.authorId, senderName: q.authorName, type: BS_TYPES.question, content: { cardId: q.id }, sentAt: 0, mine: false }}
              state={state}
              slug={slug}
              onChanged={onChanged}
            />
          </div>
        ))}
      </div>
    </>
  );
}

function Photos({ messages, onSendPhoto }: { messages: ChatMsg[]; onSendPhoto?: (f: File, onProgress: (p: number) => void) => Promise<void> }) {
  const file = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState('');
  const photos = messages.filter((m) => m.type === 'RC:ImgMsg').reverse();

  async function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f || !onSendPhoto) return;
    setError('');
    setProgress(0);
    try {
      await onSendPhoto(f, setProgress);
    } catch {
      setError('Photo not sent. Try a smaller photo or check your connection.');
    } finally {
      setProgress(null);
    }
  }

  return (
    <>
      {onSendPhoto && (
        <>
          <button
            onClick={() => file.current?.click()}
            disabled={progress !== null}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-spot font-bold text-ink disabled:opacity-50"
          >
            <ImagePlus size={20} aria-hidden /> {progress !== null ? `Uploading… ${Math.round(progress)}%` : 'Add your photo'}
          </button>
          <input ref={file} type="file" accept="image/*" className="hidden" onChange={pick} />
        </>
      )}
      {error && <p role="alert" className="mt-2 text-sm text-gel">{error}</p>}
      {photos.length === 0 ? (
        <p className="mt-3 rounded-[1.5rem] border border-dashed border-line p-4 text-sm text-haze">No photos yet. Be the first to share one from tonight.</p>
      ) : (
        <ul className="mt-3 columns-2 gap-2">
          {photos.map((m) => (
            <li key={m.id} className="relative mb-2 break-inside-avoid overflow-hidden rounded-2xl">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={(m.content.remoteUrl as string) || `data:image/jpeg;base64,${m.content.thumbnailBase64 as string}`}
                alt={`Photo from ${m.senderName}`}
                className="w-full object-cover"
              />
              <span className="absolute bottom-2 left-2 flex items-center gap-1.5 rounded-full bg-black/55 py-0.5 pr-2 pl-0.5 text-xs font-semibold text-white backdrop-blur">
                <Avatar name={m.senderName} seed={m.senderId} size={20} /> {m.senderName}
              </span>
            </li>
          ))}
        </ul>
      )}
    </>
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

  if (sent) {
    return (
      <div className="rounded-[1.5rem] bg-velvet p-5 text-center">
        <p className="flex justify-center gap-1 text-warn" aria-label={`You rated ${rating ?? state.fan.myRating} out of 5`}>
          {[1, 2, 3, 4, 5].map((n) => <Star key={n} size={22} fill={n <= (rating ?? 0) ? 'currentColor' : 'none'} aria-hidden />)}
        </p>
        <p className="mt-2 font-semibold">Thanks for rating the night.</p>
        <p className="text-sm text-haze">It helps make the next one better.</p>
      </div>
    );
  }
  return (
    <form onSubmit={send} className="rounded-[1.5rem] bg-velvet p-5">
      <fieldset>
        <legend className="text-lg font-bold">How was the night?</legend>
        <div className="mt-3 flex justify-between">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setRating(n)}
              aria-pressed={rating === n}
              aria-label={`${n} out of 5`}
              className={`grid h-14 w-14 place-items-center rounded-2xl transition-transform active:scale-90 ${rating !== null && n <= rating ? 'bg-warn/20 text-warn' : 'bg-night text-haze'}`}
            >
              <Star size={26} fill={rating !== null && n <= rating ? 'currentColor' : 'none'} aria-hidden />
            </button>
          ))}
        </div>
      </fieldset>
      <input
        value={quote}
        onChange={(e) => setQuote(e.target.value)}
        maxLength={280}
        placeholder="What was the best part? (optional)"
        aria-label="Your comment"
        className="mt-4 h-12 w-full rounded-2xl border border-line bg-night px-4 outline-none placeholder:text-haze/60 focus:border-spot"
      />
      {error && <p role="alert" className="mt-2 text-xs text-gel">{error}</p>}
      <button disabled={!rating} className="mt-4 h-12 w-full rounded-full bg-spot font-bold text-ink disabled:opacity-40">Send rating</button>
    </form>
  );
}
