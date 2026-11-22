'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Inbox as InboxIcon, LayoutDashboard, PlayCircle, Plus, Radio, RadioTower, X } from 'lucide-react';
import { useCrew } from '@/lib/client/useCrew';
import { reconnectNow } from '@/lib/client/nexconn';
import { acceptIncoming, declineIncoming, key, leave, onRadio, type RadioState } from '@/lib/client/radio';
import { CrewCheckIn } from '@/components/CrewCheckIn';
import { team as teamOf, type TeamId } from '@/lib/shared/teams';
import { Hq } from './Hq';
import { Channels } from './Channels';
import { TeamRoom } from './TeamRoom';
import { IssueSheet } from './IssueSheet';
import { TeamPicker } from './TeamPicker';
import { Inbox } from './Inbox';
import { HeatDemo, demoKey } from './HeatDemo';
import { cx, useNow } from './bits';

type Tab = 'hq' | 'channels' | 'inbox';

export function CrewApp({ slug }: { slug: string }) {
  const crew = useCrew(slug);
  const { state, status } = crew;
  const [tab, setTab] = useState<Tab>('hq');
  const [room, setRoom] = useState<TeamId | null>(null);
  const [raise, setRaise] = useState<{ team: TeamId; place?: string } | null>(null);
  const [demo, setDemo] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [radio, setRadio] = useState<RadioState | null>(null);
  const now = useNow(15_000);

  useEffect(() => onRadio(setRadio), []);
  useEffect(() => { crew.setOpenRoom(room); }, [room]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!state?.me.team) return;
    try { if (!localStorage.getItem(demoKey(slug, state.me.userId))) setDemo(true); } catch { /* storage blocked */ }
  }, [slug, state?.me.userId, state?.me.team]);

  if (status === 'notfound') return <Center title="This event doesn’t exist" body="Check the crew link from your lead." />;
  if (status === 'checkin') return <CrewCheckIn slug={slug} instant onDone={(_r, t) => { crew.setToken(t); void crew.refetch(); }} />;
  if (status === 'error' && !state) return <Center title="Can’t reach backstage" body="Check your connection." action={() => void crew.refetch()} />;
  if (!state) return <Center title="Tuning in…" spinner />;
  if (!state.me.team || switching) {
    return <TeamPicker slug={slug} name={state.me.name} isLead={state.me.role === 'lead'} current={state.me.team}
      onDone={() => { setSwitching(false); void crew.refetch(); }} onCancel={switching ? () => setSwitching(false) : undefined} />;
  }

  const myHome: TeamId = state.me.team;
  const openRoom = (t: TeamId) => { if (state.canOpen.includes(t)) setRoom(t); };
  const finishDemo = () => { try { localStorage.setItem(demoKey(slug, state.me.userId), '1'); } catch { /* ignore */ } setDemo(false); };

  return (
    <div className="crew-bg min-h-dvh">
      <header className="sticky top-0 z-30 flex items-center justify-between gap-3 bg-[#05060d]/40 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 backdrop-blur-md">
        <div className="min-w-0">
          <p className="lcd text-[11px] font-bold text-[#d7ff3a]">BACKSTAGE · {state.me.role === 'lead' ? 'SHOW CALLER' : teamOf(myHome).short}</p>
          <p className="truncate font-display text-lg font-bold">{state.me.name.split(' ')[0]} · {teamOf(myHome).name}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setDemo(true)} className="grid h-10 w-10 place-items-center rounded-full bg-white/10" aria-label="How Backstage works"><PlayCircle size={19} /></button>
          <Conn status={crew.conn} />
        </div>
      </header>

      <main className={cx(tab === 'inbox' && 'h-[calc(100dvh-72px)]')}>
        {tab === 'hq' && <Hq state={state} feed={crew.feed} now={now} slug={slug} onOpenRoom={openRoom} onRaise={(p) => setRaise({ team: myHome, place: p })} onChanged={() => void crew.refetch()} />}
        {tab === 'channels' && <Channels state={state} unread={crew.unread} onOpen={openRoom} onChangeTeam={() => setSwitching(true)} />}
        {tab === 'inbox' && <Inbox />}
        {state.me.role === 'lead' && tab === 'hq' && (
          <p className="px-6 pb-36 text-center text-xs text-white/40"><Link href={`/e/${slug}/crew/reports`} className="underline">Audience help reports</Link> · <Link href={`/e/${slug}`} className="underline">Audience room</Link></p>
        )}
      </main>

      {radio?.status === 'live' && room !== radio.team && <OnAirBar radio={radio} onOpen={() => radio.team && openRoom(radio.team as TeamId)} />}
      {radio?.incoming && <IncomingRadio team={radio.incoming.team} onAccept={() => { acceptIncoming(); if (radio.incoming?.team) openRoom(radio.incoming.team as TeamId); }} onDecline={() => void declineIncoming()} />}

      <nav aria-label="Sections" className="fixed inset-x-0 bottom-0 z-30 px-4 pb-[max(0.9rem,env(safe-area-inset-bottom))]">
        <div className="mx-auto flex max-w-md items-center justify-between rounded-full bg-[#0d1024]/90 p-1.5 shadow-[0_20px_40px_-12px_rgba(0,0,0,.9)] ring-1 ring-white/10 backdrop-blur-xl">
          <NavBtn active={tab === 'hq'} onClick={() => setTab('hq')} icon={<LayoutDashboard size={20} />} label="HQ" />
          <NavBtn active={tab === 'channels'} onClick={() => setTab('channels')} icon={<Radio size={20} />} label="Channels" badge={Object.values(crew.unread).reduce((a, b) => a + (b ?? 0), 0)} />
          <button onClick={() => setRaise({ team: myHome })} aria-label="Raise an issue"
            className="grid h-14 w-14 place-items-center rounded-full bg-[#d7ff3a] text-[#05060d] shadow-[0_10px_24px_-6px_rgba(215,255,58,.6)] transition-transform active:scale-95">
            <Plus size={28} strokeWidth={2.6} />
          </button>
          <NavBtn active={false} onClick={() => openRoom(myHome)} icon={<RadioTower size={20} />} label={`CH${String(teamOf(myHome).ch).padStart(2, '0')}`} />
          <NavBtn active={tab === 'inbox'} onClick={() => setTab('inbox')} icon={<InboxIcon size={20} />} label="Inbox" />
        </div>
      </nav>

      {room && (
        <TeamRoom state={state} teamId={room} slug={slug} onBack={() => setRoom(null)} onRaise={() => setRaise({ team: room })} onChanged={() => void crew.refetch()} />
      )}
      {raise && (
        <IssueSheet state={state} slug={slug} initialTeam={raise.team} initialPlace={raise.place} onClose={() => setRaise(null)}
          onCreated={(t) => { setRaise(null); void crew.refetch(); setRoom(t); }} />
      )}
      {demo && <HeatDemo onDone={finishDemo} />}
    </div>
  );
}

