'use client';
import { useMemo, useState } from 'react';
import { AlertTriangle, ChevronRight, Megaphone, Radio, Send, Users, Mic2, Image as ImageIcon, MessageSquare, CheckCircle2, Plus } from 'lucide-react';
import type { CrewState, FeedItem } from '@/lib/client/useCrew';
import { crewPost } from '@/lib/client/useCrew';
import { BS_TYPES } from '@/lib/shared/types';
import { team as teamOf, ISSUE_STATUS_LABEL, type TeamId } from '@/lib/shared/teams';
import { cardDigest } from '@/lib/client/nexconn';
import { KIND_ICON } from '@/components/VenueMap';
import { ChLabel, SEVERITY_STYLE, ago, cx, hm } from './bits';

export function Hq({ state, feed, now, slug, onOpenRoom, onRaise, onChanged }: {
  state: CrewState; feed: FeedItem[]; now: number; slug: string;
  onOpenRoom: (t: TeamId) => void; onRaise: (placeId?: string) => void; onChanged: () => void;
}) {
  const open = state.issues.filter((i) => i.status !== 'resolved');
  return (
    <div className="space-y-5 px-4 pb-32">
      <EventHero state={state} now={now} openCount={open.length} criticalCount={open.filter((i) => i.severity === 'critical').length} />
      <QuickRefs state={state} onOpenRoom={onOpenRoom} />
      {state.me.role === 'lead' && <Announce slug={slug} onDone={onChanged} />}
      <LiveMap state={state} onOpenRoom={onOpenRoom} onRaise={onRaise} />
      <LiveFeed feed={feed} state={state} now={now} onOpenRoom={onOpenRoom} />
    </div>
  );
}

function EventHero({ state, now, openCount, criticalCount }: { state: CrewState; now: number; openCount: number; criticalCount: number }) {
  const start = new Date(state.event.startsAt).getTime();
  const end = new Date(state.event.endsAt).getTime();
  const live = state.phase === 'live';
  const clock = state.phase === 'after' ? 'WRAPPED'
    : live ? (now >= start && now < end ? `LIVE ${hm(now - start)}` : 'LIVE NOW')
    : start > now ? `DOORS IN ${until(start - now)}` : 'PRE-SHOW';
  const next = (state.event.refs?.sets ?? []).find((s) => toToday(s.time, now) > now);
  const onAir = state.radio.length;
  return (
    <section className="hero-card slide-up rounded-[30px] p-5 text-white">
      <div className="flex items-center justify-between">
        <span className={cx('lcd rounded-full px-2.5 py-1 text-[11px] font-bold', live ? 'bg-[#ff3d6e] text-white' : 'bg-white/15')}>
          {live && <span className="mr-1.5 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-white align-middle" />}{clock}
        </span>
        <span className="text-xs font-semibold text-white/70">{state.event.venue}</span>
      </div>
      <p className="mt-5 text-sm font-semibold text-white/75">{state.event.title}</p>
      <h1 className="font-display text-[40px] leading-[0.95] font-extrabold tracking-tight">{state.event.artist}</h1>
      {next && <p className="mt-2 text-sm text-white/85">Next up <b className="text-[#d7ff3a]">{next.time}</b> · {next.name}</p>}
      <div className="mt-5 grid grid-cols-3 gap-2">
        <Stat icon={<AlertTriangle size={16} />} value={openCount} label="open issues" hot={criticalCount > 0} sub={criticalCount ? `${criticalCount} critical` : undefined} />
        <Stat icon={<Users size={16} />} value={state.crew.length} label="crew on" />
        <Stat icon={<Radio size={16} />} value={onAir} label="radios live" />
      </div>
    </section>
  );
}

