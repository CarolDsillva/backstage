'use client';
import { useEffect, useState } from 'react';
import { AlertTriangle, ArrowRight, CheckCircle2, Hand, Radio } from 'lucide-react';
import { TEAMS } from '@/lib/shared/teams';
import { cx } from './bits';

export const demoKey = (slug: string, userId: string) => `bs_crewdemo_v1_${slug}_${userId}`;

type Slide = { kicker: string; title: [string, string]; body: string; scene: React.ReactNode };

/** First-time product demo: a show night, sped up, so a new crew member sees the whole loop in 30 seconds. */
export function HeatDemo({ onDone }: { onDone: () => void }) {
  const [i, setI] = useState(0);
  const slides: Slide[] = [
    { kicker: '18:00 · LOAD-IN', title: ['Every team.', 'One backstage.'], body: 'Artist team, production, security, runners, stalls, medical. Each has its own channel; Control hears them all.', scene: <PassStack /> },
    { kicker: '20:30 · HEADLINER ON', title: ['Doors open.', 'The night heats up.'], body: 'Every problem anyone raises lands on one live map, coloured by team. You see the hot spots before they spread.', scene: <HeatMap key="m" /> },
    { kicker: 'CH05 · SECURITY', title: ['Hold to talk.', 'Like a walkie.'], body: 'Go live and the channel becomes an open radio. Hold the button to talk, let go to listen. Off air, holding it sends a voice clip.', scene: <Walkie key="w" /> },
    { kicker: '20:41 · RESOLVED', title: ['Raise it. Fix it.', 'Everyone sees it.'], body: 'Tap “On it” so nobody doubles up, “Fixed” when it’s done. The map cools down for everyone at once.', scene: <IssueFlip key="f" /> },
  ];
  const s = slides[i];
  const last = i === slides.length - 1;
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="demo-title"
      className="beams fixed inset-0 z-[60] flex flex-col overflow-hidden bg-[radial-gradient(120%_70%_at_50%_0%,#2f45ff_0%,#101a8f_38%,#05060d_78%)] text-white">
      <div className="relative z-10 flex items-center gap-1.5 px-5 pt-[max(1rem,env(safe-area-inset-top))]">
        {slides.map((_, k) => (
          <span key={k} className="h-1 flex-1 overflow-hidden rounded-full bg-white/20">
            <span className={cx('block h-full rounded-full bg-white transition-all duration-500', k < i ? 'w-full' : k === i ? 'w-1/2' : 'w-0')} />
          </span>
        ))}
        <button onClick={onDone} className="ml-3 text-sm font-semibold text-white/80">Skip</button>
      </div>
      <div className="relative z-10 flex min-h-0 flex-1 items-center justify-center px-6" key={i} aria-hidden>{s.scene}</div>
      <div className="relative z-10 px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]" key={`t${i}`}>
        <p className="lcd slide-up text-xs font-bold text-[#d7ff3a]">{s.kicker}</p>
        <h2 id="demo-title" className="slide-up mt-2 font-display text-[38px] leading-[0.98] font-extrabold tracking-tight" style={{ animationDelay: '60ms' }}>
          {s.title[0]}<br /><span className="text-[#d7ff3a]">{s.title[1]}</span>
        </h2>
        <p className="slide-up mt-3 max-w-[36ch] text-[15px] leading-relaxed text-white/75" style={{ animationDelay: '120ms' }}>{s.body}</p>
        <button onClick={() => (last ? onDone() : setI(i + 1))}
          className="mt-6 flex h-15 w-full items-center justify-center gap-2 rounded-full bg-[linear-gradient(180deg,#2a2d3a,#0d0f17)] py-4 font-display text-lg font-bold shadow-[inset_0_1px_0_rgba(255,255,255,.18),0_16px_30px_-12px_rgba(0,0,0,.9)]">
          {last ? 'Open backstage' : 'Next'}<ArrowRight size={20} />
        </button>
      </div>
    </div>
  );
}