function NavBtn({ active, onClick, icon, label, badge }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string; badge?: number }) {
  return (
    <button onClick={onClick} aria-current={active ? 'page' : undefined}
      className={cx('relative flex h-14 flex-1 flex-col items-center justify-center gap-0.5 rounded-full text-[11px] font-semibold', active ? 'bg-white/10 text-white' : 'text-white/55')}>
      {icon}<span className={cx(label.startsWith('CH') && 'lcd')}>{label}</span>
      {!!badge && <span className="absolute top-1.5 right-[22%] grid h-4 min-w-4 place-items-center rounded-full bg-[#d7ff3a] px-1 text-[10px] font-extrabold text-[#05060d]">{badge > 9 ? '9+' : badge}</span>}
    </button>
  );
}

function OnAirBar({ radio, onOpen }: { radio: RadioState; onOpen: () => void }) {
  const t = teamOf(radio.team);
  return (
    <div className="slide-up fixed inset-x-4 bottom-[6.2rem] z-30 mx-auto flex max-w-md items-center gap-3 rounded-full bg-[#ff3d6e] p-1.5 pl-4 shadow-xl">
      <button onClick={onOpen} className="lcd flex-1 truncate text-left text-xs font-bold">
        <span className="mr-1.5 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-white align-middle" />ON AIR · CH{String(t.ch).padStart(2, '0')} {t.short} · {radio.listeners} LISTENING
      </button>
      <button onPointerDown={() => void key(true)} onPointerUp={() => void key(false)} onPointerCancel={() => void key(false)}
        className={cx('h-10 touch-none rounded-full px-4 text-xs font-extrabold', radio.talking ? 'bg-white text-[#ff3d6e]' : 'bg-black/25')}>HOLD TO TALK</button>
      <button onClick={() => void leave()} className="grid h-10 w-10 place-items-center rounded-full bg-black/25" aria-label="Leave radio"><X size={16} /></button>
    </div>
  );
}

function IncomingRadio({ team, onAccept, onDecline }: { team: string; onAccept: () => void; onDecline: () => void }) {
  const t = teamOf(team);
  return (
    <div role="alertdialog" aria-label="Incoming radio" className="slide-up fixed inset-x-4 top-[max(4.5rem,calc(env(safe-area-inset-top)+3.5rem))] z-50 mx-auto max-w-md rounded-[26px] bg-[#0b0e22] p-4 shadow-2xl ring-1 ring-white/15">
      <p className="lcd text-[11px] font-bold" style={{ color: t.color }}>📻 CH{String(t.ch).padStart(2, '0')} {t.short} WENT LIVE</p>
      <p className="mt-1 font-display text-lg font-bold">{t.name} radio is on air</p>
      <div className="mt-3 flex gap-2">
        <button onClick={onDecline} className="h-11 flex-1 rounded-full bg-white/10 text-sm font-bold">Not now</button>
        <button onClick={onAccept} className="h-11 flex-[2] rounded-full text-sm font-extrabold text-[#05060d]" style={{ background: t.color }}>Tune in</button>
      </div>
    </div>
  );
}

function Conn({ status }: { status: string }) {
  if (status === 'offline' || status === 'kicked') {
    return <button onClick={() => void reconnectNow()} className="lcd rounded-full bg-[#ff3d6e]/20 px-3 py-1.5 text-[11px] font-bold text-[#ff8fab]">{status === 'kicked' ? 'OPEN ELSEWHERE · USE HERE' : 'OFFLINE · RETRY'}</button>;
  }
  const on = status === 'online';
  return (
    <span className="lcd flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-[11px] font-bold" role="status">
      <span className={cx('h-2 w-2 rounded-full', on ? 'bg-[#3ef0c4]' : 'animate-pulse bg-[#ffb547]')} />{on ? 'LIVE' : 'TUNING'}
    </span>
  );
}

function Center({ title, body, action, spinner }: { title: string; body?: string; action?: () => void; spinner?: boolean }) {
  return (
    <main className="crew-bg flex min-h-dvh flex-col items-center justify-center gap-3 px-8 text-center">
      {spinner && <span className="h-12 w-12 animate-spin rounded-full border-4 border-white/15 border-t-[#d7ff3a]" aria-hidden />}
      <h1 className="font-display text-2xl font-bold">{title}</h1>
      {body && <p className="max-w-[34ch] text-white/60">{body}</p>}
      {action && <button onClick={action} className="mt-2 h-12 rounded-full bg-[#d7ff3a] px-6 font-bold text-[#05060d]">Try again</button>}
    </main>
  );
}
