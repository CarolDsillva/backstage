'use client';
import { useState } from 'react';
import type { EventState } from '@/lib/client/useEventState';
import { effectiveCondition, STATUS_LABEL, type Effective } from '@/lib/shared/conditions';
import { timeAgo } from '@/lib/shared/time';
import type { Place } from '@/lib/shared/types';
import {
  Mic, Fence, Martini, Droplet, HeartPulse, DoorOpen, Toilet, Shirt, Ticket, X, TriangleAlert, type LucideIcon,
} from 'lucide-react';

export const KIND_ICON: Record<Place['kind'], LucideIcon> = {
  stage: Mic, barrier: Fence, bar: Martini, water: Droplet, firstaid: HeartPulse, exit: DoorOpen, toilet: Toilet, merch: Shirt, entry: Ticket,
};

const STATUS_STYLE: Record<Effective['status'], { pin: string; chip: string; dot: string }> = {
  ok: { pin: 'bg-velvet-2 text-mist ring-ok/70', chip: 'bg-ok/15 text-ok', dot: 'bg-ok' },
  limited: { pin: 'bg-warn text-ink ring-warn', chip: 'bg-warn/15 text-warn', dot: 'bg-warn' },
  closed: { pin: 'bg-gel text-white ring-gel', chip: 'bg-gel/15 text-gel', dot: 'bg-gel' },
  stale: { pin: 'bg-velvet-2 text-haze ring-haze/60', chip: 'bg-line text-haze', dot: 'bg-haze' },
};

type Filter = 'all' | 'bar' | 'toilet' | 'water' | 'exit' | 'firstaid';
const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'Everything' },
  { id: 'bar', label: 'Bars' },
  { id: 'toilet', label: 'Toilets' },
  { id: 'water', label: 'Water' },
  { id: 'exit', label: 'Exits' },
  { id: 'firstaid', label: 'First aid' },
];

const matches = (p: Place, f: Filter) => f === 'all' || p.kind === f || (f === 'exit' && p.kind === 'entry');

