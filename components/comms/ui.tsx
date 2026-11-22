'use client';
import { useEffect, useState } from 'react';
import { team as teamOf } from '@/lib/shared/teams';

/**
 * Backstage comms design system: warm cream paper, chunky pastel cards, one black pill nav,
 * Raahe pink as the action colour. Team colours are re-tuned for a light background.
 */
export const C = {
  paper: '#F6F0E6',
  card: '#FFFFFF',
  ink: '#7C4DFF',
  muted: '#B8ABE6',
  line: '#33236B',
  pink: '#EC4F9B',
  pinkSoft: '#4A1840',
  mint: '#123F3E',
  mintInk: '#5EE6C0',
  sun: '#3F3014',
  sunInk: '#FFCB5C',
  lilac: '#2E2470',
  lilacInk: '#B7AEFF',
  coral: '#FF6B5B',
  coralSoft: '#4A1D3F',
};

/** Light-theme team palette: soft tile + strong ink + dot. */
export const TEAM_UI: Record<string, { soft: string; ink: string; dot: string }> = {
  control: { soft: '#7C4DFF', ink: '#FFFFFF', dot: '#EC4F9B' },
  artist: { soft: '#4A1840', ink: '#FF8CC6', dot: '#EC4F9B' },
  production: { soft: '#2E2470', ink: '#B7AEFF', dot: '#7A72F0' },
  hospitality: { soft: '#3F3014', ink: '#FFCB5C', dot: '#F2A900' },
  security: { soft: '#4A1D3F', ink: '#FF9A8F', dot: '#FF6B5B' },
  runners: { soft: '#123F3E', ink: '#5EE6C0', dot: '#2FB392' },
  stalls: { soft: '#38215F', ink: '#D7B4FF', dot: '#B07AF0' },
  foh: { soft: '#15315A', ink: '#8CC8FF', dot: '#3D9BE0' },
  medical: { soft: '#4A1530', ink: '#FF8FA8', dot: '#F23D63' },
};
export const tui = (id: string | null | undefined) => TEAM_UI[id ?? 'control'] ?? TEAM_UI.control;

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

export const chNo = (id: string | null | undefined) => String(teamOf(id).ch).padStart(2, '0');

/** Rounded-square team badge with the channel number, like an app icon. */
export function TeamBadge({ team, size = 48 }: { team: string; size?: number }) {
  const u = tui(team);
  return (
    <span className="grid shrink-0 place-items-center font-display font-extrabold" aria-hidden
      style={{ width: size, height: size, borderRadius: size * 0.32, background: u.soft, color: u.ink, fontSize: size * 0.34 }}>
      {chNo(team)}
    </span>
  );
}

export function initials(name: string) {
  const parts = name.replace(/·.*$/, '').trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '?') + (parts[1]?.[0] ?? '')).toUpperCase();
}

const FACE_BG = ['#4A1840', '#2E2470', '#3F3014', '#123F3E', '#15315A', '#4A1D3F', '#38215F'];
export function Face({ name, size = 32, ring }: { name: string; size?: number; ring?: boolean }) {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return (
    <span className={cx('grid shrink-0 place-items-center rounded-full font-display font-bold text-white', ring && 'ring-2 ring-[#160B36]')} aria-hidden
      style={{ width: size, height: size, fontSize: size * 0.38, background: FACE_BG[h % FACE_BG.length] }}>
      {initials(name)}
    </span>
  );
}

export const SEV: Record<string, { label: string; bg: string; ink: string }> = {
  normal: { label: 'Normal', bg: '#33236B', ink: '#CFC4F5' },
  urgent: { label: 'Urgent', bg: '#3F3014', ink: '#FFCB5C' },
  critical: { label: 'Critical', bg: '#FF6B5B', ink: '#FFFFFF' },
};

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
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.round(h / 24)}d`;
}

export function clock(ts: number) {
  return new Date(ts).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

/** Walkie squelch: a short two-note chirp before a transmission plays. */
export function chirp() {
  try {
    const ctx = new AudioContext();
    [[1250, 0], [950, 0.07]].forEach(([f, t]) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'square';
      o.frequency.value = f;
      g.gain.setValueAtTime(0.05, ctx.currentTime + t);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + t + 0.065);
      o.connect(g).connect(ctx.destination);
      o.start(ctx.currentTime + t);
      o.stop(ctx.currentTime + t + 0.07);
    });
    setTimeout(() => void ctx.close(), 500);
  } catch { /* audio blocked */ }
}

/** Phone-style ring (two bursts), resolves when done. */
export function ring(): Promise<void> {
  return new Promise((resolve) => {
    try {
      const ctx = new AudioContext();
      for (let k = 0; k < 2; k++) {
        const t = ctx.currentTime + k * 0.55;
        [440, 480].forEach((f) => {
          const o = ctx.createOscillator();
          const g = ctx.createGain();
          o.frequency.value = f;
          g.gain.setValueAtTime(0.0001, t);
          g.gain.exponentialRampToValueAtTime(0.07, t + 0.03);
          g.gain.setValueAtTime(0.07, t + 0.35);
          g.gain.exponentialRampToValueAtTime(0.0001, t + 0.42);
          o.connect(g).connect(ctx.destination);
          o.start(t);
          o.stop(t + 0.45);
        });
      }
      setTimeout(() => { void ctx.close(); resolve(); }, 1150);
    } catch { resolve(); }
  });
}

/** Short beep through WebAudio (no asset). Critical = two tones. */
export function beep(critical = false) {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const tones = critical ? [880, 660] : [740];
    tones.forEach((f, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = f;
      o.type = 'sine';
      g.gain.setValueAtTime(0.0001, ctx.currentTime + i * 0.18);
      g.gain.exponentialRampToValueAtTime(0.15, ctx.currentTime + i * 0.18 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + i * 0.18 + 0.16);
      o.connect(g).connect(ctx.destination);
      o.start(ctx.currentTime + i * 0.18);
      o.stop(ctx.currentTime + i * 0.18 + 0.17);
    });
    setTimeout(() => void ctx.close(), 800);
  } catch { /* audio blocked */ }
}
