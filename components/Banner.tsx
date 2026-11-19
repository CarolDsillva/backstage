'use client';
import type { Condition, Place } from '@/lib/shared/types';
import { effectiveCondition } from '@/lib/shared/conditions';
import { timeAgo } from '@/lib/shared/time';

/** Latest verified crew update, pinned under the header. */
export function Banner({
  conditions,
  places,
  onOpenMap,
}: {
  conditions: Condition[];
  places: Place[];
  onOpenMap: () => void;
}) {
  const now = new Date();
  const live = conditions
    .map((c) => ({ c, e: effectiveCondition(c, now) }))
    .filter(({ e }) => e.status === 'limited' || e.status === 'closed')
    .sort((a, b) => b.c.approvedAt.localeCompare(a.c.approvedAt));
  if (!live.length) return null;
  const { c } = live[0];
  const place = places.find((p) => p.id === c.placeId);
  const more = live.length - 1;
  return (
    <button
      onClick={onOpenMap}
      className="mx-3 mt-2 flex items-start gap-3 rounded-2xl border border-spot/40 bg-spot/10 px-4 py-3 text-left"
    >
      <span aria-hidden className="mt-0.5 text-lg">📣</span>
      <span className="flex-1">
        <span className="block font-semibold text-spot">Crew update: {place?.name ?? 'venue'}</span>
        <span className="block text-sm text-mist">{c.notice}</span>
        <span className="mt-1 block text-xs text-haze">
          Confirmed by {c.approvedBy}, {timeAgo(c.approvedAt, now)}
          {more > 0 ? `. ${more} more on the map.` : ''}
        </span>
      </span>
    </button>
  );
}
