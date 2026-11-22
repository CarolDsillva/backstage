'use client';
import { useEffect, useRef, useState } from 'react';
import { Phone, PhoneOff, RotateCcw, X } from 'lucide-react';
import { sendVoice } from '@/lib/client/nexconn';
import { useRecorder } from '@/lib/client/recorder';
import type { CrewState } from '@/lib/client/useCrew';
import { team as teamOf, type TeamId } from '@/lib/shared/teams';
import { firstName } from './Messages';
import { Face, TeamBadge, cx, ring } from './ui';

/**
 * Voice call to a whole team. Live group calls need paid Nexconn call minutes, so this is a
 * "delayed call": hold and speak, and when you let go your voice goes out as an HD voice message
 * marked as a call. Every phone on the channel rings and plays it out loud straight away.
 */
export function CallOut({ state, teamId, onClose, onSent }: {
  state: CrewState; teamId: TeamId; onClose: () => void; onSent: () => void;
}) {
  const rec = useRecorder();
  const [phase, setPhase] = useState<'ready' | 'sending' | 'sent'>('ready');
  const [err, setErr] = useState('');
  const t = teamOf(teamId);
  const channelId = state.channels[teamId];
  const others = state.crew.filter((c) => c.userId !== state.me.userId && (teamId === 'control' || c.team === teamId || c.role === 'lead'));

  async function release() {
    const f = await rec.stop();
    if (!f || !channelId) return;
    setPhase('sending');
    try {
      await sendVoice(channelId, f, { call: true });
      setPhase('sent');
      onSent();
      setTimeout(onClose, 2200);
    } catch (e) { setErr((e as Error).message); setPhase('ready'); }
  }

  return (
    <div role="dialog" aria-modal="true" aria-label={`Call ${t.name}`} className="cosmos fixed inset-0 z-[70] mx-auto flex max-w-[480px] flex-col items-center px-6 pt-[max(1.25rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))] text-white">
      <button onClick={onClose} className="self-end grid h-11 w-11 place-items-center rounded-full bg-white/10" aria-label="Close"><X size={20} /></button>
      <TeamBadge team={teamId} size={84} />
      <p className="mt-4 font-display text-[30px] font-extrabold">Call {t.name}</p>
      <p className="mt-1 text-center text-sm text-[#B8ABE6]">
        {others.length} {others.length === 1 ? 'person hears' : 'people hear'} you. Their phones ring and play your voice out loud, even if they’re busy.
      </p>
      <div className="mt-4 flex -space-x-2">{others.slice(0, 7).map((c) => <span key={c.userId} className="rounded-full ring-2 ring-[#160B36]"><Face name={c.name} size={34} /></span>)}</div>

      <div className="relative mt-auto mb-6 grid place-items-center">
        {rec.recording && <><span className="ring-out absolute h-44 w-44 rounded-full bg-[#2FB392]" /><span className="ring-out-2 absolute h-44 w-44 rounded-full bg-[#2FB392]" /></>}
        <button disabled={phase !== 'ready'}
          onPointerDown={(e) => { e.preventDefault(); (e.target as HTMLElement).setPointerCapture?.(e.pointerId); void rec.start(); }}
          onPointerUp={() => void release()} onPointerCancel={() => void release()} onContextMenu={(e) => e.preventDefault()}
          onKeyDown={(e) => { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) { e.preventDefault(); void rec.start(); } }}
          onKeyUp={(e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); void release(); } }}
          data-tour="call-hold"
          aria-label="Hold to speak, release to call"
          className={cx('relative grid h-44 w-44 touch-none select-none place-items-center rounded-full text-white transition-transform', rec.recording ? 'scale-95 bg-[#24946F]' : 'bg-[#2FB392]', phase !== 'ready' && 'opacity-80')}
          style={{ boxShadow: rec.recording ? 'inset 0 6px 14px rgba(0,0,0,.35)' : '0 10px 0 #1C6B5B, 0 24px 40px -10px rgba(47,179,146,.6)' }}>
          <span className="text-center">
            <Phone size={34} className="mx-auto" />
            <span className="mt-2 block font-display text-lg leading-tight font-extrabold">
              {phase === 'sent' ? 'Ringing' : phase === 'sending' ? 'Calling…' : rec.recording ? `${rec.secs}s · let go` : 'Hold & speak'}
            </span>
          </span>
        </button>
      </div>
      <p role="status" className="min-h-5 text-center text-sm font-semibold text-[#5EE6C0]">
        {phase === 'sent' ? `Delivered. ${t.name} is hearing you now.` : ''}
      </p>
      {(err || rec.error) && <p role="alert" className="mt-1 text-center text-sm font-semibold text-[#FF9A8F]">{err || rec.error}</p>}
    </div>
  );
}

/** Incoming voice call: rings, then plays the caller's voice out loud. */
export function CallIn({ from, teamId, url, onClose, onCallBack }: {
  from: string; teamId: TeamId; url: string; onClose: () => void; onCallBack: () => void;
}) {
  const [state, setState] = useState<'ringing' | 'playing' | 'done'>('ringing');
  const audio = useRef<HTMLAudioElement | null>(null);
  const t = teamOf(teamId);

  async function play() {
    setState('playing');
    audio.current ??= new Audio(url);
    audio.current.currentTime = 0;
    audio.current.onended = () => setState('done');
    await audio.current.play().catch(() => setState('done'));
  }
  useEffect(() => {
    let alive = true;
    void ring().then(() => { if (alive) void play(); });
    return () => { alive = false; audio.current?.pause(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div role="alertdialog" aria-label={`${from} is calling ${t.name}`} className="pop-in fixed inset-x-3 top-[max(0.75rem,env(safe-area-inset-top))] z-[90] mx-auto max-w-[460px] rounded-[30px] bg-[#0E0726]/95 p-4 text-white shadow-[0_24px_50px_-10px_rgba(0,0,0,.8)] ring-1 ring-white/15 backdrop-blur-xl">
      <div className="flex items-center gap-3">
        <span className="relative grid place-items-center">
          {state !== 'done' && <span className="ring-out absolute h-12 w-12 rounded-full bg-[#2FB392]" />}
          <span className="relative"><Face name={from} size={48} /></span>
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold tracking-[0.12em] text-[#5EE6C0] uppercase">{state === 'ringing' ? 'Incoming call' : state === 'playing' ? 'On the line' : 'Call ended'} · {t.name}</p>
          <p className="truncate font-display text-xl font-extrabold">{firstName(from)} is calling</p>
        </div>
        {state === 'playing' && (
          <span className="eq flex h-7 items-end gap-[3px] text-[#5EE6C0]" aria-hidden>{[0.5, 0.9, 0.6, 1, 0.7].map((h, i) => <span key={i} style={{ height: `${h * 100}%`, background: 'currentColor' }} />)}</span>
        )}
      </div>
      <div className="mt-3 flex gap-2">
        <button onClick={onClose} className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-full bg-white/10 text-sm font-bold"><PhoneOff size={16} />Close</button>
        <button onClick={() => void play()} disabled={state !== 'done'} className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-full bg-white/10 text-sm font-bold disabled:opacity-40"><RotateCcw size={16} />Replay</button>
        <button onClick={onCallBack} className="flex h-11 flex-[1.3] items-center justify-center gap-1.5 rounded-full bg-[#2FB392] text-sm font-extrabold"><Phone size={16} />Call back</button>
      </div>
    </div>
  );
}
