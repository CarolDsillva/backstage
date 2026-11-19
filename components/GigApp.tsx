'use client';
import { useEffect, useMemo, useState } from 'react';
import { badgeFor, useEventState } from '@/lib/client/useEventState';
import { useRoom } from '@/lib/client/useRoom';
import { reconnectNow } from '@/lib/client/nexconn';
import { JoinScreen } from './JoinScreen';
import { PhaseTrack } from './PhaseTrack';
import { Banner } from './Banner';
import { MessageList } from './Chat/MessageList';
import { Composer } from './Chat/Composer';
import { CardRenderer } from './Cards/CardRenderer';
import { NewCardSheet } from './Cards/NewCardSheet';
import { VenueMap } from './VenueMap';
import { CrewTab } from './CrewTab';
import { FanTab } from './FanTab';
import { ReportSheet } from './ReportSheet';
import { LeadControls } from './LeadControls';

type Tab = 'room' | 'map' | 'crew' | 'fan';

const APP_KEY = process.env.NEXT_PUBLIC_NEXCONN_APP_KEY ?? '';

export function GigApp({ slug }: { slug: string }) {
  const { state, status, refetch } = useEventState(slug);
  const [tab, setTab] = useState<Tab>('room');
  const [newCard, setNewCard] = useState(false);
  const [reportPlace, setReportPlace] = useState<string | null | undefined>(undefined);
  const [joinToken, setJoinToken] = useState<string | undefined>(undefined);

  const me = useMemo(
    () => (state ? { userId: state.me.userId, name: state.me.name, appKey: APP_KEY, token: joinToken } : null),
    [state?.me.userId, state?.me.name], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const room = useRoom(state?.channels.gig ?? null, me, slug);

  // Every BS:State signal in the gig room means "shared state changed": refetch it.
  const { onState } = room;
  useEffect(() => onState(() => void refetch()), [onState, refetch]);

  if (status === 'join') return <JoinScreen slug={slug} onJoined={(t) => { setJoinToken(t); void refetch(); }} />;
  if (status === 'notfound') return <Centered title="This gig doesn’t exist" body="Check the link or scan the QR code at the venue again." />;
  if (status === 'error') return <Centered title="Can’t reach Backstage" body="Check your connection, then reload the page." action={{ label: 'Try again', onClick: refetch }} />;
  if (!state) return <Centered title="Getting the room ready…" />;

  const { event, phase, me: who } = state;
  const staff = who.role === 'crew' || who.role === 'lead';
  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: 'room', label: 'Room', icon: '💬' },
    { id: 'map', label: 'Map', icon: '🗺️' },
    { id: 'crew', label: staff ? 'Crew' : 'Help', icon: staff ? '🎧' : '🙋' },
    ...(phase === 'after' ? [{ id: 'fan' as Tab, label: 'Fan club', icon: '💌' }] : []),
  ];

  return (
    <div className="stage-light flex h-dvh flex-col">
      <header className="px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="truncate text-xl font-bold tracking-tight">{event.title}</h1>
            <p className="truncate text-sm text-haze">{event.venue}</p>
          </div>
          <ConnDot status={room.status} />
        </div>
        <div className="mt-2 flex items-center justify-between gap-2">
          <PhaseTrack phase={phase} />
          {who.role === 'lead' && <LeadControls slug={slug} phase={phase} onChanged={refetch} />}
        </div>
      </header>

      <Banner conditions={state.conditions} places={state.places} onOpenMap={() => setTab('map')} />

      <main className="flex min-h-0 flex-1 flex-col">
        {tab === 'room' && (
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
              onPlus={() => setNewCard(true)}
              placeholder={phase === 'after' ? 'Share how the night felt' : 'Say something to the room'}
            />
          </>
        )}
        {tab === 'map' && <VenueMap state={state} onReport={(placeId) => setReportPlace(placeId)} />}
        {tab === 'crew' && <CrewTab state={state} slug={slug} me={me} onReport={() => setReportPlace(null)} />}
        {tab === 'fan' && <FanTab state={state} slug={slug} messages={room.messages} onChanged={refetch} />}
      </main>

      <nav className="grid border-t border-line bg-night pb-[env(safe-area-inset-bottom)]" style={{ gridTemplateColumns: `repeat(${tabs.length}, 1fr)` }}>
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            aria-current={tab === t.id ? 'page' : undefined}
            className={`flex h-14 flex-col items-center justify-center gap-0.5 text-xs ${tab === t.id ? 'text-spot' : 'text-haze'}`}
          >
            <span aria-hidden className="text-lg leading-none">{t.icon}</span>
            {t.label}
          </button>
        ))}
      </nav>

      {newCard && (
        <NewCardSheet state={state} slug={slug} onClose={() => setNewCard(false)} onReport={() => { setNewCard(false); setReportPlace(null); }} />
      )}
      {reportPlace !== undefined && (
        <ReportSheet
          state={state}
          slug={slug}
          initialPlaceId={reportPlace}
          onClose={() => setReportPlace(undefined)}
          onCreated={() => { setReportPlace(undefined); setTab('crew'); void refetch(); }}
        />
      )}
    </div>
  );
}

export function ConnDot({ status }: { status: string }) {
  if (status === 'kicked' || status === 'offline') {
    return (
      <button
        onClick={() => void reconnectNow()}
        className="mt-1 flex shrink-0 items-center gap-1.5 rounded-full border border-gel/50 px-2.5 py-1 text-xs text-gel"
      >
        <span className="h-2 w-2 rounded-full bg-gel" aria-hidden />
        {status === 'kicked' ? 'Open in another tab. Use it here' : 'Offline. Tap to retry'}
      </button>
    );
  }
  const label = status === 'online' ? 'Live' : status === 'reconnecting' ? 'Reconnecting…' : 'Connecting…';
  const color = status === 'online' ? 'bg-ok' : 'animate-pulse bg-spot';
  return (
    <span className="mt-1 flex shrink-0 items-center gap-1.5 text-xs text-haze" role="status">
      <span className={`h-2 w-2 rounded-full ${color}`} aria-hidden />
      {label}
    </span>
  );
}

function RoomEmpty({ phase }: { phase: string }) {
  const lines: Record<string, string> = {
    before: 'Nobody’s said hi yet. Going alone? Tap + and post “Going solo” so others can find you.',
    live: 'The room is quiet. Tap + to request a song and get the crowd voting.',
    after: 'The show’s over, but the room stays open. Drop your photos and say what you loved.',
  };
  return <p className="rounded-2xl border border-dashed border-line p-4 text-sm text-haze">{lines[phase]}</p>;
}

export function Centered({ title, body, action }: { title: string; body?: string; action?: { label: string; onClick: () => void } }) {
  return (
    <main className="stage-light flex min-h-dvh flex-col items-center justify-center gap-2 px-8 text-center">
      <h1 className="text-xl font-semibold">{title}</h1>
      {body && <p className="max-w-[34ch] text-haze">{body}</p>}
      {action && (
        <button onClick={action.onClick} className="mt-3 h-11 rounded-full bg-spot px-5 font-semibold text-ink">
          {action.label}
        </button>
      )}
    </main>
  );
}
