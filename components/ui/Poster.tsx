import type { Phase } from '@/lib/shared/types';

export function DateChip({ iso }: { iso: string }) {
  const d = new Date(iso);
  return (
    <span className="grid h-14 w-14 place-items-center rounded-2xl bg-white text-ink shadow-lg">
      <span className="text-center leading-none">
        <span className="block text-xl font-extrabold">{d.getDate()}</span>
        <span className="block text-[11px] font-semibold uppercase">{d.toLocaleString('en', { month: 'short' })}</span>
      </span>
    </span>
  );
}

export function LivePill({ phase }: { phase: Phase }) {
  if (phase === 'live') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-gel px-2.5 py-1 text-xs font-bold text-white">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" /> Live now
      </span>
    );
  }
  return (
    <span className="rounded-full bg-black/40 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur">
      {phase === 'before' ? 'Doors soon' : 'After the show'}
    </span>
  );
}

/** Gig poster: generated stage-light art with the artist name set large. */
export function Poster({
  artist,
  title,
  startsAt,
  phase,
  className = '',
  children,
}: {
  artist: string;
  title: string;
  startsAt: string;
  phase: Phase;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className={`poster flex flex-col justify-between p-5 ${className}`}>
      <div className="flex items-start justify-between">
        <LivePill phase={phase} />
        <DateChip iso={startsAt} />
      </div>
      <div>
        <p className="text-sm font-medium text-white/80">{title.replace(artist, '').replace(/^[\s—–-]+/, '') || 'Live'}</p>
        <p className="text-5xl font-extrabold leading-[0.95] tracking-tight text-white drop-shadow-lg">{artist}</p>
        {children}
      </div>
    </div>
  );
}
