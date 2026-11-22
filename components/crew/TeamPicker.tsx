'use client';
import { useState } from 'react';
import { crewPost } from '@/lib/client/useCrew';
import { TEAMS, type TeamId } from '@/lib/shared/teams';
import { cx } from './bits';

/** After crew check-in: pick your team. This decides which radio channel you're on. */
export function TeamPicker({ slug, name, isLead, current, teams, onDone, onCancel }: {
  slug: string; name: string; isLead: boolean; current?: TeamId | null; teams?: string[]; onDone: () => void; onCancel?: () => void;
}) {
  const [pick, setPick] = useState<TeamId | null>(current ?? (isLead ? 'control' : null));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  async function go() {
    if (!pick) return;
    setBusy(true); setErr('');
    try { await crewPost(`/api/crew/${slug}/team`, { team: pick }); onDone(); } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }
  return (
    <main className="cosmos mx-auto flex min-h-dvh w-full max-w-[480px] flex-col px-5 pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(1.25rem,env(safe-area-inset-bottom))]">
      <p className="lcd text-xs font-bold text-[#FF9CCB]">BACKSTAGE · CREW</p>
      <h1 className="mt-3 font-display text-[34px] leading-[1] font-extrabold tracking-tight">Hey {name.split(' ')[0]}.<br />Which team are you on?</h1>
      <p className="mt-2 text-sm text-white/60">{isLead ? 'As event manager you hear every channel. Pick your home channel.' : 'You’ll hear Control (all hands) plus your team’s channel.'}</p>
      <div className="mt-5 grid flex-1 grid-cols-2 content-start gap-2.5" role="radiogroup" aria-label="Team">
        {TEAMS.filter((t) => t.id === 'control' || !teams?.length || teams.includes(t.id)).map((t, i) => (
          <button key={t.id} role="radio" aria-checked={pick === t.id} onClick={() => setPick(t.id)}
            className={cx('fan-in relative overflow-hidden rounded-3xl p-4 text-left transition-transform active:scale-[.98]', pick === t.id ? 'ring-2' : 'bg-white/[0.06]')}
            style={{ animationDelay: `${i * 40}ms`, ...(pick === t.id ? { background: `${t.color}26`, boxShadow: `inset 0 0 0 2px ${t.color}` } : {}) }}>
            <span className="lcd text-[11px] font-bold" style={{ color: t.color }}>CH{String(t.ch).padStart(2, '0')}</span>
            <span className="mt-1 block font-display text-lg leading-tight font-bold">{t.name}</span>
            <span className="mt-0.5 block text-xs text-white/55">{t.blurb}</span>
          </button>
        ))}
      </div>
      {err && <p role="alert" className="mt-3 text-sm text-[#ff8fab]">{err}</p>}
      <div className="mt-4 flex gap-2">
        {onCancel && <button onClick={onCancel} className="h-14 flex-1 rounded-full bg-white/10 font-bold">Cancel</button>}
        <button onClick={go} disabled={!pick || busy} className="h-14 flex-[2] rounded-full bg-[#7C4DFF] font-display text-lg font-extrabold text-white disabled:opacity-40">
          {busy ? 'Tuning in…' : 'Tune in'}
        </button>
      </div>
    </main>
  );
}
