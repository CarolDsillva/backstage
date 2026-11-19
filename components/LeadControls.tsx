'use client';
import { useState } from 'react';
import Link from 'next/link';
import { postJson } from '@/lib/client/useEventState';
import type { Phase } from '@/lib/shared/types';

const NEXT: Record<Phase, Phase | null> = { before: 'live', live: 'after', after: null };
const NEXT_LABEL: Record<Phase, string> = { before: 'Start the show', live: 'End the show', after: '' };

/** Lead-only: move the night forward, open stats and the stage screen. */
export function LeadControls({ slug, phase, onChanged }: { slug: string; phase: Phase; onChanged: () => void }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function setPhase(p: Phase | null) {
    setBusy(true);
    setError('');
    try {
      await postJson(`/api/event/${slug}/phase`, { phase: p });
      setOpen(false);
      onChanged();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const next = NEXT[phase];
  return (
    <div className="relative">
      <button onClick={() => setOpen((o) => !o)} aria-expanded={open} className="rounded-full border border-line px-3 py-1 text-xs text-haze">
        Lead tools
      </button>
      {open && (
        <div className="absolute right-0 z-20 mt-2 flex w-56 flex-col gap-1 rounded-2xl border border-line bg-velvet p-2 shadow-xl">
          {next && (
            <button disabled={busy} onClick={() => setPhase(next)} className="rounded-xl bg-gel/20 px-3 py-2 text-left text-sm font-semibold text-gel">
              {NEXT_LABEL[phase]}
            </button>
          )}
          {(['before', 'live', 'after'] as Phase[]).filter((p) => p !== phase).map((p) => (
            <button key={p} disabled={busy} onClick={() => setPhase(p)} className="rounded-xl px-3 py-2 text-left text-sm text-mist hover:bg-velvet-2">
              Jump to {p === 'before' ? 'before the show' : p === 'live' ? 'live' : 'after the show'}
            </button>
          ))}
          <button disabled={busy} onClick={() => setPhase(null)} className="rounded-xl px-3 py-2 text-left text-sm text-mist hover:bg-velvet-2">
            Follow the schedule
          </button>
          <Link href={`/e/${slug}/screen`} target="_blank" className="rounded-xl px-3 py-2 text-sm text-mist hover:bg-velvet-2">
            Open the stage screen
          </Link>
          <Link href={`/e/${slug}/crew`} className="rounded-xl px-3 py-2 text-sm text-mist hover:bg-velvet-2">
            Open the crew console
          </Link>
          <Link href={`/e/${slug}/stats`} className="rounded-xl px-3 py-2 text-sm text-mist hover:bg-velvet-2">
            See tonight’s numbers
          </Link>
          {error && <p role="alert" className="px-3 text-xs text-gel">{error}</p>}
        </div>
      )}
    </div>
  );
}
