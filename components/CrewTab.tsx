'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import type { EventState } from '@/lib/client/useEventState';
import { useRoom, type Me } from '@/lib/client/useRoom';
import { IncidentRoom } from './IncidentRoom';
import { attendeeLabel, CATEGORY_LABEL } from '@/lib/shared/incidents';
import { timeAgo } from '@/lib/shared/time';
import type { Incident, IncidentCategory, IncidentStatus } from '@/lib/shared/types';
import { Search, Users, TriangleAlert, LifeBuoy, ChevronRight, Phone, type LucideIcon } from 'lucide-react';

export function CrewTab({ state, slug, me, onReport }: { state: EventState; slug: string; me: Me | null; onReport: (category?: IncidentCategory) => void }) {
  const staff = state.me.role === 'crew' || state.me.role === 'lead';
  return staff ? <StaffView state={state} slug={slug} me={me} /> : <AttendeeView state={state} slug={slug} me={me} onReport={onReport} />;
}

const HELP_OPTIONS: { id: IncidentCategory; label: string; hint: string; icon: LucideIcon; tone: string }[] = [
  { id: 'lost_item', label: 'Lost something', hint: 'Phone, wallet, keys…', icon: Search, tone: 'bg-violet-500/20 text-violet-300' },
  { id: 'lost_group', label: 'Lost my group', hint: 'We’ll help you find them', icon: Users, tone: 'bg-sky-500/15 text-sky-300' },
  { id: 'place_problem', label: 'Something’s wrong', hint: 'At a bar, toilet, exit…', icon: TriangleAlert, tone: 'bg-warn/15 text-warn' },
  { id: 'help', label: 'I need help', hint: 'Talk to the crew', icon: LifeBuoy, tone: 'bg-gel/15 text-gel' },
];

const STATUS_TONE: Record<IncidentStatus, string> = {
  new: 'bg-gel/15 text-gel',
  checking: 'bg-warn/15 text-warn',
  verified: 'bg-ok/15 text-ok',
  resolved: 'bg-line text-haze',
};

function AttendeeView({ state, slug, me, onReport }: { state: EventState; slug: string; me: Me | null; onReport: (category?: IncidentCategory) => void }) {
  const [open, setOpen] = useState<string | null>(null);
  if (open) return <IncidentRoom incidentId={open} state={state} slug={slug} me={me} onBack={() => setOpen(null)} />;
  return (
    <div className="flex-1 overflow-y-auto px-4 pt-2 pb-6">
      <h2 className="text-2xl font-extrabold tracking-tight">Need a hand?</h2>
      <p className="mt-1 text-sm text-haze">Pick what happened. You’ll get a private chat with tonight’s crew. Nobody else sees it.</p>

      <div className="mt-4 grid grid-cols-2 gap-3">
        {HELP_OPTIONS.map((o) => (
          <button key={o.id} onClick={() => onReport(o.id)} className="flex min-h-32 flex-col justify-between rounded-[1.5rem] bg-velvet p-4 text-left transition-transform active:scale-[0.98]">
            <span className={`grid h-11 w-11 place-items-center rounded-2xl ${o.tone}`} aria-hidden><o.icon size={22} /></span>
            <span>
              <span className="block font-bold leading-tight">{o.label}</span>
              <span className="block text-xs text-haze">{o.hint}</span>
            </span>
          </button>
        ))}
      </div>

      <h2 className="mt-7 mb-3 text-lg font-bold">Your reports</h2>
      {state.myIncidents.length === 0 ? (
        <p className="rounded-[1.5rem] border border-dashed border-line p-4 text-sm text-haze">Nothing reported tonight. Hope it stays that way.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {state.myIncidents.map((i) => {
            const place = state.places.find((p) => p.id === i.placeId);
            return (
              <li key={i.id}>
                <button onClick={() => setOpen(i.id)} className="flex w-full items-center gap-3 rounded-[1.5rem] bg-velvet p-4 text-left">
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">{CATEGORY_LABEL[i.category]}{place ? ` · ${place.name}` : ''}</span>
                    <span className="block truncate text-sm text-haze">{i.note}</span>
                  </span>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${STATUS_TONE[i.status]}`}>{attendeeLabel(i.status)}</span>
                  <ChevronRight size={18} className="shrink-0 text-haze" aria-hidden />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <p className="mt-7 flex gap-3 rounded-[1.5rem] border border-gel/30 bg-gel/5 p-4 text-sm text-haze">
        <Phone size={18} className="mt-0.5 shrink-0 text-gel" aria-hidden />
        <span><span className="font-semibold text-mist">Emergency?</span> Go to the nearest staff member or call 112. Backstage doesn’t replace emergency services.</span>
      </p>
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
