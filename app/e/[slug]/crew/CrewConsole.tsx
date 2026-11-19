'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useEventState } from '@/lib/client/useEventState';
import { useRoom } from '@/lib/client/useRoom';
import { JoinScreen } from '@/components/JoinScreen';
import { Centered } from '@/components/GigApp';
import { IncidentList } from '@/components/CrewTab';
import { IncidentRoom } from '@/components/IncidentRoom';
import { VenueMap } from '@/components/VenueMap';
import { PhaseTrack } from '@/components/PhaseTrack';
import type { Incident } from '@/lib/shared/types';

const APP_KEY = process.env.NEXT_PUBLIC_NEXCONN_APP_KEY ?? '';

export function CrewConsole({ slug }: { slug: string }) {
  const { state, status, refetch } = useEventState(slug);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [open, setOpen] = useState<string | null>(null);

  const me = useMemo(
    () => (state ? { userId: state.me.userId, name: state.me.name, appKey: APP_KEY } : null),
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

  if (status === 'join') return <JoinScreen slug={slug} onJoined={refetch} />;
  if (!state) return <Centered title="Opening the crew console…" />;
  if (!staff) return <Centered title="This page is for tonight’s crew" body="Join with your crew code to see reports." />;

  const openCount = incidents.filter((i) => i.status !== 'resolved').length;
  return (
    <div className="stage-light flex h-dvh flex-col">
      <header className="flex items-center justify-between gap-4 border-b border-line px-6 py-3">
        <div>
          <h1 className="text-lg font-bold">{state.event.title}: crew console</h1>
          <p className="text-sm text-haze">{openCount} open {openCount === 1 ? 'report' : 'reports'} · signed in as {state.me.name} ({state.me.role})</p>
        </div>
        <div className="flex items-center gap-4">
          <PhaseTrack phase={state.phase} />
          <Link href={`/e/${slug}`} className="text-sm text-haze underline underline-offset-4">Audience view</Link>
        </div>
      </header>
      <div className="grid min-h-0 flex-1 grid-cols-[22rem_1fr_24rem]">
        <aside className="overflow-y-auto border-r border-line p-4">
          {incidents.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-line p-4 text-sm text-haze">No reports yet. They appear here the moment someone sends one.</p>
          ) : (
            <IncidentList incidents={incidents} state={state} onOpen={setOpen} selected={open} />
          )}
        </aside>
        <section className="flex min-h-0 flex-col">
          {open ? (
            <IncidentRoom key={open} incidentId={open} state={state} slug={slug} me={me} onBack={() => setOpen(null)} onChanged={load} />
          ) : (
            <Centered title="Pick a report" body="Open a report to chat with the person who sent it, draft an update for the audience, and approve it." />
          )}
        </section>
        <aside className="flex min-h-0 flex-col border-l border-line">
          <VenueMap state={state} />
        </aside>
      </div>
    </div>
  );
}
