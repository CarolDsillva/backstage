'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { postJson } from '@/lib/client/useEventState';
import type { EventRow, Role } from '@/lib/shared/types';

type Step = 'code' | 'name' | 'done';

/** Crew front door: a backstage pass, not a fan poster. Code first, then name. */
export function CrewCheckIn({ slug, knownName, onDone, instant }: { slug: string; knownName?: string; onDone: (role: Role, token?: string) => void; instant?: boolean }) {
  const [step, setStep] = useState<Step>('code');
  const [code, setCode] = useState('');
  const [name, setName] = useState(knownName ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ role: Role; token?: string } | null>(null);
  const [event, setEvent] = useState<EventRow | null>(null);
  const field = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch(`/api/event/${slug}/preview`).then((r) => (r.ok ? r.json() : null)).then((d) => d && setEvent(d.event)).catch(() => {});
  }, [slug]);
  useEffect(() => field.current?.focus(), [step]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (step === 'code') {
      if (!code.trim()) return;
      if (knownName) return void checkIn(knownName);
      return setStep('name');
    }
    void checkIn(name);
  }

  async function checkIn(n: string) {
    setBusy(true);
    try {
      const r = await postJson<{ role: Role; token: string }>('/api/join', { slug, name: n, code: code.trim(), as: 'crew' });
      if (instant) return onDone(r.role, r.token); // the crew app shows its own team picker + demo next
      setResult({ role: r.role, token: r.token });
      setStep('done');
    } catch (err) {
      setError((err as Error).message);
      setStep('code');
    } finally {
      setBusy(false);
    }
  }

  const roleLabel = result?.role === 'lead' ? 'Lead' : result?.role === 'artist' ? 'Artist' : 'Crew';

  return (
    <main className="flex min-h-dvh flex-col bg-[#0b0a10] px-6 pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      <div className="flex items-center justify-between">
        <span className="rounded-md bg-spot px-2 py-1 text-xs font-extrabold tracking-wide text-ink">CREW</span>
        <Link href={`/e/${slug}`} className="text-sm text-haze">Audience view</Link>
      </div>

      {/* The pass */}
      <div className="rise mt-6 overflow-hidden rounded-[1.75rem] border border-line bg-velvet">
        <div className="h-3 bg-[repeating-linear-gradient(135deg,#B9A2FF_0_12px,#0b0a10_12px_24px)]" aria-hidden />
        <div className="p-5">
          <p className="text-sm text-haze">Backstage pass</p>
          <p className="mt-1 text-2xl font-extrabold leading-tight">{event?.title ?? 'Tonight’s gig'}</p>
          <p className="mt-1 text-sm text-haze">{event?.venue ?? ''}</p>
          {step === 'done' && (
            <p className="mt-4 inline-flex items-center gap-2 rounded-full bg-spot/15 px-3 py-1.5 text-sm font-bold text-spot">
              ✓ On as {roleLabel}{name ? `, ${name}` : ''}
            </p>
          )}
        </div>
      </div>

      {step !== 'done' ? (
        <form onSubmit={submit} className="rise mt-8 flex flex-1 flex-col" key={step}>
          <p className="text-sm text-haze">Step {step === 'code' ? 1 : 2} of 2</p>
          <h1 className="mt-1 text-3xl font-extrabold tracking-tight">{step === 'code' ? 'Enter tonight’s crew code' : 'What’s your name?'}</h1>
          <p className="mt-2 text-haze">
            {step === 'code' ? 'Your lead shares it before doors open. It decides whether you’re on as crew or lead.' : 'The audience sees this when you reply to their reports.'}
          </p>
          <input
            ref={field}
            aria-label={step === 'code' ? 'Crew code' : 'Your name'}
            value={step === 'code' ? code : name}
            onChange={(e) => (step === 'code' ? setCode(e.target.value) : setName(e.target.value))}
            autoCapitalize="none"
            autoComplete={step === 'code' ? 'off' : 'nickname'}
            maxLength={step === 'code' ? 64 : 32}
            placeholder={step === 'code' ? 'crew-xxxx-0000' : 'Your name'}
            className={`mt-6 h-16 w-full rounded-2xl border bg-velvet px-4 text-xl text-mist outline-none placeholder:text-haze/50 focus:border-spot ${step === 'code' ? 'font-mono tracking-wider' : ''} ${error ? 'border-gel' : 'border-line'}`}
          />
          {error && <p role="alert" className="mt-2 text-sm text-gel">{error}</p>}
          <button
            disabled={busy || !(step === 'code' ? code.trim() : name.trim())}
            className="mt-auto h-14 rounded-full bg-spot text-lg font-bold text-ink disabled:opacity-40"
          >
            {busy ? 'Checking you in…' : step === 'code' ? 'Continue' : 'Check in'}
          </button>
        </form>
      ) : (
        <section className="rise mt-8 flex flex-1 flex-col">
          <h1 className="text-3xl font-extrabold tracking-tight">How tonight works</h1>
          <ol className="mt-5 flex flex-col gap-3">
            {[
              ['A report comes in', 'Someone in the audience taps Help. You get a private room with them.'],
              ['Talk it through', 'Ask what you need to know. Go check it out.'],
              ['Draft the update', 'One tap writes the notice for the audience from your chat.'],
              [result?.role === 'lead' ? 'You approve it' : 'A lead approves it', 'Only then does the map and every phone in the room change.'],
            ].map(([t, b], i) => (
              <li key={t} className="flex gap-4 rounded-2xl bg-velvet p-4">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-spot font-bold text-ink">{i + 1}</span>
                <span>
                  <span className="block font-bold">{t}</span>
                  <span className="block text-sm text-haze">{b}</span>
                </span>
              </li>
            ))}
          </ol>
          <button onClick={() => result && onDone(result.role, result.token)} className="mt-auto h-14 rounded-full bg-spot text-lg font-bold text-ink">
            Open the crew console
          </button>
        </section>
      )}
    </main>
  );
}
