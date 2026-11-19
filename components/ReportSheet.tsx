'use client';
import { useState } from 'react';
import { Sheet, inputCls, primaryCls } from './Sheet';
import { postJson, type EventState } from '@/lib/client/useEventState';
import { CATEGORY_LABEL } from '@/lib/shared/incidents';
import type { IncidentCategory } from '@/lib/shared/types';

const CATS = Object.entries(CATEGORY_LABEL) as [IncidentCategory, string][];

export function ReportSheet({
  state,
  slug,
  initialPlaceId,
  initialCategory,
  onClose,
  onCreated,
}: {
  state: EventState;
  slug: string;
  initialPlaceId: string | null;
  initialCategory?: IncidentCategory;
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const [category, setCategory] = useState<IncidentCategory>(initialCategory ?? (initialPlaceId ? 'place_problem' : 'lost_item'));
  const [placeId, setPlaceId] = useState(initialPlaceId ?? '');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const r = await postJson<{ id: string }>('/api/incidents', { slug, category, placeId: placeId || null, note });
      onCreated(r.id);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <Sheet title="Tell the crew" onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <fieldset className="grid grid-cols-2 gap-2">
          <legend className="sr-only">What happened?</legend>
          {CATS.map(([id, label]) => (
            <label
              key={id}
              className={`flex h-12 cursor-pointer items-center justify-center rounded-xl border px-2 text-center text-sm ${
                category === id ? 'border-spot bg-spot/10 text-spot' : 'border-line text-mist'
              }`}
            >
              <input type="radio" name="cat" value={id} checked={category === id} onChange={() => setCategory(id)} className="sr-only" />
              {label}
            </label>
          ))}
        </fieldset>
        <label className="flex flex-col gap-1 text-sm text-haze">
          Where?
          <select value={placeId} onChange={(e) => setPlaceId(e.target.value)} className={inputCls}>
            <option value="">Not sure / somewhere else</option>
            {state.places.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm text-haze">
          What’s going on?
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={500}
            rows={3}
            required
            placeholder={category === 'lost_item' ? 'Black phone, blue cover, near the barrier' : 'A few words is enough'}
            className="resize-none rounded-xl border border-line bg-night p-3 text-mist outline-none placeholder:text-haze/60 focus:border-spot"
          />
        </label>
        <p className="text-xs text-haze">
          Only you and tonight’s crew see this. For an emergency, find the nearest staff member or call 112.
        </p>
        {error && <p role="alert" className="text-sm text-gel">{error}</p>}
        <button disabled={busy || !note.trim()} className={primaryCls}>{busy ? 'Sending…' : 'Send to the crew'}</button>
      </form>
    </Sheet>
  );
}
