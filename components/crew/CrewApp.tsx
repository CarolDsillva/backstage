'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Bell, Eye, HelpCircle, Map as MapIcon, MessageCircle, Plus, Radio, X } from 'lucide-react';
import { useCrew } from '@/lib/client/useCrew';
import { onMessage, reconnectNow, type ChatMsg } from '@/lib/client/nexconn';
import { acceptIncoming, declineIncoming, onRadio, type RadioState } from '@/lib/client/radio';
import { isRenderable } from '@/lib/shared/trust';
import { BS_TYPES, type Incident } from '@/lib/shared/types';
import { team as teamOf, type TeamId } from '@/lib/shared/teams';
import { Alerts } from '@/components/comms/Alerts';
import { ChatList, ChatView } from '@/components/comms/Chats';
import { Walkie } from '@/components/comms/Walkie';
import { MapView } from '@/components/comms/MapView';
import { IssueSheet } from '@/components/comms/IssueSheet';
import { Enter } from '@/components/comms/Enter';
import { DEMO_TOUR, VIEWER_TOUR, Tour, tourSignal, type TourStep } from '@/components/comms/Tour';
import { firstName, preview } from '@/components/comms/Messages';
import { TeamBadge, beep, cx, useNow } from '@/components/comms/ui';
import { TeamPicker } from './TeamPicker';
import { Inbox } from './Inbox';

type Tab = 'alerts' | 'chats' | 'walkie' | 'map';
type Toast = { id: string; team: TeamId; who: string; text: string; critical: boolean };

const CREW_TOUR: TourStep[] = [
  { title: 'You’re on the crew 📻', body: 'Backstage is your team’s radio, chat and alert board in one place. Quick look around?', cta: 'Show me' },
  { target: 'tab-chats', wait: 'click', title: 'Your channels', body: 'Control (all hands) plus your team. Open Chats.' },
  { target: 'tab-walkie', wait: 'click', title: 'The walkie', body: 'Hold the big button to talk on your channel when your hands are full.' },
  { target: 'tab-map', wait: 'click', title: 'The map', body: 'Every open issue, pinned where it is.' },
  { target: 'raise', title: 'Something wrong?', body: 'Tap + to raise an issue. It goes to the team, to everyone’s alerts and to the map.', cta: 'Done' },
];

