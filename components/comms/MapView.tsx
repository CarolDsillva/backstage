'use client';
import { useMemo, useState } from 'react';
import { Beer, Cross, DoorOpen, Droplets, LogIn, Mic2, Plus, ShieldAlert, ShoppingBag, Toilet } from 'lucide-react';
import type { CrewState } from '@/lib/client/useCrew';
import { team as teamOf, ISSUE_STATUS_LABEL, type TeamId } from '@/lib/shared/teams';
import type { PlaceKind } from '@/lib/shared/types';
import { SectionTitle } from './Alerts';
import { SEV, TeamBadge, ago, cx } from './ui';

const KIND_ICON: Record<PlaceKind, typeof Mic2> = {
  stage: Mic2, bar: Beer, toilet: Toilet, exit: DoorOpen, entry: LogIn, merch: ShoppingBag, firstaid: Cross, water: Droplets, barrier: ShieldAlert,
};

/** The venue with every open issue pinned where it is. Tap a spot to see it or raise one there. */
export function MapView({ state, now, viewer, onOpenChat, onRaise }: {
  state: CrewState; now: number; viewer: boolean; onOpenChat: (t: TeamId) => void; onRaise: (placeId: string) => void;
}) {
  const [sel, setSel] = useState<string | null>(null);
  const open = state.issues.filter((i) => i.status !== 'resolved');
  const byPlace = useMemo(() => {
    const m = new Map<string, typeof open>();
    for (const i of open) if (i.placeId) m.set(i.placeId, [...(m.get(i.placeId) ?? []), i]);
    return m;
  }, [open]);
  const place = state.places.find((p) => p.id === sel) ?? null;
  const list = sel ? byPlace.get(sel) ?? [] : open.filter((i) => i.placeId);

  return (
    <div className="px-4 pt-2 pb-32">
      <div data-tour="map" className="relative overflow-hidden rounded-[28px] bg-[#251856] p-3">
        <div className="relative mx-auto aspect-[100/140] max-h-[58dvh]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/venue-light.svg" alt="" className="absolute inset-0 h-full w-full select-none" draggable={false} />
          {state.places.map((p) => {
            const here = byPlace.get(p.id) ?? [];
            const worst = here.find((i) => i.severity === 'critical') ?? here.find((i) => i.severity === 'urgent') ?? here[0];
            const Icon = KIND_ICON[p.kind] ?? Mic2;
            const bg = worst ? (worst.severity === 'critical' ? '#FF6B5B' : worst.severity === 'urgent' ? '#F2A900' : '#7C4DFF') : '#2E1F66';
            return (
              <button key={p.id} onClick={() => setSel(p.id === sel ? null : p.id)} aria-pressed={sel === p.id}
                aria-label={`${p.name}${here.length ? `: ${here.length} open issue${here.length > 1 ? 's' : ''}` : ''}`}
                className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${p.x}%`, top: `${(p.y / 140) * 100}%` }}>
                <span className="relative flex flex-col items-center">
                  {worst && <span className="ring-out absolute top-0 h-9 w-9 rounded-full" style={{ background: bg }} aria-hidden />}
                  <span className={cx('relative grid h-9 w-9 place-items-center rounded-full shadow-[0_4px_10px_-2px_rgba(23,20,31,.35)]', sel === p.id && 'outline-3 outline-offset-2 outline-[#EC4F9B]')}
                    style={{ background: bg, color: worst ? '#fff' : '#D9CCFF' }}>
                    <Icon size={16} strokeWidth={2.4} aria-hidden />
                  </span>
                  {here.length > 1 && <span className="absolute -top-1.5 -right-2 grid h-5 min-w-5 place-items-center rounded-full bg-[#EC4F9B] px-1 text-[10px] font-bold text-white">{here.length}</span>}
                  <span className="mt-0.5 rounded-full bg-[#160B36]/80 px-1.5 text-[10px] font-semibold whitespace-nowrap text-[#E6DFFF]">{p.name}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-5">
        <SectionTitle title={place ? place.name : 'Pinned issues'} sub={place ? `${list.length} open` : `${byPlace.size} hot spot${byPlace.size === 1 ? '' : 's'}`} />
        {place && !viewer && (
          <button onClick={() => onRaise(place.id)} className="mb-2.5 flex h-12 w-full items-center justify-center gap-1.5 rounded-full bg-[#7C4DFF] text-sm font-bold text-white"><Plus size={16} />Raise an issue at {place.name}</button>
        )}
        <ul className="space-y-2">
          {list.length === 0 && <li className="rounded-[20px] bg-[#251856] p-4 text-center text-sm text-[#B8ABE6]">{place ? 'Nothing open here.' : 'No pinned issues. Tap a spot on the map to see it.'}</li>}
          {list.map((i) => {
            const sev = SEV[i.severity ?? 'normal'];
            return (
              <li key={i.id}>
                <button onClick={() => onOpenChat((i.team ?? 'control') as TeamId)} className="flex w-full items-center gap-3 rounded-[20px] bg-[#251856] p-3 text-left">
                  <TeamBadge team={i.team ?? 'control'} size={38} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{i.title ?? i.note}</span>
                    <span className="text-xs text-[#B8ABE6]">{teamOf(i.team).name} · {state.places.find((p) => p.id === i.placeId)?.name} · {ago(i.createdAt, now)}</span>
                  </span>
                  <span className="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold" style={{ background: sev.bg, color: sev.ink }}>{ISSUE_STATUS_LABEL[i.status]}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
