import type { Phase } from '@/lib/shared/types';

const STEPS: { id: Phase; label: string }[] = [
  { id: 'before', label: 'Before' },
  { id: 'live', label: 'Live' },
  { id: 'after', label: 'After' },
];

/** The night as a three-step track; the current step glows. */
export function PhaseTrack({ phase }: { phase: Phase }) {
  const idx = STEPS.findIndex((s) => s.id === phase);
  return (
    <ol className="flex items-center gap-1.5 text-xs" aria-label={`Gig stage: ${STEPS[idx].label}`}>
      {STEPS.map((s, i) => (
        <li key={s.id} className="flex items-center gap-1.5">
          <span
            aria-current={i === idx ? 'step' : undefined}
            className={
              i === idx
                ? 'rounded-full bg-gel/20 px-2 py-0.5 font-semibold text-gel'
                : i < idx
                  ? 'text-haze/70'
                  : 'text-haze/40'
            }
          >
            {i === idx && s.id === 'live' && (
              <span className="mr-1 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-gel align-middle" />
            )}
            {s.label}
          </span>
          {i < STEPS.length - 1 && <span className="h-px w-3 bg-line" aria-hidden />}
        </li>
      ))}
    </ol>
  );
}
