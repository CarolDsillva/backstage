'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import type { EventState } from '@/lib/client/useEventState';
import { useRoom, type Me } from '@/lib/client/useRoom';
import { IncidentRoom } from './IncidentRoom';
import { attendeeLabel, CATEGORY_LABEL } from '@/lib/shared/incidents';
import { timeAgo } from '@/lib/shared/time';
import type { Incident, IncidentStatus } from '@/lib/shared/types';

export function CrewTab({ state, slug, me, onReport }: { state: EventState; slug: string; me: Me | null; onReport: () => void }) {
  const staff = state.me.role === 'crew' || state.me.role === 'lead';
  return staff ? <StaffView state={state} slug={slug} me={me} /> : <AttendeeView state={state} slug={slug} me={me} onReport={onReport} />;
}

function AttendeeView({ state, slug, me, onReport }: { state: EventState; slug: string; me: Me | null; onReport: () => void }) {
  const [open, setOpen] = useState<string | null>(null);
  if (open) return <IncidentRoom incidentId={open} state={state} slug={slug} me={me} onBack={() => setOpen(null)} />;
  return (
    <div className="flex-1 overflow-y-auto px-4 py-4">
      <button onClick={onReport} className="w-full rounded-3xl border border-gel/40 bg-gel/10 p-5 text-left">
        <span className="block text-lg font-semibold text-gel">Tell the crew</span>
        <span className="mt-1 block text-sm text-haze">Lost something, lost your group, or something’s wrong. You’ll get a private chat with the crew.</span>
      </button>
      <h2 className="mt-6 mb-2 text-sm text-haze">Your reports</h2>
      {state.myIncidents.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line p-4 text-sm text-haze">You haven’t reported anything tonight.</p>
      ) : (
        <IncidentList incidents={state.myIncidents} state={state} onOpen={setOpen} />
      )}
    </div>
  );
}

function StaffView({ state, slug, me }: { state: EventState; slug: string; me: Me | null }) {
  const [incidents, setIncidents] = useState<Incident[] | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const r = await fetch(`/api/incidents?slug=${slug}`, { cache: 'no-store' });
    if (!r.ok) return setError('Couldn’t load reports. Pull down or reopen this tab.');
    setError('');
    setIncidents((await r.json()).incidents);
  }, [slug]);

  useEffect(() => {
    void load();
  }, [load]);

  // The crew room carries "new report" signals.
  const { onState } = useRoom(state.channels.crew, me, slug);
  useEffect(() => onState(() => void load()), [onState, load]);

  if (open) return <IncidentRoom incidentId={open} state={state} slug={slug} me={me} onBack={() => { setOpen(null); void load(); }} onChanged={load} />;

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm text-haze">Reports tonight</h2>
        <Link href={`/e/${slug}/crew`} className="text-sm text-spot underline underline-offset-4">Open the full console</Link>
      </div>
      {error && <p role="alert" className="mt-2 text-sm text-gel">{error}</p>}
      {incidents === null ? (
        <p className="mt-4 text-haze">Loading reports…</p>
      ) : incidents.length === 0 ? (
        <p className="mt-3 rounded-2xl border border-dashed border-line p-4 text-sm text-haze">No reports yet. New ones appear here the moment someone sends one.</p>
      ) : (
        <div className="mt-2"><IncidentList incidents={incidents} state={state} onOpen={setOpen} /></div>
      )}
    </div>
  );
}

const DOT: Record<IncidentStatus, string> = { new: 'bg-gel', checking: 'bg-spot', verified: 'bg-ok', resolved: 'bg-line' };

export function IncidentList({ incidents, state, onOpen, selected }: { incidents: Incident[]; state: EventState; onOpen: (id: string) => void; selected?: string | null }) {
  const order: IncidentStatus[] = ['new', 'checking', 'verified', 'resolved'];
  const sorted = [...incidents].sort((a, b) => order.indexOf(a.status) - order.indexOf(b.status) || b.createdAt.localeCompare(a.createdAt));
  return (
    <ul className="flex flex-col divide-y divide-line overflow-hidden rounded-2xl border border-line bg-velvet">
      {sorted.map((i) => {
        const place = state.places.find((p) => p.id === i.placeId);
        return (
          <li key={i.id}>
            <button
              onClick={() => onOpen(i.id)}
              aria-current={selected === i.id ? 'true' : undefined}
              className={`flex w-full items-start gap-3 px-4 py-3 text-left ${selected === i.id ? 'bg-velvet-2' : ''}`}
            >
              <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${DOT[i.status]}`} aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">{CATEGORY_LABEL[i.category]}{place ? `: ${place.name}` : ''}</span>
                <span className="block truncate text-sm text-haze">{i.note}</span>
                <span className="block text-xs text-haze/70">{i.reporterName}, {timeAgo(i.createdAt)}</span>
              </span>
              <span className="shrink-0 text-xs text-haze">{attendeeLabel(i.status)}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
