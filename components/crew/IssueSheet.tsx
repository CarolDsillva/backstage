'use client';
import { useState } from 'react';
import { X } from 'lucide-react';
import { crewPost, type CrewState } from '@/lib/client/useCrew';
import { SEVERITIES, TEAMS, team as teamOf, type Severity, type TeamId } from '@/lib/shared/teams';
import { cx } from './bits';

/** One-tap starters per team, so nobody types on a dark, loud site. */
const QUICK: Partial<Record<TeamId, string[]>> = {
  control: ['Hold the show', 'Running late', 'Need all leads on CH1'],
  artist: ['Artist needs water', 'Set change requested', 'Guest list issue'],
  production: ['Mic down', 'Monitor feedback', 'Power trip', 'Lights not responding'],
  hospitality: ['Green room needs restock', 'Catering delayed', 'Guest arrived'],
  security: ['Crowd surge at barrier', 'Gate queue backing up', 'Unauthorised backstage'],
  runners: ['Need a runner', 'Pickup from Gate C', 'Cables to stage'],
  stalls: ['Stall out of stock', 'Card machine down', 'Long bar queue'],
  foh: ['Ticket scanner down', 'Queue past the corner', 'Wristbands running out'],
  medical: ['First aid needed', 'Person feeling faint', 'Ambulance access needed'],
};

export function IssueSheet({ state, slug, initialTeam, initialPlace, onClose, onCreated }: {
  state: CrewState; slug: string; initialTeam: TeamId; initialPlace?: string; onClose: () => void; onCreated: (t: TeamId) => void;
}) {
  const [teamId, setTeamId] = useState<TeamId>(state.canOpen.includes(initialTeam) ? initialTeam : state.canOpen[0]);
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [severity, setSeverity] = useState<Severity>('normal');
  const [placeId, setPlaceId] = useState<string | null>(initialPlace ?? null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr('');
    try {
      await crewPost(`/api/crew/${slug}/issues`, { team: teamId, title, note, severity, placeId });
      onCreated(teamId);
    } catch (x) { setErr((x as Error).message); } finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/60 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="raise-h" onClick={onClose}>
      <form onSubmit={submit} onClick={(e) => e.stopPropagation()}
        className="slide-up max-h-[92dvh] w-full overflow-y-auto rounded-t-[32px] bg-[#0b0e22] px-5 pt-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] ring-1 ring-white/10">
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/20" aria-hidden />
        <div className="flex items-center justify-between">
          <h2 id="raise-h" className="font-display text-2xl font-extrabold">Raise an issue</h2>
          <button type="button" onClick={onClose} className="grid h-10 w-10 place-items-center rounded-full bg-white/10" aria-label="Close"><X size={18} /></button>
        </div>
        <p className="mt-1 text-sm text-white/55">It lands in the team’s room and on everyone’s live map.</p>

        <p className="mt-4 text-xs font-bold tracking-wide text-white/50">WHICH TEAM</p>
        <div className="-mx-5 mt-2 flex gap-2 overflow-x-auto px-5 pb-1" role="radiogroup" aria-label="Team">
          {TEAMS.filter((t) => state.canOpen.includes(t.id)).map((t) => (
            <button type="button" key={t.id} role="radio" aria-checked={teamId === t.id} onClick={() => setTeamId(t.id)}
              className={cx('lcd shrink-0 rounded-full px-3 py-2 text-xs font-bold', teamId === t.id ? 'text-[#05060d]' : 'bg-white/8 text-white/70')}
              style={teamId === t.id ? { background: t.color } : undefined}>
              CH{String(t.ch).padStart(2, '0')} {t.short}
            </button>
          ))}
        </div>

        <label htmlFor="iss-title" className="mt-4 block text-xs font-bold tracking-wide text-white/50">WHAT’S WRONG</label>
        <div className="mt-2 flex flex-wrap gap-2">
          {(QUICK[teamId] ?? []).map((q) => (
            <button type="button" key={q} onClick={() => setTitle(q)} className={cx('rounded-full px-3 py-1.5 text-sm', title === q ? 'bg-white text-[#05060d]' : 'bg-white/8 text-white/80')}>{q}</button>
          ))}
        </div>
        <input id="iss-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} required placeholder="Or type it"
          className="mt-2 h-12 w-full rounded-2xl bg-white/8 px-4 text-[15px] placeholder:text-white/35 focus:outline-none focus:ring-2 focus:ring-[#d7ff3a]" />

        <p className="mt-4 text-xs font-bold tracking-wide text-white/50">HOW URGENT</p>
        <div className="mt-2 grid grid-cols-3 gap-2" role="radiogroup" aria-label="Severity">
          {SEVERITIES.map((s) => (
            <button type="button" key={s.id} role="radio" aria-checked={severity === s.id} onClick={() => setSeverity(s.id)}
              className={cx('rounded-2xl px-2 py-2.5 text-left', severity === s.id
                ? s.id === 'critical' ? 'bg-[#ff3d6e] text-white' : s.id === 'urgent' ? 'bg-[#ffb547] text-[#05060d]' : 'bg-white text-[#05060d]'
                : 'bg-white/8 text-white/75')}>
              <span className="block text-sm font-bold">{s.label}</span>
              <span className="block text-[11px] opacity-75">{s.hint}</span>
            </button>
          ))}
        </div>

        <label htmlFor="iss-place" className="mt-4 block text-xs font-bold tracking-wide text-white/50">WHERE (OPTIONAL)</label>
        <select id="iss-place" value={placeId ?? ''} onChange={(e) => setPlaceId(e.target.value || null)}
          className="mt-2 h-12 w-full rounded-2xl bg-white/8 px-4 text-[15px] focus:outline-none focus:ring-2 focus:ring-[#d7ff3a]">
          <option value="" className="bg-[#0b0e22]">No specific place</option>
          {state.places.map((p) => <option key={p.id} value={p.id} className="bg-[#0b0e22]">{p.name}</option>)}
        </select>

        <label htmlFor="iss-note" className="mt-4 block text-xs font-bold tracking-wide text-white/50">DETAILS (OPTIONAL)</label>
        <textarea id="iss-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={400} rows={2}
          className="mt-2 w-full rounded-2xl bg-white/8 p-3 text-[15px] focus:outline-none focus:ring-2 focus:ring-[#d7ff3a]" />

        {err && <p role="alert" className="mt-3 text-sm text-[#ff8fab]">{err}</p>}
        <button disabled={busy || title.trim().length < 2}
          className="mt-5 h-14 w-full rounded-full font-display text-lg font-extrabold text-[#05060d] disabled:opacity-40"
          style={{ background: severity === 'critical' ? '#ff3d6e' : teamOf(teamId).color, color: severity === 'critical' ? '#fff' : '#05060d' }}>
          {busy ? 'Raising…' : severity === 'critical' ? 'Raise critical — alert Control' : 'Raise issue'}
        </button>
      </form>
    </div>
  );
}
