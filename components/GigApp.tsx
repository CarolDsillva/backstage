'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { badgeFor, useEventState } from '@/lib/client/useEventState';
import { useRoom } from '@/lib/client/useRoom';
import { reconnectNow } from '@/lib/client/nexconn';
import { JoinScreen } from './JoinScreen';
import { MessageList } from './Chat/MessageList';
import { Composer } from './Chat/Composer';
import { CardRenderer } from './Cards/CardRenderer';
import { NewCardSheet } from './Cards/NewCardSheet';
import { VenueMap } from './VenueMap';
import { CrewTab } from './CrewTab';
import { FanTab } from './FanTab';
import { ReportSheet } from './ReportSheet';
import { LeadControls } from './LeadControls';
import { TonightTab } from './TonightTab';
import { Onboarding, AUDIENCE_SLIDES, onboardedKey } from './Onboarding';
import { Avatar } from './ui/Avatar';
import type { CardType } from '@/lib/shared/types';

type Tab = 'tonight' | 'chat' | 'map' | 'help' | 'fan';

const APP_KEY = process.env.NEXT_PUBLIC_NEXCONN_APP_KEY ?? '';

export function GigApp({ slug }: { slug: string }) {
  const { state, status, refetch } = useEventState(slug);
  const [tab, setTab] = useState<Tab>('tonight');
  const [newCard, setNewCard] = useState<CardType | null | false>(false);
  const [reportPlace, setReportPlace] = useState<string | null | undefined>(undefined);
  const [joinToken, setJoinToken] = useState<string | undefined>(undefined);
  const [onboarding, setOnboarding] = useState(false);

  const me = useMemo(
    () => (state ? { userId: state.me.userId, name: state.me.name, appKey: APP_KEY, token: joinToken } : null),
    [state?.me.userId, state?.me.name], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const room = useRoom(state?.channels.gig ?? null, me, slug);

  // Every BS:State signal in the gig room means "shared state changed": refetch it.
  const { onState } = room;
  useEffect(() => onState(() => void refetch()), [onState, refetch]);

  // First visit after joining: show the three tips once.
  useEffect(() => {
    if (!state || state.me.role !== 'attendee') return;
    try {
      if (!localStorage.getItem(onboardedKey(slug, 'audience'))) setOnboarding(true);
    } catch {
      // storage blocked: skip tips
    }
  }, [state?.me.userId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (status === 'join') return <JoinScreen slug={slug} onJoined={(t) => { setJoinToken(t); void refetch(); }} />;
  if (status === 'notfound') return <Centered title="This gig doesn’t exist" body="Check the link or scan the QR code at the venue again." />;
  if (status === 'error') return <Centered title="Can’t reach Backstage" body="Check your connection, then reload the page." action={{ label: 'Try again', onClick: refetch }} />;
  if (!state) return <Splash />;

  const { phase, me: who } = state;
  const staff = who.role === 'crew' || who.role === 'lead';
  const fourth: { id: Tab; label: string; icon: string } = phase === 'after' ? { id: 'fan', label: 'Fan club', icon: '💌' } : { id: 'map', label: 'Map', icon: '🗺️' };
  const left: { id: Tab; label: string; icon: string }[] = [
    { id: 'tonight', label: 'Tonight', icon: '✨' },
    { id: 'chat', label: 'Chat', icon: '💬' },
  ];
  const right = [fourth, { id: 'help' as Tab, label: staff ? 'Crew' : 'Help', icon: staff ? '🎧' : '🛟' }];

  return (
    <div className="stage-light flex h-dvh flex-col">
      <header className="flex items-center justify-between gap-3 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar name={who.name} seed={who.userId} size={40} />
          <div className="min-w-0">
            <p className="text-xs text-haze">Hey, {who.name.split(' ')[0]}</p>
            <h1 className="truncate text-lg font-bold leading-tight">{tab === 'chat' ? 'The room' : state.event.title}</h1>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {staff && (
            <Link href={`/e/${slug}/crew`} className="rounded-full bg-spot px-3 py-1.5 text-xs font-bold text-ink">Crew console</Link>
          )}
          {who.role === 'lead' && <LeadControls slug={slug} phase={phase} onChanged={refetch} />}
          <ConnDot status={room.status} />
        </div>
      </header>

      <main className="flex min-h-0 flex-1 flex-col">
        {tab === 'tonight' && (
          <TonightTab
            state={state}
            onNewCard={(t) => setNewCard(t)}
            onReport={() => setReportPlace(null)}
            onOpen={(t) => setTab(t)}
          />
        )}
        {tab === 'chat' && (
          <>
            <MessageList
              messages={room.messages}
              roleOf={(id) => badgeFor(state, id)}
              loading={room.loading}
              renderCustom={(m) => <CardRenderer msg={m} state={state} slug={slug} onChanged={refetch} />}
              empty={<RoomEmpty phase={phase} />}
            />
            <Composer
              disabled={room.status !== 'online'}
              onText={room.sendText}
              onImage={room.sendImage}
              placeholder={phase === 'after' ? 'Share how the night felt' : 'Say something to the room'}
            />
          </>
        )}
        {tab === 'map' && <VenueMap state={state} onReport={(placeId) => setReportPlace(placeId)} />}
        {tab === 'help' && <CrewTab state={state} slug={slug} me={me} onReport={() => setReportPlace(null)} />}
        {tab === 'fan' && <FanTab state={state} slug={slug} messages={room.messages} onChanged={refetch} />}
      </main>

      <nav className="relative grid grid-cols-5 items-end border-t border-line bg-night/95 pb-[env(safe-area-inset-bottom)] backdrop-blur" aria-label="Sections">
        {left.map((t) => <NavButton key={t.id} t={t} active={tab === t.id} onClick={() => setTab(t.id)} />)}
        <div className="flex justify-center">
          <button
            onClick={() => setNewCard(null)}
            aria-label="Add to the room: song, meetup, ride, poll or report"
            className="-mt-7 mb-2 grid h-16 w-16 place-items-center rounded-full bg-spot text-3xl font-light text-ink shadow-[0_12px_30px_-8px_rgb(198_243_107/.7)] ring-4 ring-night transition-transform active:scale-95"
          >
            +
          </button>
        </div>
        {right.map((t) => <NavButton key={t.id} t={t} active={tab === t.id} onClick={() => setTab(t.id)} />)}
      </nav>

      {newCard !== false && (
        <NewCardSheet
          state={state}
          slug={slug}
          initialType={newCard}
          onClose={() => setNewCard(false)}
          onPosted={() => { setNewCard(false); setTab('chat'); void refetch(); }}
          onReport={() => { setNewCard(false); setReportPlace(null); }}
        />
      )}
      {reportPlace !== undefined && (
        <ReportSheet
          state={state}
          slug={slug}
          initialPlaceId={reportPlace}
          onClose={() => setReportPlace(undefined)}
          onCreated={() => { setReportPlace(undefined); setTab('help'); void refetch(); }}
        />
      )}
      {onboarding && (
        <Onboarding slides={AUDIENCE_SLIDES} storageKey={onboardedKey(slug, 'audience')} name={who.name.split(' ')[0]} onDone={() => setOnboarding(false)} />
      )}
    </div>
  );
}

function NavButton({ t, active, onClick }: { t: { label: string; icon: string }; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={`flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-semibold ${active ? 'text-spot' : 'text-haze'}`}
    >
      <span aria-hidden className={`text-lg leading-none transition-transform ${active ? 'scale-110' : 'opacity-80'}`}>{t.icon}</span>
      {t.label}
    </button>
  );
}

export function ConnDot({ status }: { status: string }) {
  if (status === 'kicked' || status === 'offline') {
    return (
      <button onClick={() => void reconnectNow()} className="flex items-center gap-1.5 rounded-full border border-gel/50 px-2.5 py-1 text-xs text-gel">
        <span className="h-2 w-2 rounded-full bg-gel" aria-hidden />
        {status === 'kicked' ? 'Open elsewhere. Use here' : 'Offline. Retry'}
      </button>
    );
  }
  const label = status === 'online' ? 'Live' : status === 'reconnecting' ? 'Reconnecting…' : 'Connecting…';
  return (
    <span className="flex items-center gap-1.5 rounded-full bg-velvet px-2.5 py-1 text-xs text-haze" role="status">
      <span className={`h-2 w-2 rounded-full ${status === 'online' ? 'bg-ok' : 'animate-pulse bg-warn'}`} aria-hidden />
      {label}
    </span>
  );
}

function RoomEmpty({ phase }: { phase: string }) {
  const lines: Record<string, string> = {
    before: 'Nobody’s said hi yet. Going alone? Tap + and post “I’m going solo” so others can find you.',
    live: 'The room is quiet. Tap + to request a song and get the crowd voting.',
    after: 'The show’s over, but the room stays open. Drop your photos and say what you loved.',
  };
  return <p className="rounded-[1.5rem] border border-dashed border-line p-4 text-sm text-haze">{lines[phase]}</p>;
}

function Splash() {
  return (
    <main className="stage-light flex min-h-dvh flex-col items-center justify-center gap-4">
      <span className="h-12 w-12 animate-spin rounded-full border-4 border-line border-t-spot" aria-hidden />
      <p className="text-haze">Opening the room…</p>
    </main>
  );
}

export function Centered({ title, body, action }: { title: string; body?: string; action?: { label: string; onClick: () => void } }) {
  return (
    <main className="stage-light flex min-h-dvh flex-col items-center justify-center gap-2 px-8 text-center">
      <h1 className="text-xl font-bold">{title}</h1>
      {body && <p className="max-w-[34ch] text-haze">{body}</p>}
      {action && (
        <button onClick={action.onClick} className="mt-3 h-12 rounded-full bg-spot px-6 font-bold text-ink">
          {action.label}
        </button>
      )}
    </main>
  );
}