export function CrewApp({ slug }: { slug: string }) {
  const crew = useCrew(slug);
  const { state, status } = crew;
  const [tab, setTab] = useState<Tab>('alerts');
  const [chat, setChat] = useState<TeamId | null>(null);
  const [walkieTeam, setWalkieTeam] = useState<TeamId | null>(null);
  const [raise, setRaise] = useState<{ team: TeamId; place?: string } | null>(null);
  const [inbox, setInbox] = useState(false);
  const [tour, setTour] = useState<TourStep[] | null>(null);
  const [tourIssue, setTourIssue] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [radio, setRadio] = useState<RadioState | null>(null);
  const [notif, setNotif] = useState<NotificationPermission | 'unsupported'>('default');
  const [switching, setSwitching] = useState(false);
  const now = useNow(15_000);
  const chatRef = useRef<TeamId | null>(null);
  const tourOn = useRef(false);
  const demo = !!state?.event.refs?.demo;
  const viewer = !!state?.me.viewer;

  useEffect(() => onRadio(setRadio), []);
  useEffect(() => { setNotif(typeof Notification === 'undefined' ? 'unsupported' : Notification.permission); }, []);
  useEffect(() => { chatRef.current = chat; crew.setOpenRoom(chat); }, [chat]); // eslint-disable-line react-hooks/exhaustive-deps

  // First visit: the hands-on walkthrough.
  const tourKey = state ? `bs_tour2_${slug}_${state.me.userId}` : '';
  useEffect(() => {
    if (!state || (!state.me.team && !viewer)) return;
    try {
      if (localStorage.getItem(tourKey)) return;
      setTour(viewer ? VIEWER_TOUR : demo && state.me.role === 'lead' ? DEMO_TOUR : CREW_TOUR);
    } catch { /* storage blocked */ }
  }, [state?.me.userId, state?.me.team]); // eslint-disable-line react-hooks/exhaustive-deps
  // Pin the tour to the critical issue the visitor starts with.
  useEffect(() => {
    if (!tour || tourIssue || !state) return;
    const i = state.issues.find((x) => x.severity === 'critical' && x.status === 'new' && x.team === 'security');
    if (i) setTourIssue(i.id);
  }, [tour, state, tourIssue]);
  useEffect(() => { tourOn.current = !!tour; }, [tour]);
  const endTour = () => { try { localStorage.setItem(tourKey, '1'); } catch { /* ignore */ } setTour(null); };

  // Demo Fest: keep the show busy while someone is watching.
  useEffect(() => {
    if (!demo || viewer || !state) return;
    const go = () => { if (document.visibilityState === 'visible' && !tourOn.current) void fetch(`/api/demo/${slug}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'tick' }) }).catch(() => {}); };
    const first = setTimeout(go, 6000);
    const id = setInterval(go, 20_000);
    return () => { clearTimeout(first); clearInterval(id); };
  }, [demo, viewer, slug, !!state]); // eslint-disable-line react-hooks/exhaustive-deps

  const demoReact = useCallback((action: 'took' | 'message' | 'fixed', team: TeamId) => {
    if (!demo) return;
    setTimeout(() => void fetch(`/api/demo/${slug}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action, team }) }).catch(() => {}), 1800);
  }, [demo, slug]);

  // Notifications: in-app toast for anything new outside the open chat; sound + system alert for issues.
  const teamOfChannel = useRef(new Map<string, TeamId>());
  useEffect(() => {
    const m = new Map<string, TeamId>();
    if (state) for (const [t, ch] of Object.entries(state.channels)) if (ch) m.set(ch, t as TeamId);
    teamOfChannel.current = m;
  }, [state]);
  useEffect(() => onMessage((m: ChatMsg) => {
    const t = teamOfChannel.current.get(m.channelId);
    if (!t || m.mine || !isRenderable(m) || m.type === BS_TYPES.state || m.type === BS_TYPES.issueUpdate) return;
    const c = m.content as Record<string, unknown>;
    const critical = m.type === BS_TYPES.issue && c.severity === 'critical';
    if (m.type === BS_TYPES.issue) beep(critical);
    if (document.visibilityState !== 'visible' && typeof Notification !== 'undefined' && Notification.permission === 'granted' && (m.type === BS_TYPES.issue || m.type === BS_TYPES.announce)) {
      try { new Notification(`${teamOf(t).name}${critical ? ' · CRITICAL' : ''}`, { body: preview(m), tag: m.id }); } catch { /* ignore */ }
    }
    if (chatRef.current === t) return;
    const toast: Toast = { id: m.id, team: t, who: m.senderId === 'backstagebot' ? firstName(String(c.reporterName ?? c.by ?? 'Backstage')) : firstName(m.senderName), text: preview(m), critical };
    setToasts((x) => [toast, ...x.filter((y) => y.id !== toast.id)].slice(0, 2));
    setTimeout(() => setToasts((x) => x.filter((y) => y.id !== toast.id)), critical ? 9000 : 5000);
  }), []);

  if (status === 'notfound') return <Center title="This event doesn’t exist" body="Check the link from your show caller." />;
  if (status === 'checkin') return <Enter slug={slug} onDone={(t) => { crew.setToken(t); void crew.refetch(); }} />;
  if (status === 'error' && !state) return <Center title="Can’t reach backstage" body="Check your connection." action={() => void crew.refetch()} />;
  if (!state) return <Center title="Getting your radio…" spinner />;
  if ((!state.me.team && !viewer) || switching) {
    return <TeamPicker slug={slug} name={state.me.name} isLead={state.me.role === 'lead'} current={state.me.team}
      onDone={() => { setSwitching(false); void crew.refetch(); }} onCancel={switching ? () => setSwitching(false) : undefined} />;
  }

  const home: TeamId = state.me.team ?? 'control';
  const wTeam: TeamId = walkieTeam && state.canOpen.includes(walkieTeam) ? walkieTeam : home;
  const openChat = (t: TeamId) => { if (state.canOpen.includes(t)) setChat(t); };
  const unreadTotal = Object.values(crew.unread).reduce((a, b) => a + (b ?? 0), 0);
  const openCount = state.issues.filter((i) => i.status !== 'resolved').length;
  const started = new Date(state.event.startsAt).getTime();
  const liveFor = state.phase === 'live' && now > started ? Math.floor((now - started) / 60000) : null;
  const raahe = state.event.artist === 'Raahe';

  const onIssueAction = (a: 'take' | 'fix', i: Incident) => { demoReact(a === 'take' ? 'took' : 'fixed', (i.team ?? 'security') as TeamId); };

  return (
    <div className="min-h-dvh bg-[#0B0620]">
      <div className="cosmos relative mx-auto min-h-dvh max-w-[480px] text-white">
        <header className="sticky top-0 z-30 flex items-center gap-3 bg-[#160B36]/80 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 backdrop-blur">
          <Link href="/" aria-label="All events" className="shrink-0">
            {raahe
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src="/raahe-logo.png" alt="" className="h-11 w-11 rounded-[14px]" />
              // eslint-disable-next-line @next/next/no-img-element
              : <img src="/demofest-logo.svg" alt="" className="h-11 w-11 rounded-[14px]" />}
          </Link>
          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-[19px] leading-tight font-extrabold">{state.event.title}</p>
            <p className="flex items-center gap-1.5 truncate text-xs text-[#B8ABE6]">
              {state.phase === 'live' && <span className="flex items-center gap-1 rounded-full bg-[#FF6B5B] px-1.5 py-px text-[10px] font-bold text-white"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#251856]" />LIVE{liveFor !== null && liveFor < 600 ? ` ${Math.floor(liveFor / 60)}:${String(liveFor % 60).padStart(2, '0')}` : ''}</span>}
              {viewer ? <span className="flex items-center gap-1 font-semibold text-[#B7AEFF]"><Eye size={12} />Viewing as guest</span>
                : <span>{state.me.name.startsWith('You · ') ? `You · ${state.me.role === 'lead' ? 'Show caller' : teamOf(home).name}` : `${firstName(state.me.name)} · ${state.me.role === 'lead' ? 'Show caller' : teamOf(home).name}`}</span>}
            </p>
          </div>
          <Conn status={crew.conn} />
          <button onClick={() => { setChat(null); setTab('alerts'); setTourIssue(null); setTour(viewer ? VIEWER_TOUR : demo && state.me.role === 'lead' ? DEMO_TOUR : CREW_TOUR); }}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#251856]" aria-label="Replay the walkthrough"><HelpCircle size={19} /></button>
        </header>

        <div className="px-4 pb-3">
          <h1 className="grad-text font-display text-[38px] leading-none font-extrabold tracking-tight">
            {tab === 'alerts' ? 'Alerts' : tab === 'chats' ? 'Chats' : tab === 'walkie' ? 'Walkie' : 'Live map'}
          </h1>
        </div>

        <main>
          {tab === 'alerts' && <Alerts state={state} feed={crew.feed} now={now} slug={slug} viewer={viewer} notif={notif}
            onEnableNotif={() => void Notification.requestPermission().then(setNotif)} onOpenChat={openChat} onChanged={() => void crew.refetch()}
            onIssueAction={onIssueAction} tourIssueId={tour ? tourIssue : null} />}
          {tab === 'chats' && <ChatList state={state} feed={crew.feed} unread={crew.unread} now={now} onOpen={openChat} onInbox={() => setInbox(true)} />}
          {tab === 'walkie' && <Walkie state={state} teamId={wTeam} slug={slug} viewer={viewer} onChange={setWalkieTeam} onSent={() => tourSignal('voice')} />}
          {tab === 'map' && <MapView state={state} now={now} viewer={viewer} onOpenChat={openChat} onRaise={(p) => setRaise({ team: home, place: p })} />}
          {state.me.role === 'lead' && !viewer && tab === 'alerts' && !demo && (
            <p className="-mt-28 px-6 pb-32 text-center text-xs text-[#8C7FC0]">
              <button onClick={() => setSwitching(true)} className="underline">Change my team</button> · <Link href={`/e/${slug}/crew/reports`} className="underline">Audience help reports</Link>
            </p>
          )}
        </main>

        {/* Toasts */}
        <div className="pointer-events-none fixed inset-x-0 top-[max(4.6rem,calc(env(safe-area-inset-top)+4rem))] z-50 mx-auto flex max-w-[480px] flex-col gap-2 px-3">
          {toasts.map((t) => (
            <button key={t.id} onClick={() => { setToasts((x) => x.filter((y) => y.id !== t.id)); openChat(t.team); }}
              className={cx('pop-in pointer-events-auto flex items-center gap-3 rounded-[22px] p-3 text-left shadow-[0_16px_30px_-12px_rgba(23,20,31,.45)]', t.critical ? 'bg-[#FF6B5B] text-white' : 'bg-[#251856]')}>
              <TeamBadge team={t.team} size={38} />
              <span className="min-w-0 flex-1">
                <span className="block text-xs font-bold">{t.critical ? 'CRITICAL · ' : ''}{teamOf(t.team).name} · {t.who}</span>
                <span className="block truncate text-sm">{t.text}</span>
              </span>
              <X size={16} className="shrink-0 opacity-50" />
            </button>
          ))}
        </div>

        {radio?.incoming && (
          <div role="alertdialog" aria-label="Open line" className="slide-up fixed inset-x-3 top-20 z-50 mx-auto max-w-[460px] rounded-[26px] bg-[#7C4DFF] p-4 text-white">
            <p className="text-xs font-bold text-[#FF9CCB]">📻 {teamOf(radio.incoming.team).name} opened a live line</p>
            <div className="mt-3 flex gap-2">
              <button onClick={() => void declineIncoming()} className="h-11 flex-1 rounded-full bg-white/10 text-sm font-bold">Not now</button>
              <button onClick={() => { acceptIncoming(); setWalkieTeam(radio.incoming!.team as TeamId); setTab('walkie'); }} className="h-11 flex-[2] rounded-full bg-[#EC4F9B] text-sm font-extrabold">Join</button>
            </div>
          </div>
        )}

        {/* Bottom nav: black pill */}
        <nav aria-label="Sections" className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-[480px] px-4 pb-[max(0.9rem,env(safe-area-inset-bottom))]">
          <div className="flex items-center gap-1 rounded-full border border-white/10 bg-[#0E0726]/85 p-1.5 shadow-[0_18px_40px_-14px_rgba(0,0,0,.8)] backdrop-blur-xl">
            <NavBtn tour="tab-alerts" active={tab === 'alerts'} onClick={() => { setTab('alerts'); setChat(null); }} icon={<Bell size={20} />} label="Alerts" badge={openCount} />
            <NavBtn tour="tab-chats" active={tab === 'chats'} onClick={() => { setTab('chats'); setChat(null); }} icon={<MessageCircle size={20} />} label="Chats" badge={unreadTotal} />
            {!viewer && (
              <button data-tour="raise" onClick={() => setRaise({ team: home })} aria-label="Raise an issue"
                className="grid h-14 w-14 shrink-0 place-items-center rounded-full orb text-white transition-transform active:scale-95"><Plus size={26} strokeWidth={2.6} /></button>
            )}
            <NavBtn tour="tab-walkie" active={tab === 'walkie'} onClick={() => { setTab('walkie'); setChat(null); }} icon={<Radio size={20} />} label="Walkie" />
            <NavBtn tour="tab-map" active={tab === 'map'} onClick={() => { setTab('map'); setChat(null); }} icon={<MapIcon size={20} />} label="Map" />
          </div>
        </nav>

        {chat && (
          <ChatView state={state} teamId={chat} slug={slug} viewer={viewer} onBack={() => setChat(null)} onRaise={() => setRaise({ team: chat })}
            onWalkie={() => { setWalkieTeam(chat); setTab('walkie'); setChat(null); }}
            onSent={(k) => { tourSignal(k === 'voice' ? 'voice' : 'sent'); if (k === 'text' && (tour || demo)) demoReact('message', chat); }} />
        )}
        {raise && (
          <IssueSheet state={state} slug={slug} initialTeam={raise.team} initialPlace={raise.place} onClose={() => setRaise(null)}
            onCreated={(t) => { setRaise(null); void crew.refetch(); setChat(t); }} />
        )}
        {inbox && (
          <div className="fixed inset-0 z-[45] mx-auto flex max-w-[480px] flex-col bg-[#160B36] pt-[max(0.75rem,env(safe-area-inset-top))]">
            <div className="flex items-center gap-3 px-3 pb-3">
              <button onClick={() => setInbox(false)} className="grid h-11 w-11 place-items-center rounded-full bg-[#251856]" aria-label="Back"><ArrowLeft size={20} /></button>
              <p className="font-display text-xl font-extrabold">Classic inbox</p>
            </div>
            <div className="min-h-0 flex-1"><Inbox /></div>
          </div>
        )}
        {tour && <Tour steps={tour} onDone={endTour} />}
      </div>
    </div>
  );
}

