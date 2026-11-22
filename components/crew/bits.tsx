'use client';
import { useEffect, useState } from 'react';
import { team as teamOf } from '@/lib/shared/teams';
import { initials } from '@/components/ui/Avatar';

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

/** Radio-display channel label: "CH03 PROD". */
export function ChLabel({ team, className }: { team: string; className?: string }) {
  const t = teamOf(team);
  return (
    <span className={cx('lcd inline-flex items-center gap-1.5 text-[11px] font-bold', className)} style={{ color: t.color }}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: t.color }} aria-hidden />
      CH{String(t.ch).padStart(2, '0')} {t.short}
    </span>
  );
}

export function Face({ name, color, size = 32 }: { name: string; color?: string; size?: number }) {
  return (
    <span
      className="grid shrink-0 place-items-center rounded-full font-display font-bold text-[#05060d] ring-2 ring-[#05060d]"
      style={{ width: size, height: size, fontSize: size * 0.38, background: color ?? '#d7ff3a' }}
      aria-hidden
    >
      {initials(name)}
    </span>
  );
}

export const SEVERITY_STYLE: Record<string, { chip: string; ring: string; label: string }> = {
  normal: { chip: 'bg-white/10 text-white/80', ring: '#a9b3ff', label: 'Normal' },
  urgent: { chip: 'bg-[#ffb547]/15 text-[#ffb547]', ring: '#ffb547', label: 'Urgent' },
  critical: { chip: 'bg-[#ff3d6e]/18 text-[#ff6b8f]', ring: '#ff3d6e', label: 'Critical' },
};

/** Re-render every `ms` so relative times and the show clock stay fresh. */
export function useNow(ms = 15_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(id);
  }, [ms]);
  return now;
}

export function ago(ts: number | string, now: number) {
  const s = Math.max(0, Math.round((now - (typeof ts === 'string' ? new Date(ts).getTime() : ts)) / 1000));
  if (s < 45) return 'now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m`;
  return `${Math.round(m / 60)}h`;
}

export function hm(ms: number) {
  const neg = ms < 0;
  const total = Math.abs(Math.round(ms / 60000));
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${neg ? '-' : ''}${h}:${String(m).padStart(2, '0')}`;
}
