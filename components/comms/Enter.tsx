'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, Eye, Radio, ShieldCheck, Footprints } from 'lucide-react';
import { crewPost } from '@/lib/client/useCrew';
import type { EventRow } from '@/lib/shared/types';
import { cx } from './ui';

const PERSONAS = [
  { id: 'lead', label: 'Show caller', blurb: 'Hears every team. Runs the night.', icon: Radio, bg: '#EC4F9B', ink: '#fff' },
  { id: 'security', label: 'Security', blurb: 'Gates, barriers and the crowd.', icon: ShieldCheck, bg: '#4A1D3F', ink: '#FF9A8F' },
  { id: 'runners', label: 'Runner', blurb: 'Fetch, carry, fix fast.', icon: Footprints, bg: '#123F3E', ink: '#5EE6C0' },
] as const;

/** Front door: demo events = pick a role; real events = viewer or crew code. */
export function Enter({ slug, onDone }: { slug: string; onDone: (token?: string) => void }) {
  const [ev, setEv] = useState<EventRow | null>(null);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [needName, setNeedName] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    fetch(`/api/event/${slug}/preview`).then((r) => (r.ok ? r.json() : null)).then((d) => d && setEv(d.event)).catch(() => {});
  }, [slug]);

  async function enter(body: Record<string, string>, key: string) {
    setBusy(key); setErr('');
    try {
      const r = await crewPost<{ token: string }>(`/api/crew/${slug}/enter`, body);
      onDone(r.token);
    } catch (e) {
      const m = (e as Error).message;
      if (/name/i.test(m)) setNeedName(true);
      setErr(m);
      setBusy(null);
    }
  }

  const demo = !!ev?.refs?.demo;
  const raahe = ev?.artist === 'Raahe';
  return (
    <main className="cosmos mx-auto flex min-h-dvh w-full max-w-[480px] flex-col px-5 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))] text-white">
      <Link href="/" className="flex w-fit items-center gap-1.5 rounded-full bg-[#251856] px-3 py-2 text-sm font-semibold"><ArrowLeft size={16} />Events</Link>

      <div className="mt-6 flex items-center gap-4">
        {raahe
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src="/raahe-logo.png" alt="Raahe" className="h-20 w-20 rounded-[24px]" />
          // eslint-disable-next-line @next/next/no-img-element
          : <img src="/demofest-logo.svg" alt="Demo Fest" className="h-20 w-20 rounded-[24px]" />}
        <div className="min-w-0">
          <p className="text-xs font-bold tracking-[0.14em] text-[#EC4F9B] uppercase">{ev?.refs?.tagline ?? 'Crew comms'}</p>
          <h1 className="font-display text-[34px] leading-[1] font-extrabold tracking-tight">{ev?.title ?? ' '}</h1>
          <p className="mt-1 truncate text-sm text-[#B8ABE6]">{ev?.venue}</p>
        </div>
      </div>

      {demo ? (
        <>
          <h2 className="mt-8 font-display text-2xl font-extrabold">Who do you want to be?</h2>
          <p className="mt-1 text-[15px] text-[#B8ABE6]">No code needed. Everyone else here is a scripted demo crew member, and the show is already running.</p>
          <div className="mt-4 space-y-2.5">
            {PERSONAS.map((p, k) => (
              <button key={p.id} onClick={() => void enter({ persona: p.id }, p.id)} disabled={!!busy}
                className="fan-in flex w-full items-center gap-4 rounded-[26px] p-4 text-left transition-transform active:scale-[.98] disabled:opacity-60"
                style={{ background: p.bg, color: p.ink, animationDelay: `${k * 60}ms` }}>
                <span className="grid h-14 w-14 place-items-center rounded-[18px] bg-white/25"><p.icon size={26} /></span>
                <span className="flex-1">
                  {p.id === 'lead' && <span className="mb-1 inline-block rounded-full bg-[#251856] px-2 py-0.5 text-[10px] font-bold text-[#FF8CC6]">BEST FOR THE TOUR</span>}
                  <span className="block font-display text-[22px] leading-tight font-extrabold">{p.label}</span>
                  <span className="text-sm opacity-85">{busy === p.id ? 'Getting your radio…' : p.blurb}</span>
                </span>
                <ArrowRight size={20} />
              </button>
            ))}
          </div>
        </>
      ) : (
        <form onSubmit={(e) => { e.preventDefault(); if (code.trim()) void enter({ code: code.trim(), ...(name.trim() ? { name: name.trim() } : {}) }, 'code'); }} className="mt-8">
          <h2 className="font-display text-2xl font-extrabold">Enter your code</h2>
          <p className="mt-1 text-[15px] text-[#B8ABE6]">A <b>viewer code</b> lets you read every team’s chat. Crew codes let you talk.</p>
          <label htmlFor="code" className="sr-only">Code</label>
          <input id="code" value={code} onChange={(e) => setCode(e.target.value)} autoFocus autoCapitalize="none" autoComplete="off" spellCheck={false}
            placeholder="e.g. micdrop-watch" className="mt-4 h-14 w-full rounded-[20px] bg-[#251856] px-5 font-mono text-lg placeholder:text-[#7D6FB5] focus:outline-none focus:ring-2 focus:ring-[#EC4F9B]" />
          {needName && (
            <>
              <label htmlFor="name" className="mt-3 block text-sm font-semibold">Your name (the crew will see it)</label>
              <input id="name" value={name} onChange={(e) => setName(e.target.value)} maxLength={32} autoFocus
                className="mt-1.5 h-14 w-full rounded-[20px] bg-[#251856] px-5 text-lg focus:outline-none focus:ring-2 focus:ring-[#EC4F9B]" />
            </>
          )}
          {err && <p role="alert" className="mt-3 text-sm font-semibold text-[#FF9A8F]">{err}</p>}
          <button disabled={!code.trim() || !!busy} className={cx('mt-4 flex h-14 w-full items-center justify-center gap-2 rounded-full bg-[#7C4DFF] font-display text-lg font-extrabold text-white disabled:opacity-40')}>
            {busy ? 'Checking…' : <>Enter <ArrowRight size={18} /></>}
          </button>
          <p className="mt-6 flex items-start gap-2 rounded-[20px] bg-[#2E2470] p-4 text-sm text-[#DCD7FF]"><Eye size={18} className="mt-0.5 shrink-0" />Judges: use the viewer code from the submission to watch the whole show night, read-only.</p>
        </form>
      )}
    </main>
  );
}
