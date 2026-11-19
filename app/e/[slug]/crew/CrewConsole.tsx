'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { badgeFor, useEventState } from '@/lib/client/useEventState';
import { useRoom, type Me } from '@/lib/client/useRoom';
import { Centered, ConnDot } from '@/components/GigApp';
import { IncidentList } from '@/components/CrewTab';
import { IncidentRoom } from '@/components/IncidentRoom';
import { VenueMap } from '@/components/VenueMap';
import { CrewCheckIn } from '@/components/CrewCheckIn';
import { LeadControls } from '@/components/LeadControls';
import { MessageList } from '@/components/Chat/MessageList';
import { Composer } from '@/components/Chat/Composer';
import { CardRenderer } from '@/components/Cards/CardRenderer';
import { LivePill } from '@/components/ui/Poster';
import type { Incident } from '@/lib/shared/types';
import type { EventState } from '@/lib/client/useEventState';

const APP_KEY = process.env.NEXT_PUBLIC_NEXCONN_APP_KEY ?? '';
type Pane = 'reports' | 'team' | 'map';

export function CrewConsole({ slug }: { slug: string }) {
  const { state, status, refetch } = useEventState(slug);
  const [incidents, setIncidents] = useState<Incident[] | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [pane, setPane] = useState<Pane>('reports');
  const [token, setToken] = useState<string | undefined>(undefined);

  const me = useMemo(
    () => (state ? { userId: state.me.userId, name: state.me.name, appKey: APP_KEY, token } : null),
    [state?.me.userId, state?.me.name], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const load = useCallback(async () => {
    const r = await fetch(`/api/incidents?slug=${slug}`, { cache: 'no-store' });
    if (r.ok) setIncidents((await r.json()).incidents);
  }, [slug]);

  const staff = state?.me.role === 'crew' || state?.me.role === 'lead';
  useEffect(() => {
    if (staff) void load();
  }, [staff, load]);

  const crew = useRoom(staff ? state?.channels.crew ?? null : null, me, slug);
  const { onState } = crew;
  useEffect(() => onState(() => { void load(); void refetch(); }), [onState, load, refetch]);

  if (status === 'notfound') return <Centered title="This gig doesn’t exist" body="Check the crew link from your lead." />;
  if (status === 'join' || (state && !staff)) {
    return <CrewCheckIn slug={slug} knownName={state?.me.name} onDone={(_r, t) => { setToken(t); void refetch(); }} />;
  }
  if (!state) return <Centered title="Opening the crew console…" />;

  const list = incidents ?? [];
  const counts = {
    new: list.filter((i) => i.status === 'new').length,
    checking: list.filter((i) => i.status === 'checking').length,
    verified: list.filter((i) => i.status === 'verified').length,
  };

  const reports = (
    <div className="flex-1 overflow-y-auto p-4">
      {incidents === null ? (
        <p className="text-haze">Loading reports…</p>
      ) : list.length === 0 ? (
        <div className="rounded-[1.5rem] border border-dashed border-line p-5 text-sm text-haze">
          <p className="font-semibold text-mist">All quiet.</p>
          <p className="mt-1">New reports appear here the moment someone in the audience taps Help.</p>
        </div>
      ) : (
        <IncidentList incidents={list} state={state} onOpen={setOpen} selected={open} />
      )}
    </div>
  );

  return (
    <div className="flex h-dvh flex-col bg-[#0b0a10]">
      <header className="border-b border-line px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 md:px-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="rounded-md bg-spot px-2 py-1 text-xs font-extrabold tracking-wide text-ink">CREW</span>
            <div className="min-w-0">
              <h1 className="truncate font-bold leading-tight">{state.event.title}</h1>
              <p className="truncate text-xs text-haze">{state.me.name} · {state.me.role === 'lead' ? 'Lead' : 'Crew'}</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span className="hidden md:inline"><LivePill phase={state.phase} /></span>
            {state.me.role === 'lead' && <LeadControls slug={slug} phase={state.phase} onChanged={refetch} />}
            <ConnDot status={crew.status} />
          </div>
        </div>
        <div className="mt-3 flex gap-2 overflow-x-auto text-xs">
          <Stat n={counts.new} label="new" tone="bg-gel/15 text-gel" />
          <Stat n={counts.checking} label="checking" tone="bg-warn/15 text-warn" />
          <Stat n={counts.verified} label="confirmed" tone="bg-ok/15 text-ok" />
          <Link href={`/e/${slug}`} className="ml-auto shrink-0 rounded-full border border-line px-3 py-1.5 text-haze">Audience view</Link>
        </div>
      </header>

      {/* Phone: one pane at a time. Laptop: three columns. */}
      <div className="flex min-h-0 flex-1 md:grid md:grid-cols-[22rem_1fr_24rem]">
        <aside className={`min-h-0 flex-1 flex-col border-line md:flex md:border-r ${open ? 'hidden' : 'flex'}`}>
          <div className="flex gap-1 p-3 pb-0">
            {(['reports', 'team', 'map'] as Pane[]).map((p) => (
              <button
                key={p}
                onClick={() => setPane(p)}
                aria-pressed={pane === p}
                className={`h-9 flex-1 rounded-full text-sm font-semibold ${p === 'map' ? 'md:hidden' : ''} ${pane === p ? 'bg-spot text-ink' : 'bg-velvet text-haze'}`}
              >
                {p === 'reports' ? `Reports${list.length ? ` · ${list.length}` : ''}` : p === 'team' ? 'Team chat' : 'Map'}
              </button>
            ))}
          </div>
          {pane === 'reports' && reports}
          {pane === 'team' && <TeamChat state={state} slug={slug} me={me} room={crew} />}
          {pane === 'map' && <div className="flex min-h-0 flex-1 flex-col md:hidden"><VenueMap state={state} /></div>}
        </aside>

        <section className={`min-h-0 flex-1 flex-col ${open ? 'flex' : 'hidden md:flex'}`}>
          {open ? (
            <IncidentRoom key={open} incidentId={open} state={state} slug={slug} me={me} onBack={() => { setOpen(null); void load(); }} onChanged={load} />
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center">
              <span className="text-4xl" aria-hidden>🎧</span>
              <p className="text-lg font-bold">Pick a report</p>
              <p className="max-w-[36ch] text-sm text-haze">Chat with the person who sent it, draft an update for the audience, and approve it.</p>
            </div>
          )}
        </section>

        <aside className="hidden min-h-0 flex-col border-l border-line md:flex">
          <VenueMap state={state} />
        </aside>
      </div>
    </div>
  );
}

function Stat({ n, label, tone }: { n: number; label: string; tone: string }) {
  return (
    <span className={`shrink-0 rounded-full px-3 py-1.5 font-semibold ${tone}`}>
      {n} {label}
    </span>
  );
}

function TeamChat({ state, slug, me: _me, room }: { state: EventState; slug: string; me: Me | null; room: ReturnType<typeof useRoom> }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <MessageList
        messages={room.messages}
        loading={room.loading}
        roleOf={(id) => badgeFor(state, id)}
        renderCustom={(m) => <CardRenderer msg={m} state={state} slug={slug} onChanged={() => {}} />}
        empty={<p className="rounded-[1.5rem] border border-dashed border-line p-4 text-sm text-haze">Crew-only chat. The audience never sees this. New reports are posted here too.</p>}
      />
      <Composer disabled={room.status !== 'online'} onText={room.sendText} onImage={room.sendImage} placeholder="Message the crew" />
    </div>
  );
}