function PassStack() {
  const show = [TEAMS[0], TEAMS[1], TEAMS[2], TEAMS[4], TEAMS[8]];
  const rot = [-9, -4, 1, 5, 10];
  return (
    <div className="relative h-[300px] w-[290px]">
      {show.map((t, k) => (
        <div key={t.id} className="fan-in absolute left-1/2 flex h-[68px] w-[262px] -translate-x-1/2 items-center gap-3 rounded-[22px] px-4 shadow-[0_18px_30px_-14px_rgba(0,0,0,.95)]"
          style={{ top: k * 58, ['--r' as string]: `${rot[k] * 0.6}deg`, ['--r0' as string]: `${rot[k] * 2}deg`, animationDelay: `${k * 110}ms`,
            background: `linear-gradient(135deg, ${t.color} 0%, color-mix(in srgb, ${t.color} 70%, #05060d) 100%)`, color: '#05060d' }}>
          <span className="lcd grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#05060d]/85 text-sm font-bold" style={{ color: t.color }}>{String(t.ch).padStart(2, '0')}</span>
          <span className="min-w-0 flex-1 truncate font-display text-xl font-extrabold">{t.name}</span>
          {k === 3 && <span className="lcd flex shrink-0 items-center gap-1 rounded-full bg-[#05060d] px-2 py-0.5 text-[10px] font-bold text-white"><Radio size={10} />ON AIR</span>}
        </div>
      ))}
    </div>
  );
}

const PINS = [
  { x: 50, y: 30, c: '#ff6a4d', label: 'Crowd surge · barrier', crit: true },
  { x: 14, y: 52, c: '#c9a2ff', label: 'Bar 1 card machine down' },
  { x: 50, y: 14, c: '#7aa2ff', label: 'Monitor feedback' },
  { x: 84, y: 112, c: '#5fd1ff', label: 'Queue past the corner' },
  { x: 86, y: 52, c: '#ffb547', label: 'Green room restock' },
];

function HeatMap() {
  const [n, setN] = useState(0);
  const [mins, setMins] = useState(0);
  useEffect(() => {
    const a = setInterval(() => setN((v) => Math.min(PINS.length, v + 1)), 650);
    const b = setInterval(() => setMins((v) => Math.min(135, v + 5)), 90);
    return () => { clearInterval(a); clearInterval(b); };
  }, []);
  const clock = 18 * 60 + 30 + mins;
  const heat = Math.round((n / PINS.length) * 100);
  return (
    <div className="w-full max-w-[320px]">
      <div className="mb-3 flex items-center justify-between">
        <span className="lcd text-2xl font-bold">{String(Math.floor(clock / 60)).padStart(2, '0')}:{String(clock % 60).padStart(2, '0')}</span>
        <span className="lcd rounded-full bg-[#ff3d6e] px-2.5 py-1 text-[11px] font-bold">HEAT {heat}%</span>
      </div>
      <div className="mb-3 h-2 overflow-hidden rounded-full bg-white/15">
        <div className="h-full rounded-full bg-[linear-gradient(90deg,#d7ff3a,#ffb547,#ff3d6e)] transition-all duration-500" style={{ width: `${Math.max(4, heat)}%` }} />
      </div>
      <div className="relative aspect-[100/120] rounded-[28px] bg-white/[.06] p-2 ring-1 ring-white/10">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/venue.svg" alt="" className="absolute inset-2 h-[calc(100%-1rem)] w-[calc(100%-1rem)] opacity-60 [filter:hue-rotate(200deg)_saturate(.6)]" />
        {PINS.slice(0, n).map((p, k) => (
          <span key={k} className="pop-in absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${p.x}%`, top: `${(p.y / 140) * 100}%` }}>
            <span className="ring-out absolute inset-0 rounded-full" style={{ background: p.c }} />
            <span className="relative grid h-7 w-7 place-items-center rounded-full text-[#05060d] shadow-lg" style={{ background: p.c }}><AlertTriangle size={13} strokeWidth={2.6} /></span>
          </span>
        ))}
        {n > 0 && (
          <div key={n} className="slide-up absolute inset-x-3 bottom-3 rounded-2xl bg-[#05060d]/90 px-3 py-2 text-sm ring-1 ring-white/10">
            <span className="lcd mr-2 text-[10px] font-bold" style={{ color: PINS[n - 1].c }}>NEW</span>{PINS[n - 1].label}
          </div>
        )}
      </div>
    </div>
  );
}

