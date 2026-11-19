'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { postJson } from '@/lib/client/useEventState';
import { Poster } from './ui/Poster';
import { AvatarStack } from './ui/Avatar';
import type { EventRow, Phase } from '@/lib/shared/types';

type Preview = { event: EventRow; phase: Phase; people: number; faces: string[] };

function when(e: EventRow) {
  const s = new Date(e.startsAt);
  return `${s.toLocaleDateString('en', { weekday: 'short', day: 'numeric', month: 'short' })} · ${s.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
}

/** Attendee front door: poster, who's here, one tap to join. */
export function JoinScreen({ slug, onJoined }: { slug: string; onJoined: (token?: string) => void }) {
  const [preview, setPreview] = useState<Preview | null>(null);
  const [sheet, setSheet] = useState(false);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch(`/api/event/${slug}/preview`).then((r) => (r.ok ? r.json() : null)).then(setPreview).catch(() => {});
  }, [slug]);

  useEffect(() => {
    if (sheet) setTimeout(() => input.current?.focus(), 50);
  }, [sheet]);

  async function join(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const r = await postJson<{ token: string }>('/api/join', { slug, name, as: 'audience' });
      onJoined(r.token);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  const ev = preview?.event;
  return (
    <main className="flex min-h-dvh flex-col bg-night">
      <Poster
        artist={ev?.artist ?? 'Backstage'}
        title={ev?.title ?? ''}
        startsAt={ev?.startsAt ?? new Date().toISOString()}
        phase={preview?.phase ?? 'before'}
        className="rise min-h-[60dvh] rounded-b-[2.5rem] pt-[max(1.25rem,env(safe-area-inset-top))]"
      >
        <p className="mt-3 text-sm text-white/80">{ev ? `${ev.venue} · ${when(ev)}` : 'Loading the gig…'}</p>
      </Poster>

      <section className="rise flex flex-1 flex-col px-6 pt-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]" style={{ animationDelay: '120ms' }}>
        <div className="flex items-center gap-3">
          {preview && preview.people > 0 ? (
            <>
              <AvatarStack names={preview.faces} total={preview.people} />
              <p className="text-sm text-haze">
                <span className="font-semibold text-mist">{preview.people}</span> {preview.people === 1 ? 'person is' : 'people are'} in the room
              </p>
            </>
          ) : (
            <p className="text-sm text-haze">Be the first one in the room.</p>
          )}
        </div>

        <ul className="mt-5 grid grid-cols-3 gap-2 text-center text-xs text-haze">
          <li className="rounded-2xl bg-velvet px-2 py-3"><span className="block text-lg">🙌</span>Meet people going solo</li>
          <li className="rounded-2xl bg-velvet px-2 py-3"><span className="block text-lg">🎶</span>Vote the songs</li>
          <li className="rounded-2xl bg-velvet px-2 py-3"><span className="block text-lg">🛟</span>Reach the crew</li>
        </ul>

        <button onClick={() => setSheet(true)} className="mt-auto h-14 rounded-full bg-spot text-lg font-bold text-ink shadow-[0_10px_30px_-10px_rgb(198_243_107/.6)]">
          Join the room
        </button>
        <Link href={`/e/${slug}/crew`} className="mt-4 text-center text-sm text-haze underline-offset-4 hover:underline">
          Working tonight? Crew check-in
        </Link>
      </section>

      {sheet && (
        <div className="fixed inset-0 z-40 flex flex-col justify-end bg-black/60" onClick={() => !busy && setSheet(false)}>
          <form
            onSubmit={join}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Join the room"
            className="rise rounded-t-[2rem] bg-velvet px-6 pt-3 pb-[max(1.5rem,env(safe-area-inset-bottom))]"
          >
            <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-line" aria-hidden />
            <h2 className="text-2xl font-bold">What should people call you?</h2>
            <p className="mt-1 text-sm text-haze">Just a first name is fine. No password, no app to install.</p>
            <input
              ref={input}
              aria-label="Your name"
              autoComplete="nickname"
              maxLength={32}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              className="mt-5 h-14 w-full rounded-2xl border border-line bg-night px-4 text-lg text-mist outline-none placeholder:text-haze/60 focus:border-spot"
            />
            {error && <p role="alert" className="mt-2 text-sm text-gel">{error}</p>}
            <button disabled={busy || !name.trim()} className="mt-4 h-14 w-full rounded-full bg-spot text-lg font-bold text-ink disabled:opacity-40">
              {busy ? 'Getting you in…' : 'Let’s go'}
            </button>
          </form>
        </div>
      )}
    </main>
  );
}
