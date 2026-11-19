'use client';
import { useState } from 'react';
import { postJson } from '@/lib/client/useEventState';

export function JoinScreen({ slug, title, onJoined }: { slug: string; title?: string; onJoined: () => void }) {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [showCode, setShowCode] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function join(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await postJson('/api/join', { slug, name, code: code || undefined });
      onJoined();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <main className="stage-light flex min-h-dvh flex-col px-6 pt-16 pb-10">
      <p className="text-sm text-haze">You’re on the list for</p>
      <h1 className="mt-1 text-4xl font-bold leading-tight tracking-tight">{title ?? 'Raahe Live'}</h1>
      <p className="mt-3 max-w-[32ch] text-haze">
        One room for the night. Find people going solo, vote for the songs you want, and reach the crew if something’s wrong.
      </p>

      <form onSubmit={join} className="mt-auto flex flex-col gap-3">
        <label htmlFor="name" className="text-sm text-haze">What should people call you?</label>
        <input
          id="name"
          autoFocus
          autoComplete="nickname"
          maxLength={32}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name"
          className="h-14 rounded-2xl border border-line bg-velvet px-4 text-lg text-mist outline-none placeholder:text-haze/60 focus:border-spot"
        />
        {showCode ? (
          <input
            aria-label="Crew or artist code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Crew or artist code"
            autoCapitalize="none"
            className="h-12 rounded-2xl border border-line bg-velvet px-4 text-mist outline-none placeholder:text-haze/60 focus:border-spot"
          />
        ) : (
          <button type="button" onClick={() => setShowCode(true)} className="self-start text-sm text-haze underline underline-offset-4">
            Working tonight? Enter your crew code
          </button>
        )}
        {error && <p role="alert" className="text-sm text-gel">{error}</p>}
        <button
          disabled={busy || !name.trim()}
          className="h-14 rounded-2xl bg-spot text-lg font-semibold text-ink transition-opacity disabled:opacity-40"
        >
          {busy ? 'Getting you in…' : 'Join the room'}
        </button>
      </form>
    </main>
  );
}
