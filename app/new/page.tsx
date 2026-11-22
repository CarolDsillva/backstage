'use client';
import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, Check } from 'lucide-react';
import { crewPost } from '@/lib/client/useCrew';
import { TEAMS, type TeamId } from '@/lib/shared/teams';
import { Invite } from '@/components/comms/Invite';
import { TeamBadge, cx } from '@/components/comms/ui';

const DEFAULT_TEAMS: TeamId[] = ['control', 'artist', 'production', 'hospitality', 'security', 'runners'];

/** Create your own event: name, place, time, which teams. You become its event manager. */
export default function NewEvent() {
  const [today] = useState(() => {
    const d = new Date();
    d.setHours(d.getHours() + 1, 0, 0, 0);
    return { date: d.toLocaleDateString('en-CA'), time: d.toTimeString().slice(0, 5) };
  });
  const [title, setTitle] = useState('');
  const [venue, setVenue] = useState('');
  const [city, setCity] = useState('');
  const [date, setDate] = useState(today.date);
  const [time, setTime] = useState(today.time);
  const [hours, setHours] = useState(4);
  const [name, setName] = useState('');
  const [teams, setTeams] = useState<TeamId[]>(DEFAULT_TEAMS);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [made, setMade] = useState<{ slug: string; codes: { crew: string; viewer: string } } | null>(null);

  const toggle = (t: TeamId) => t !== 'control' && setTeams((v) => (v.includes(t) ? v.filter((x) => x !== t) : [...v, t]));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr('');
    try {
      const startsAt = new Date(`${date}T${time}`).toISOString();
      const r = await crewPost<{ slug: string; codes: { crew: string; viewer: string } }>('/api/events', { title, venue, city, startsAt, hours, name, teams });
      try {
        const mine = JSON.parse(localStorage.getItem('bs_my_events') ?? '[]') as unknown[];
        localStorage.setItem('bs_my_events', JSON.stringify([{ slug: r.slug, title, venue: city ? `${venue}, ${city}` : venue, startsAt }, ...mine].slice(0, 12)));
      } catch { /* storage blocked */ }
      setMade(r);
    } catch (x) { setErr((x as Error).message); } finally { setBusy(false); }
  }

  const field = 'mt-1.5 h-13 w-full rounded-[18px] bg-[#251856] px-4 py-3 text-[16px] placeholder:text-[#7D6FB5] focus:outline-none focus:ring-2 focus:ring-[#EC4F9B]';
  const label = 'mt-5 block text-sm font-semibold text-[#CFC4F5]';

  return (
    <main className="min-h-dvh bg-[#0B0620]">
      <div className="cosmos mx-auto min-h-dvh max-w-[480px] px-5 pt-[max(1rem,env(safe-area-inset-top))] pb-12 text-white">
        <Link href="/" className="flex w-fit items-center gap-1.5 rounded-full bg-white/10 px-3 py-2 text-sm font-semibold"><ArrowLeft size={16} />Events</Link>

        {made ? (
          <div className="slide-up">
            <span className="mt-8 grid h-16 w-16 place-items-center rounded-full bg-[#2FB392]"><Check size={30} /></span>
            <h1 className="mt-4 font-display text-[36px] leading-none font-extrabold"><span className="grad-text">{title}</span><br />is ready</h1>
            <p className="mt-2 text-[15px] text-[#B8ABE6]">You’re its event manager. Every team has its own chat, walkie channel and spot on the map.</p>
            <div className="mt-5"><Invite slug={made.slug} title={title} crew={made.codes.crew} viewer={made.codes.viewer} /></div>
            <a href={`/e/${made.slug}/crew`} className="mt-4 flex h-14 w-full items-center justify-center gap-2 rounded-full bg-white font-display text-lg font-extrabold text-[#160B36]">
              Open my event <ArrowRight size={18} />
            </a>
          </div>
        ) : (
          <form onSubmit={submit}>
            <h1 className="mt-6 font-display text-[38px] leading-none font-extrabold"><span className="grad-text">Create</span> an event</h1>
            <p className="mt-2 text-[15px] text-[#B8ABE6]">Takes a minute. You get a chat and a walkie channel for each team, plus codes to invite your crew.</p>

            <label htmlFor="ev-title" className={label}>Event name</label>
            <input id="ev-title" value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={48} placeholder="e.g. Friday Open Mic" className={field} />

            <div className="grid grid-cols-[1.4fr_1fr] gap-3">
              <div>
                <label htmlFor="ev-venue" className={label}>Venue</label>
                <input id="ev-venue" value={venue} onChange={(e) => setVenue(e.target.value)} required maxLength={64} placeholder="e.g. Rooftop café" className={field} />
              </div>
              <div>
                <label htmlFor="ev-city" className={label}>City</label>
                <input id="ev-city" value={city} onChange={(e) => setCity(e.target.value)} maxLength={32} placeholder="Bangalore" className={field} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label htmlFor="ev-date" className={label}>Date</label>
                <input id="ev-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required className={cx(field, '[color-scheme:dark]')} />
              </div>
              <div>
                <label htmlFor="ev-time" className={label}>Starts</label>
                <input id="ev-time" type="time" value={time} onChange={(e) => setTime(e.target.value)} required className={cx(field, '[color-scheme:dark]')} />
              </div>
              <div>
                <label htmlFor="ev-hours" className={label}>Hours</label>
                <select id="ev-hours" value={hours} onChange={(e) => setHours(Number(e.target.value))} className={field}>
                  {[2, 3, 4, 5, 6, 8, 10, 12].map((h) => <option key={h} value={h}>{h}</option>)}
                </select>
              </div>
            </div>

            <p className={label}>Teams</p>
            <p className="text-xs text-[#8C7FC0]">Control (all hands) is always on. Tap to add or remove.</p>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {TEAMS.map((t) => {
                const on = teams.includes(t.id) || t.id === 'control';
                return (
                  <button type="button" key={t.id} onClick={() => toggle(t.id)} aria-pressed={on} disabled={t.id === 'control'}
                    className={cx('flex flex-col items-center gap-1.5 rounded-[18px] p-2.5 text-center text-xs font-semibold transition', on ? 'bg-[#251856] ring-2 ring-[#7C4DFF]' : 'bg-white/[0.04] text-[#8C7FC0]')}>
                    <span className={cx(!on && 'opacity-40')}><TeamBadge team={t.id} size={34} /></span>
                    {t.name}
                  </button>
                );
              })}
            </div>

            <label htmlFor="ev-name" className={label}>Your name</label>
            <input id="ev-name" value={name} onChange={(e) => setName(e.target.value)} required maxLength={32} placeholder="Shown to your crew" className={field} />

            {err && <p role="alert" className="mt-4 text-sm font-semibold text-[#FF9A8F]">{err}</p>}
            <button disabled={busy} className="mt-6 flex h-14 w-full items-center justify-center gap-2 rounded-full bg-[linear-gradient(120deg,#FF6FB5,#7C4DFF)] font-display text-lg font-extrabold disabled:opacity-50">
              {busy ? 'Setting up your channels…' : <>Create event <ArrowRight size={18} /></>}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