function Stat({ icon, value, label, sub, hot }: { icon: React.ReactNode; value: number; label: string; sub?: string; hot?: boolean }) {
  return (
    <div className={cx('rounded-2xl px-3 py-2.5', hot ? 'bg-[#ff3d6e]/90' : 'bg-white/12')}>
      <div className="flex items-center gap-1.5 text-white/80">{icon}<span className="font-display text-2xl font-extrabold text-white">{value}</span></div>
      <p className="text-[11px] font-semibold leading-tight text-white/80">{sub ?? label}</p>
    </div>
  );
}

/** "3d 4h" for far away, "1:24" (h:mm) within a day. */
function until(ms: number) {
  const mins = Math.round(ms / 60000);
  if (mins >= 24 * 60) return `${Math.floor(mins / 1440)}d ${Math.floor((mins % 1440) / 60)}h`;
  return hm(ms);
}

function toToday(hhmm: string, now: number) {
  const [h, m] = hhmm.split(':').map(Number);
  const d = new Date(now);
  d.setHours(h || 0, m || 0, 0, 0);
  return d.getTime();
}

function QuickRefs({ state, onOpenRoom }: { state: CrewState; onOpenRoom: (t: TeamId) => void }) {
  const refs = state.event.refs ?? {};
  const sets = refs.sets ?? [];
  const contacts = refs.contacts ?? [];
  const notes = refs.notes ?? [];
  if (!sets.length && !contacts.length && !notes.length && !refs.doors) return null;
  return (
    <section aria-label="Quick references">
      <h2 className="mb-2 px-1 font-display text-lg font-bold">Quick refs</h2>
      <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1">
        {(sets.length > 0 || refs.doors) && (
          <div className="glass w-60 shrink-0 snap-start rounded-3xl p-4">
            <p className="lcd text-[11px] font-bold text-[#d7ff3a]">RUN OF SHOW</p>
            <ul className="mt-2 space-y-1.5 text-sm">
              {refs.doors && <li className="flex gap-3"><span className="lcd w-12 text-white/60">{refs.doors}</span>Doors</li>}
              {sets.map((s) => <li key={s.time + s.name} className="flex gap-3"><span className="lcd w-12 text-white/60">{s.time}</span><span className="truncate">{s.name}</span></li>)}
            </ul>
          </div>
        )}
        {contacts.length > 0 && (
          <div className="glass w-64 shrink-0 snap-start rounded-3xl p-4">
            <p className="lcd text-[11px] font-bold text-[#d7ff3a]">WHO TO CALL</p>
            <ul className="mt-2 space-y-1">
              {contacts.map((c) => (
                <li key={c.role}>
                  <button disabled={!c.channel || !state.canOpen.includes(c.channel as TeamId)} onClick={() => c.channel && onOpenRoom(c.channel as TeamId)}
                    className="flex w-full items-center justify-between gap-2 rounded-xl py-1 text-left text-sm disabled:opacity-60">
                    <span><span className="block font-semibold">{c.role}</span><span className="text-xs text-white/60">{c.name}</span></span>
                    {c.channel && <ChLabel team={c.channel} />}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
        {notes.length > 0 && (
          <div className="glass w-72 shrink-0 snap-start rounded-3xl p-4">
            <p className="lcd text-[11px] font-bold text-[#d7ff3a]">GOOD TO KNOW</p>
            <ul className="mt-2 space-y-2 text-sm text-white/85">{notes.map((n) => <li key={n}>{n}</li>)}</ul>
          </div>
        )}
      </div>
    </section>
  );
}

function Announce({ slug, onDone }: { slug: string; onDone: () => void }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setBusy(true); setErr('');
    try { await crewPost(`/api/crew/${slug}/announce`, { text }); setText(''); onDone(); } catch (x) { setErr((x as Error).message); } finally { setBusy(false); }
  }
  return (
    <form onSubmit={send} className="glass flex items-center gap-2 rounded-full p-1.5 pl-4">
      <Megaphone size={18} className="shrink-0 text-[#d7ff3a]" aria-hidden />
      <label htmlFor="announce" className="sr-only">Announce to all hands</label>
      <input id="announce" value={text} onChange={(e) => setText(e.target.value)} maxLength={200} placeholder="Announce to all hands…"
        className="min-w-0 flex-1 bg-transparent py-2 text-[15px] placeholder:text-white/40 focus:outline-none" />
      <button disabled={busy || !text.trim()} className="grid h-10 w-10 place-items-center rounded-full bg-[#d7ff3a] text-[#05060d] disabled:opacity-40" aria-label="Send announcement">
        <Send size={17} />
      </button>
      {err && <p role="alert" className="sr-only">{err}</p>}
    </form>
  );
}

function LiveMap({ state, onOpenRoom, onRaise }: { state: CrewState; onOpenRoom: (t: TeamId) => void; onRaise: (placeId?: string) => void }) {
  const [sel, setSel] = useState<string | null>(null);
  const open = state.issues.filter((i) => i.status !== 'resolved');
  const byPlace = useMemo(() => {
    const m = new Map<string, typeof open>();
    for (const i of open) if (i.placeId) m.set(i.placeId, [...(m.get(i.placeId) ?? []), i]);
    return m;
  }, [open]);
  const place = state.places.find((p) => p.id === sel) ?? null;
  const here = sel ? byPlace.get(sel) ?? [] : [];
  return (
    <section aria-label="Live map">
      <div className="mb-2 flex items-end justify-between px-1">
        <h2 className="font-display text-lg font-bold">Live map</h2>
        <span className="text-xs text-white/55">{byPlace.size ? `${byPlace.size} hot spot${byPlace.size > 1 ? 's' : ''}` : 'All clear'}</span>
      </div>
      <div className="glass relative overflow-hidden rounded-[28px] p-3">
        <div className="relative mx-auto aspect-[100/140] max-h-[52dvh]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/venue.svg" alt="" className="absolute inset-0 h-full w-full select-none opacity-70 [filter:hue-rotate(200deg)_saturate(0.7)]" draggable={false} />
          {state.places.map((p) => {
            const list = byPlace.get(p.id) ?? [];
            const worst = list.find((i) => i.severity === 'critical') ?? list.find((i) => i.severity === 'urgent') ?? list[0];
            const Icon = KIND_ICON[p.kind];
            const color = worst ? teamOf(worst.team).color : undefined;
            return (
              <button key={p.id} onClick={() => setSel(p.id === sel ? null : p.id)} aria-pressed={sel === p.id}
                aria-label={`${p.name}${list.length ? `: ${list.length} open issue${list.length > 1 ? 's' : ''}` : ''}`}
                className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${p.x}%`, top: `${(p.y / 140) * 100}%` }}>
                <span className="relative block">
                  {worst && <span className="ring-out absolute inset-0 rounded-full" style={{ background: SEVERITY_STYLE[worst.severity ?? 'normal'].ring }} aria-hidden />}
                  <span className={cx('relative grid h-8 w-8 place-items-center rounded-full shadow-lg', !worst && 'bg-white/12 text-white/70', sel === p.id && 'outline outline-2 outline-offset-2 outline-[#d7ff3a]')}
                    style={worst ? { background: color, color: '#05060d' } : undefined}>
                    <Icon size={15} strokeWidth={2.4} aria-hidden />
                  </span>
                  {list.length > 1 && <span className="absolute -top-1.5 -right-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-white px-1 text-[10px] font-bold text-[#05060d]">{list.length}</span>}
                </span>
              </button>
            );
          })}
        </div>
        {place && (
          <div className="slide-up absolute inset-x-3 bottom-3 rounded-3xl bg-[#0b0e22]/95 p-4 ring-1 ring-white/10">
            <div className="flex items-center justify-between">
              <p className="font-display text-lg font-bold">{place.name}</p>
              <button onClick={() => onRaise(place.id)} className="flex items-center gap-1 rounded-full bg-[#d7ff3a] px-3 py-1.5 text-xs font-bold text-[#05060d]"><Plus size={14} />Raise issue here</button>
            </div>
            {here.length === 0 ? <p className="mt-1 text-sm text-white/60">No open issues here.</p> : (
              <ul className="mt-2 space-y-1.5">
                {here.map((i) => (
                  <li key={i.id}>
                    <button onClick={() => onOpenRoom(i.team as TeamId)} className="flex w-full items-center gap-2 text-left text-sm">
                      <ChLabel team={i.team ?? 'control'} />
                      <span className="flex-1 truncate font-semibold">{i.title ?? i.note}</span>
                      <span className={cx('rounded-full px-2 py-0.5 text-[11px] font-bold', SEVERITY_STYLE[i.severity ?? 'normal'].chip)}>{ISSUE_STATUS_LABEL[i.status]}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

function LiveFeed({ feed, state, now, onOpenRoom }: { feed: FeedItem[]; state: CrewState; now: number; onOpenRoom: (t: TeamId) => void }) {
  const items = feed.slice(0, 30);
  return (
    <section aria-label="Live feed">
      <div className="mb-2 flex items-end justify-between px-1">
        <h2 className="font-display text-lg font-bold">Live from every room</h2>
        <span className="flex items-center gap-1 text-xs text-white/55"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#3ef0c4]" />live</span>
      </div>
      {items.length === 0 ? (
        <p className="glass rounded-3xl p-5 text-sm text-white/60">Quiet backstage. Issues, radio calls and announcements from every team you hear show up here as they happen.</p>
      ) : (
        <ul className="space-y-2" aria-live="polite">
          {items.map((m) => <FeedRow key={m.id} m={m} now={now} onOpen={() => onOpenRoom(m.team)} crew={state.crew} />)}
        </ul>
      )}
    </section>
  );
}

function FeedRow({ m, now, onOpen, crew }: { m: FeedItem; now: number; onOpen: () => void; crew: CrewState['crew'] }) {
  const c = m.content as Record<string, unknown>;
  const name = m.senderName === 'Someone' ? crew.find((x) => x.userId === m.senderId)?.name ?? 'Crew' : m.senderName;
  let icon = <MessageSquare size={16} />;
  let text = '';
  let tone = '';
  if (m.type === BS_TYPES.issue) { icon = <AlertTriangle size={16} />; text = cardDigest(m.type, c); tone = c.severity === 'critical' ? 'ring-1 ring-[#ff3d6e]/60 bg-[#ff3d6e]/10' : ''; }
  else if (m.type === BS_TYPES.issueUpdate) { icon = <CheckCircle2 size={16} />; text = cardDigest(m.type, c); }
  else if (m.type === BS_TYPES.radio) { icon = <Radio size={16} />; text = cardDigest(m.type, c); }
  else if (m.type === BS_TYPES.announce) { icon = <Megaphone size={16} />; text = String(c.text ?? ''); tone = 'ring-1 ring-[#d7ff3a]/40'; }
  else if (m.type === 'RC:HQVCMsg') { icon = <Mic2 size={16} />; text = `${name}: voice clip`; }
  else if (m.type === 'RC:ImgMsg') { icon = <ImageIcon size={16} />; text = `${name} sent a photo`; }
  else text = `${name}: ${String(c.text ?? '')}`;
  return (
    <li>
      <button onClick={onOpen} className={cx('glass flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left', tone)}>
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl" style={{ background: `${teamOf(m.team).color}22`, color: teamOf(m.team).color }}>{icon}</span>
        <span className="min-w-0 flex-1">
          <ChLabel team={m.team} />
          <span className="block truncate text-[14px] font-medium">{text}</span>
        </span>
        <span className="lcd shrink-0 text-[11px] text-white/45">{ago(m.sentAt, now)}</span>
        <ChevronRight size={16} className="shrink-0 text-white/30" aria-hidden />
      </button>
    </li>
  );
}
