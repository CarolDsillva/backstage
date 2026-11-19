import type { EventState } from '@/lib/client/useEventState';
import { CATEGORY_LABEL } from '@/lib/shared/incidents';

export function IncidentCard({ content, state }: { content: Record<string, unknown>; state: EventState }) {
  const place = state.places.find((p) => p.id === content.placeId);
  const cat = CATEGORY_LABEL[content.category as keyof typeof CATEGORY_LABEL] ?? 'Report';
  return (
    <section className="mx-auto w-full max-w-sm rounded-3xl border border-gel/40 bg-gel/10 p-4">
      <p className="text-xs font-semibold text-gel">{cat}{place ? `: ${place.name}` : ''}</p>
      <p className="mt-1">{content.note as string}</p>
      <p className="mt-1 text-xs text-haze">Reported by {content.reporterName as string}. Not confirmed yet.</p>
    </section>
  );
}
