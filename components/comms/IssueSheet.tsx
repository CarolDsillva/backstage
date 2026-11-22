'use client';
import { useState } from 'react';
import { X } from 'lucide-react';
import { crewPost, type CrewState } from '@/lib/client/useCrew';
import { SEVERITIES, TEAMS, type Severity, type TeamId } from '@/lib/shared/teams';
import { cx, tui, chNo } from './ui';

/** One-tap starters per team, so nobody types on a dark, loud site. */
const QUICK: Partial<Record<TeamId, string[]>> = {
  control: ['Hold the show', 'Running late', 'All leads to CH01'],
  artist: ['Artist needs water', 'Set change requested', 'Guest list issue'],
  production: ['Mic down', 'Monitor feedback', 'Power trip', 'Lights not responding'],
  hospitality: ['Green room needs restock', 'Catering delayed', 'Toilets need restocking'],
  security: ['Crowd surge at barrier', 'Gate queue backing up', 'Unauthorised backstage'],
  runners: ['Need a runner', 'Pickup from Gate A', 'Cables to stage'],
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

  const label = 'mt-5 block text-[11px] font-bold tracking-[0.12em] text-[#8C7FC0] uppercase';
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-[#7C4DFF]/50 backdrop-blur-[2px]" role="dialog" aria-modal="true" aria-labelledby="raise-h" onClick={onClose}>
      <form onSubmit={submit} onClick={(e) => e.stopPropagation()}
        className="slide-up max-h-[92dvh] w-full max-w-[480px] overflow-y-auto rounded-t-[32px] bg-[#160B36] px-5 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))] text-white">
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-[#4A3A8A]" aria-hidden />
        <div className="flex items-center justify-between">
          <h2 id="raise-h" className="font-display text-[26px] font-extrabold tracking-tight">Raise an issue</h2>
          <button type="button" onClick={onClose} className="grid h-10 w-10 place-items-center rounded-full bg-[#251856]" aria-label="Close"><X size={18} /></button>
        </div>
        <p className="text-sm text-[#B8ABE6]">It goes to the team’s chat, everyone’s alerts and the map.</p>

        <p className={label}>Which team</p>
        <div className="-mx-5 mt-2 flex gap-2 overflow-x-auto px-5 pb-1" role="radiogroup" aria-label="Team">
          {TEAMS.filter((t) => state.canOpen.includes(t.id)).map((t) => {
            const on = teamId === t.id;
            return (
              <button type="button" key={t.id} role="radio" aria-checked={on} onClick={() => setTeamId(t.id)}
                className={cx('shrink-0 rounded-full px-3.5 py-2 text-sm font-semibold', on ? 'text-white' : 'bg-[#251856] text-[#CFC4F5]')}
                style={on ? { background: '#7C4DFF' } : undefined}>
                <span className="mr-1 font-bold" style={{ color: on ? '#FF9CCB' : tui(t.id).dot }}>{chNo(t.id)}</span>{t.name}
              </button>
            );
          })}
        </div>

        <label htmlFor="iss-title" className={label}>What’s wrong</label>
        <div className="mt-2 flex flex-wrap gap-2">
          {(QUICK[teamId] ?? []).map((q) => (
            <button type="button" key={q} onClick={() => setTitle(q)} className={cx('rounded-full px-3 py-1.5 text-sm', title === q ? 'bg-[#EC4F9B] text-white' : 'bg-[#251856] text-[#E6DFFF]')}>{q}</button>
          ))}
        </div>
        <input id="iss-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} required placeholder="Or type it"
          className="mt-2 h-12 w-full rounded-2xl bg-[#251856] px-4 text-[15px] placeholder:text-[#7D6FB5] focus:outline-none focus:ring-2 focus:ring-[#EC4F9B]" />

        <p className={label}>How urgent</p>
        <div className="mt-2 grid grid-cols-3 gap-2" role="radiogroup" aria-label="Severity">
          {SEVERITIES.map((s) => {
            const on = severity === s.id;
            const bg = s.id === 'critical' ? '#FF6B5B' : s.id === 'urgent' ? '#3F3014' : '#7C4DFF';
            return (
              <button type="button" key={s.id} role="radio" aria-checked={on} onClick={() => setSeverity(s.id)}
                className="rounded-2xl px-3 py-2.5 text-left"
                style={on ? { background: bg, color: s.id === 'urgent' ? '#FFCB5C' : '#fff' } : { background: '#fff', color: '#E6DFFF' }}>
                <span className="block text-sm font-bold">{s.label}</span>
                <span className="block text-[11px] opacity-75">{s.hint}</span>
              </button>
            );
          })}
        </div>

        <label htmlFor="iss-place" className={label}>Where (optional)</label>
        <select id="iss-place" value={placeId ?? ''} onChange={(e) => setPlaceId(e.target.value || null)}
          className="mt-2 h-12 w-full rounded-2xl bg-[#251856] px-4 text-[15px] focus:outline-none focus:ring-2 focus:ring-[#EC4F9B]">
          <option value="">No specific place</option>
          {state.places.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>

        <label htmlFor="iss-note" className={label}>Details (optional)</label>
        <textarea id="iss-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={400} rows={2}
          className="mt-2 w-full rounded-2xl bg-[#251856] p-3 text-[15px] focus:outline-none focus:ring-2 focus:ring-[#EC4F9B]" />

        {err && <p role="alert" className="mt-3 text-sm font-semibold text-[#FF9A8F]">{err}</p>}
        <button disabled={busy || title.trim().length < 2}
          className="mt-5 h-14 w-full rounded-full font-display text-lg font-extrabold text-white disabled:opacity-40"
          style={{ background: severity === 'critical' ? '#FF6B5B' : '#7C4DFF' }}>
          {busy ? 'Raising…' : severity === 'critical' ? 'Raise critical · alert Control' : 'Raise issue'}
        </button>
      </form>
    </div>
  );
}