function NavBtn({ active, onClick, icon, label, badge, tour }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string; badge?: number; tour: string }) {
  return (
    <button data-tour={tour} onClick={onClick} aria-current={active ? 'page' : undefined}
      className={cx('relative flex h-14 flex-1 flex-col items-center justify-center gap-0.5 rounded-full text-[11px] font-semibold transition-colors', active ? 'bg-[#7C4DFF] text-white shadow-[0_0_20px_rgba(124,77,255,.6)]' : 'text-white/55')}>
      {icon}<span>{label}</span>
      {!!badge && <span className="absolute top-1 right-[18%] grid h-[18px] min-w-[18px] place-items-center rounded-full bg-[#EC4F9B] px-1 text-[10px] font-bold text-white">{badge > 99 ? '99+' : badge}</span>}
    </button>
  );
}

function Conn({ status }: { status: string }) {
  if (status === 'offline' || status === 'kicked') {
    return <button onClick={() => void reconnectNow()} className="shrink-0 rounded-full bg-[#4A1D3F] px-3 py-1.5 text-[11px] font-bold text-[#FF9A8F]">{status === 'kicked' ? 'Open elsewhere · use here' : 'Offline · retry'}</button>;
  }
  const on = status === 'online';
  return <span role="status" aria-label={on ? 'Connected' : 'Connecting'} className={cx('h-2.5 w-2.5 shrink-0 rounded-full', on ? 'bg-[#2FB392]' : 'animate-pulse bg-[#F2A900]')} />;
}

function Center({ title, body, action, spinner }: { title: string; body?: string; action?: () => void; spinner?: boolean }) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col items-center justify-center gap-3 bg-[#160B36] px-8 text-center text-white">
      {spinner && <span className="h-12 w-12 animate-spin rounded-full border-4 border-[#33236B] border-t-[#EC4F9B]" aria-hidden />}
      <h1 className="font-display text-2xl font-extrabold">{title}</h1>
      {body && <p className="max-w-[34ch] text-[#B8ABE6]">{body}</p>}
      {action && <button onClick={action} className="mt-2 h-12 rounded-full bg-[#7C4DFF] px-6 font-bold text-white">Try again</button>}
    </main>
  );
}