export function VenueMap({ state, onReport }: { state: EventState; onReport?: (placeId: string) => void }) {
  const [selected, setSelected] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const now = new Date();
  const eff = (p: Place) => effectiveCondition(state.conditions.find((c) => c.placeId === p.id), now);
  const sel = state.places.find((p) => p.id === selected) ?? null;
  const issues = state.places.filter((p) => eff(p).status !== 'ok');

  return (
    <div className="flex-1 overflow-y-auto pb-6">
      <div className="flex gap-2 overflow-x-auto px-4 pt-1 pb-3" role="group" aria-label="Show on the map">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            aria-pressed={filter === f.id}
            className={`h-9 shrink-0 rounded-full px-4 text-sm font-semibold ${filter === f.id ? 'bg-spot text-ink' : 'bg-velvet text-haze'}`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="mx-4 rounded-[1.75rem] bg-velvet p-3">
        <div className="relative mx-auto aspect-[100/140] max-h-[58dvh]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/venue.svg" alt="" className="absolute inset-0 h-full w-full select-none" draggable={false} />
          {state.places.map((p) => {
            const e = eff(p);
            const Icon = KIND_ICON[p.kind];
            const on = matches(p, filter);
            const active = p.id === selected;
            const alert = e.status === 'limited' || e.status === 'closed';
            return (
              <button
                key={p.id}
                onClick={() => setSelected(p.id)}
                aria-label={`${p.name}: ${STATUS_LABEL[e.status]}`}
                aria-pressed={active}
                className={`absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-0.5 transition-opacity ${on ? 'opacity-100' : 'opacity-25'}`}
                style={{ left: `${p.x}%`, top: `${(p.y / 140) * 100}%` }}
              >
                <span className="relative">
                  {alert && <span className={`absolute inset-0 animate-ping rounded-full ${STATUS_STYLE[e.status].dot} opacity-40`} aria-hidden />}
                  <span
                    className={`relative grid h-8 w-8 place-items-center rounded-full shadow-lg ring-2 ${STATUS_STYLE[e.status].pin} ${active ? 'scale-125 outline outline-2 outline-offset-2 outline-spot' : ''} transition-transform`}
                  >
                    <Icon size={15} strokeWidth={2.2} aria-hidden />
                  </span>
                </span>
                <span className="rounded-full bg-night/80 px-1.5 text-[10px] font-semibold whitespace-nowrap text-mist">{p.name}</span>
              </button>
            );
          })}
        </div>
        <ul className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-haze" aria-label="Legend">
          {(['ok', 'limited', 'closed', 'stale'] as const).map((s) => (
            <li key={s} className="flex items-center gap-1.5"><span className={`h-2 w-2 rounded-full ${STATUS_STYLE[s].dot}`} />{STATUS_LABEL[s]}</li>
          ))}
        </ul>
      </div>

      {sel && <PlaceCard place={sel} e={eff(sel)} onReport={onReport ? () => onReport(sel.id) : undefined} onClose={() => setSelected(null)} />}

      {issues.length > 0 && (
        <section className="mt-6 px-4">
          <h2 className="mb-3 flex items-center gap-2 text-lg font-bold"><TriangleAlert size={18} className="text-warn" aria-hidden />Heads up</h2>
          <PlaceList places={issues} eff={eff} onPick={setSelected} />
        </section>
      )}
      <section className="mt-6 px-4">
        <h2 className="mb-3 text-lg font-bold">{issues.length ? 'Everything else' : 'Every place, all good'}</h2>
        <PlaceList places={state.places.filter((p) => eff(p).status === 'ok' && matches(p, filter))} eff={eff} onPick={setSelected} />
      </section>
    </div>
  );
}

function PlaceList({ places, eff, onPick }: { places: Place[]; eff: (p: Place) => Effective; onPick: (id: string) => void }) {
  return (
    <ul className="flex flex-col gap-2">
      {places.map((p) => {
        const e = eff(p);
        const Icon = KIND_ICON[p.kind];
        return (
          <li key={p.id}>
            <button onClick={() => onPick(p.id)} className="flex w-full items-center gap-3 rounded-[1.25rem] bg-velvet px-4 py-3 text-left">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-velvet-2 text-haze" aria-hidden><Icon size={18} /></span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">{p.name}</span>
                {e.notice && <span className="block truncate text-xs text-haze">{e.notice}</span>}
              </span>
              <StatusChip e={e} />
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function StatusChip({ e }: { e: Effective }) {
  return <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${STATUS_STYLE[e.status].chip}`}>{STATUS_LABEL[e.status]}</span>;
}

function PlaceCard({ place, e, onReport, onClose }: { place: Place; e: Effective; onReport?: () => void; onClose: () => void }) {
  const Icon = KIND_ICON[place.kind];
  return (
    <section className="rise mx-4 mt-3 rounded-[1.75rem] border border-line bg-velvet-2 p-4" aria-live="polite">
      <div className="flex items-start gap-3">
        <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl ${STATUS_STYLE[e.status].chip}`} aria-hidden><Icon size={22} /></span>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-bold leading-tight">{place.name}</h2>
          <StatusChip e={e} />
        </div>
        <button onClick={onClose} aria-label="Close" className="grid h-9 w-9 place-items-center rounded-full bg-velvet text-haze"><X size={18} /></button>
      </div>
      {e.notice && <p className="mt-3">{e.notice}</p>}
      {e.approvedBy && e.approvedAt && (
        <p className="mt-1 text-xs text-haze">
          {e.status === 'stale'
            ? `Last confirmed by ${e.approvedBy} ${timeAgo(e.approvedAt)}. The crew hasn’t rechecked it since.`
            : `Confirmed by ${e.approvedBy}, ${timeAgo(e.approvedAt)}`}
        </p>
      )}
      {e.status === 'ok' && !e.approvedBy && <p className="mt-2 text-sm text-haze">No problems reported here.</p>}
      {onReport && (
        <button onClick={onReport} className="mt-4 h-12 w-full rounded-full border border-gel/50 font-semibold text-gel">
          Report a problem here
        </button>
      )}
    </section>
  );
}