function Walkie() {
  const [on, setOn] = useState(false);
  const [line, setLine] = useState(0);
  useEffect(() => {
    const a = setInterval(() => setOn((v) => !v), 1600);
    const b = setInterval(() => setLine((v) => v + 1), 1600);
    return () => { clearInterval(a); clearInterval(b); };
  }, []);
  const lines = ['Barrier B is packed, need two more on the pit.', 'Copy, sending runners from Gate C.', 'Two on the way. ETA one minute.'];
  return (
    <div className="flex w-full max-w-[320px] flex-col items-center">
      <div className="lcd mb-5 w-full rounded-2xl bg-black/50 px-4 py-3 text-center ring-1 ring-white/10">
        <p className="text-[11px] text-white/50">CHANNEL</p>
        <p className="text-2xl font-bold text-[#ff6a4d]">CH05 · SECURITY</p>
        <p className="mt-1 text-[11px] text-[#d7ff3a]">{on ? '● TRANSMITTING' : '○ LISTENING · 6 ON CHANNEL'}</p>
      </div>
      <div className="relative">
        {on && <><span className="ring-out absolute inset-0 rounded-full bg-[#ff6a4d]" /><span className="ring-out-2 absolute inset-0 rounded-full bg-[#ff6a4d]" /></>}
        <span className={cx('relative grid h-36 w-36 place-items-center rounded-full text-[#05060d] transition-transform duration-300', on && 'scale-95')}
          style={{ background: 'radial-gradient(circle at 35% 30%, #fff 0%, #ff6a4d 55%, #ff6a4d 100%)' }}>
          {on ? <span className="eq flex h-10 items-end gap-1">{[0.6, 1, 0.7, 0.9, 0.5].map((h, k) => <span key={k} style={{ height: `${h * 100}%`, width: 5, background: '#05060d' }} />)}</span> : <Radio size={44} strokeWidth={2.4} />}
        </span>
      </div>
      <p key={line} className="slide-up mt-6 rounded-3xl rounded-bl-md bg-white/10 px-4 py-3 text-[15px]">“{lines[line % lines.length]}”</p>
    </div>
  );
}

function IssueFlip() {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setStep((v) => (v + 1) % 4), 1300);
    return () => clearInterval(id);
  }, []);
  const status = step === 0 ? 'Open' : step === 1 ? 'On it · Asha' : 'Fixed';
  const tone = step === 0 ? 'bg-[#ff3d6e]' : step === 1 ? 'bg-[#ffb547] text-[#05060d]' : 'bg-[#3ef0c4] text-[#05060d]';
  return (
    <div className="w-full max-w-[320px] space-y-3">
      <div className={cx('rounded-[28px] p-5 transition-colors duration-500', step >= 2 ? 'bg-[#3ef0c4]/15 ring-1 ring-[#3ef0c4]/50' : 'bg-[#ff3d6e]/15 ring-1 ring-[#ff3d6e]/50')}>
        <div className="flex items-center justify-between">
          <span className="lcd text-[11px] font-bold text-[#7aa2ff]">CH03 PROD</span>
          <span className={cx('lcd rounded-full px-2.5 py-1 text-[11px] font-bold transition-colors', tone)}>{status.toUpperCase()}</span>
        </div>
        <p className="mt-2 font-display text-2xl leading-tight font-extrabold">Vocal mic down on stage</p>
        <p className="mt-1 text-sm text-white/60">📍 Stage · raised by Kiran</p>
        <div className="mt-4 flex gap-2">
          <span className={cx('flex flex-1 items-center justify-center gap-1 rounded-full py-2 text-xs font-bold transition', step === 1 ? 'bg-white text-[#05060d] scale-105' : 'bg-white/10')}><Hand size={14} />On it</span>
          <span className={cx('flex flex-1 items-center justify-center gap-1 rounded-full py-2 text-xs font-bold transition', step >= 2 ? 'bg-[#3ef0c4] text-[#05060d] scale-105' : 'bg-white/10')}><CheckCircle2 size={14} />Fixed</span>
        </div>
      </div>
      {['CH01 CTRL · Show caller: “Hold the encore 2 min”', 'CH05 SEC · Barrier B cleared'].map((t, k) => (
        <div key={t} className="slide-up glass rounded-2xl px-4 py-3 text-sm" style={{ animationDelay: `${300 + k * 200}ms` }}>{t}</div>
      ))}
    </div>
  );
}
