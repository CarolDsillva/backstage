'use client';
import { useState } from 'react';
import type { EventState } from '@/lib/client/useEventState';
import { effectiveCondition, STATUS_ICON, STATUS_LABEL, type Effective } from '@/lib/shared/conditions';
import { timeAgo } from '@/lib/shared/time';
import type { Place } from '@/lib/shared/types';

const PIN: Record<Effective['status'], string> = {
  ok: 'fill-ok',
  limited: 'fill-warn',
  closed: 'fill-gel',
  stale: 'fill-haze',
};

const KIND_ICON: Record<Place['kind'], string> = {
  stage: '🎤', barrier: '🚧', bar: '🍹', water: '💧', firstaid: '⛑️', exit: '🚪', toilet: '🚻', merch: '👕', entry: '🎟️',
};

export function VenueMap({ state, onReport }: { state: EventState; onReport?: (placeId: string) => void }) {
  const [selected, setSelected] = useState<string | null>(null);
  const now = new Date();
  const eff = (p: Place) => effectiveCondition(state.conditions.find((c) => c.placeId === p.id), now);
  const sel = state.places.find((p) => p.id === selected) ?? null;

  return (
    <div className="flex-1 overflow-y-auto px-4 pb-6">
      <div className="relative mx-auto mt-3 aspect-[100/140] max-h-[62dvh] w-auto">
        <svg viewBox="0 0 100 140" className="h-full w-full" role="img" aria-label="Venue map">
          <image href="/venue.svg" x="0" y="0" width="100" height="140" />
          {state.places.map((p) => {
            const e = eff(p);
            const active = p.id === selected;
            return (
              <g
                key={p.id}
                transform={`translate(${p.x} ${p.y})`}
                onClick={() => setSelected(p.id)}
                className="cursor-pointer"
                role="button"
                tabIndex={0}
                aria-label={`${p.name}: ${STATUS_LABEL[e.status]}`}
                onKeyDown={(k) => (k.key === 'Enter' || k.key === ' ') && setSelected(p.id)}
              >
                {(e.status === 'closed' || e.status === 'limited') && (
                  <circle r="7" className={`${PIN[e.status]} animate-ping opacity-30`} />
                )}
                <circle r={active ? 5.2 : 4.2} className={`${PIN[e.status]} stroke-night`} strokeWidth="0.8" />
                <text y="1.4" textAnchor="middle" fontSize="4" aria-hidden>{KIND_ICON[p.kind]}</text>
                <text y="9" textAnchor="middle" fontSize="3.2" className="fill-mist" aria-hidden>{p.name}</text>
              </g>
            );
          })}
        </svg>
      </div>

      {sel && <PlaceDetail place={sel} e={eff(sel)} onReport={onReport ? () => onReport(sel.id) : undefined} onClose={() => setSelected(null)} />}

      <h2 className="mt-5 mb-2 text-sm text-haze">Every place, right now</h2>
      <ul className="flex flex-col divide-y divide-line rounded-2xl border border-line bg-velvet">
        {state.places.map((p) => {
          const e = eff(p);
          return (
            <li key={p.id}>
              <button onClick={() => setSelected(p.id)} className="flex w-full items-center gap-3 px-4 py-3 text-left">
                <span aria-hidden>{KIND_ICON[p.kind]}</span>
                <span className="flex-1">{p.name}</span>
                <StatusChip e={e} />
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function StatusChip({ e }: { e: Effective }) {
  const cls = {
    ok: 'text-ok',
    limited: 'text-warn',
    closed: 'text-gel',
    stale: 'text-haze',
  }[e.status];
  return (
    <span className={`text-sm font-semibold ${cls}`}>
      <span aria-hidden className="mr-1">{STATUS_ICON[e.status]}</span>
      {STATUS_LABEL[e.status]}
    </span>
  );
}

function PlaceDetail({ place, e, onReport, onClose }: { place: Place; e: Effective; onReport?: () => void; onClose: () => void }) {
  return (
    <section className="mt-3 rounded-2xl border border-line bg-velvet p-4" aria-live="polite">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">{place.name}</h2>
          <StatusChip e={e} />
        </div>
        <button onClick={onClose} className="text-sm text-haze">Close</button>
      </div>
      {e.notice && <p className="mt-2">{e.notice}</p>}
      {e.approvedBy && e.approvedAt && (
        <p className="mt-1 text-xs text-haze">
          {e.status === 'stale'
            ? `Last confirmed by ${e.approvedBy} ${timeAgo(e.approvedAt)}. The crew hasn’t rechecked it since.`
            : `Confirmed by ${e.approvedBy}, ${timeAgo(e.approvedAt)}`}
        </p>
      )}
      {e.status === 'ok' && !e.approvedBy && <p className="mt-1 text-xs text-haze">No problems reported to the crew.</p>}
      {onReport && (
        <button onClick={onReport} className="mt-3 h-11 w-full rounded-xl border border-gel/50 font-semibold text-gel">
          Report a problem here
        </button>
      )}
    </section>
  );
}
