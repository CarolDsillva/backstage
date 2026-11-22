'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, PhoneCall, PhoneOff, Volume2, VolumeX } from 'lucide-react';
import { useRoom } from '@/lib/client/useRoom';
import { useRecorder } from '@/lib/client/recorder';
import { clearRadioError, goLive, key, leave, onRadio, radioAvailable, type RadioState } from '@/lib/client/radio';
import type { ChatMsg } from '@/lib/client/nexconn';
import type { CrewState } from '@/lib/client/useCrew';
import { team as teamOf, type TeamId } from '@/lib/shared/teams';
import { VoiceClip, firstName } from './Messages';
import { chNo, chirp, clock, cx } from './ui';

const APP_KEY = process.env.NEXT_PUBLIC_NEXCONN_APP_KEY ?? '';
/** Live group calls (Call SDK) cost paid minutes; turn on with NEXT_PUBLIC_LIVE_CALLS=1 once the account has them. */
const LIVE_CALLS = process.env.NEXT_PUBLIC_LIVE_CALLS === '1';

/**
 * A walkie-talkie. Pick a channel with the knob, hold the big button to talk.
 * Each transmission is a Nexconn HD voice message on that team's channel (Chat SDK), so it also
 * lands in the chat history. With the speaker on, new transmissions play out loud as they arrive.
 * "Open line" is a live group audio call on the Nexconn Call SDK.
 */
export function Walkie({ state, teamId, slug, viewer, onChange, onSent }: {
  state: CrewState; teamId: TeamId; slug: string; viewer: boolean; onChange: (t: TeamId) => void; onSent?: () => void;
}) {
  const channels = state.canOpen;
  const idx = Math.max(0, channels.indexOf(teamId));
  const t = teamOf(teamId);
  const channelId = state.channels[teamId] ?? null;
  const me = useMemo(() => ({ userId: state.me.userId, name: state.me.name, appKey: APP_KEY, setup: { call: true, chatUI: true } }), [state.me.userId, state.me.name]);
  const room = useRoom(channelId, me, slug);
  const rec = useRecorder();
  const [speaker, setSpeaker] = useState(true);
  const [rx, setRx] = useState<{ name: string; until: number } | null>(null);
  const [radio, setRadio] = useState<RadioState | null>(null);
  const [sending, setSending] = useState(false);
  const clips = room.messages.filter((m) => m.type === 'RC:HQVCMsg');
  const recent = room.messages.slice(-6).reverse();
  const onAir = radio?.status === 'live' && radio.team === teamId;
  const liveSession = state.radio.find((r) => r.team === teamId) ?? null;

  useEffect(() => onRadio(setRadio), []);

  // Speaker on: play fresh incoming clips and show who is talking on the screen.
  const played = useRef<string | null>(null);
  useEffect(() => {
    const last = room.messages[room.messages.length - 1];
    if (!speaker || !last || last.mine || last.type !== 'RC:HQVCMsg' || last.id === played.current) return;
    if (Date.now() - last.sentAt > 15_000) return;
    played.current = last.id;
    const url = String((last.content as { remoteUrl?: string }).remoteUrl ?? '');
    if (!url) return;
    const a = new Audio(url);
    setRx({ name: last.senderName, until: Date.now() + Number((last.content as { duration?: number }).duration ?? 3) * 1000 });
    a.onended = () => { setRx(null); chirp(); };
    chirp();
    setTimeout(() => void a.play().catch(() => setRx(null)), 160);
  }, [room.messages, speaker]);

  async function down() {
    if (viewer || !channelId) return;
    if (onAir) return void key(true);
    await rec.start();
  }
  async function up() {
    if (onAir) return void key(false);
    const f = await rec.stop();
    if (!f) return;
    setSending(true);
    try { await room.sendVoice(f); onSent?.(); } catch (e) { rec.setError((e as Error).message); } finally { setSending(false); }
  }
  const step = (d: number) => onChange(channels[(idx + d + channels.length) % channels.length]);
  const talking = onAir ? !!radio?.talking : rec.recording;

  const screen = talking ? { top: 'TX', main: onAir ? 'LIVE' : `${rec.secs}s`, sub: 'TALKING · RELEASE TO SEND' }
    : sending ? { top: 'TX', main: 'SEND', sub: 'SENDING CLIP…' }
    : rx ? { top: 'RX', main: firstName(rx.name).toUpperCase().slice(0, 8), sub: 'INCOMING' }
    : onAir ? { top: 'LINE', main: 'OPEN', sub: `${radio?.listeners ?? 0} ON THE LINE` }
    : { top: 'STBY', main: t.short, sub: room.status === 'online' ? `${clips.length} CLIP${clips.length === 1 ? '' : 'S'} ON CHANNEL` : 'TUNING…' };

  return (
    <div className="px-5 pb-36">
      {/* The device */}
      <div className="relative mx-auto mt-10 max-w-[360px]">
        <span className="absolute -top-10 left-9 h-14 w-4 rounded-t-full bg-[#0B0620]" aria-hidden />
        <span className="absolute -top-3 left-[92px] h-4 w-10 rounded-t-xl bg-[#2A2532]" aria-hidden />
        <div className="relative rounded-[44px] bg-[#0B0620] p-5 pb-6 shadow-[0_30px_60px_-24px_rgba(23,20,31,.6),inset_0_2px_0_rgba(255,255,255,.08)]">
          <div className="mb-3 flex items-center justify-between px-1">
            <span className="text-[10px] font-bold tracking-[0.3em] text-white/40">BACKSTAGE · FM</span>
            <span className={cx('h-2.5 w-2.5 rounded-full', talking ? 'bg-[#FF6B5B] shadow-[0_0_10px_#FF6B5B]' : rx ? 'bg-[#4BE3A8] shadow-[0_0_10px_#4BE3A8]' : 'bg-white/20')} aria-hidden />
          </div>

          {/* LCD */}
          <div className="rounded-[22px] bg-[#C9E8B7] p-4 font-mono text-[#1E3A16] shadow-[inset_0_3px_8px_rgba(0,0,0,.25)]" role="status" aria-live="polite">
            <div className="flex items-center justify-between text-[11px] font-bold">
              <span>CH{chNo(teamId)}</span><span>{screen.top}</span>
            </div>
            <p className="mt-1 text-center text-[40px] leading-none font-bold tracking-wider">{screen.main}</p>
            <p className="mt-1.5 truncate text-center text-[11px] font-bold">{t.name.toUpperCase()}</p>
            <p className="mt-0.5 truncate text-center text-[10px] opacity-70">{screen.sub}</p>
          </div>

          {/* Knob + speaker */}
          <div className="mt-4 flex items-center justify-between">
            <button onClick={() => step(-1)} className="grid h-12 w-12 place-items-center rounded-full bg-[#2A2532] text-white active:bg-[#3A3443]" aria-label="Previous channel"><ChevronLeft size={22} /></button>
            <div className="grid grid-cols-6 gap-1.5 px-2" aria-hidden>
              {Array.from({ length: 18 }).map((_, i) => <span key={i} className="h-1.5 w-1.5 rounded-full bg-black/60 shadow-[inset_0_1px_0_rgba(255,255,255,.08)]" />)}
            </div>
            <button onClick={() => step(1)} className="grid h-12 w-12 place-items-center rounded-full bg-[#2A2532] text-white active:bg-[#3A3443]" aria-label="Next channel"><ChevronRight size={22} /></button>
          </div>

          {/* Push to talk */}
          <div className="relative mx-auto mt-5 grid place-items-center">
            {talking && <><span className="ring-out absolute h-36 w-36 rounded-full bg-[#EC4F9B]" /><span className="ring-out-2 absolute h-36 w-36 rounded-full bg-[#EC4F9B]" /></>}
            <button data-tour="ptt" disabled={viewer || room.status !== 'online'}
              onPointerDown={(e) => { e.preventDefault(); (e.target as HTMLElement).setPointerCapture?.(e.pointerId); void down(); }}
              onPointerUp={() => void up()} onPointerCancel={() => void up()} onContextMenu={(e) => e.preventDefault()}
              onKeyDown={(e) => { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) { e.preventDefault(); void down(); } }}
              onKeyUp={(e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); void up(); } }}
              aria-label={viewer ? 'Push to talk (crew only)' : `Hold to talk on ${t.name}`}
              className={cx('relative grid h-36 w-36 touch-none select-none place-items-center rounded-full text-white transition-transform disabled:opacity-50',
                talking ? 'scale-95 bg-[#D63C86]' : 'bg-[#EC4F9B]')}
              style={{ boxShadow: talking ? 'inset 0 6px 14px rgba(0,0,0,.35)' : '0 10px 0 #FF8CC6, 0 22px 30px -10px rgba(236,79,155,.6)' }}>
              <span className="text-center">
                <span className="block font-display text-[22px] leading-none font-extrabold">{talking ? 'TALKING' : 'PUSH'}</span>
                <span className="mt-1 block text-[11px] font-bold tracking-[0.2em] opacity-85">{talking ? 'RELEASE' : 'TO TALK'}</span>
              </span>
            </button>
          </div>

          <div className="mt-6 flex items-center justify-center gap-2">
            <button onClick={() => setSpeaker((v) => !v)} aria-pressed={speaker}
              className={cx('flex h-10 items-center gap-1.5 rounded-full px-4 text-xs font-bold', speaker ? 'bg-[#251856] text-white' : 'bg-[#2A2532] text-white/70')}>
              {speaker ? <Volume2 size={15} /> : <VolumeX size={15} />}Speaker {speaker ? 'on' : 'off'}
            </button>
            {!viewer && LIVE_CALLS && radioAvailable() && (onAir ? (
              <button onClick={() => void leave()} className="flex h-10 items-center gap-1.5 rounded-full bg-[#FF6B5B] px-4 text-xs font-bold text-white"><PhoneOff size={15} />Close line</button>
            ) : (
              <button onClick={() => channelId && void goLive({ slug, team: teamId, channelId, existingCallId: liveSession?.callId,
                members: state.crew.filter((c) => teamId === 'control' || c.team === teamId || c.role === 'lead').map((c) => c.userId) })}
                className="flex h-10 items-center gap-1.5 rounded-full bg-[#2A2532] px-4 text-xs font-bold text-white/80">
                <PhoneCall size={15} />{radio?.status === 'connecting' ? 'Calling…' : liveSession ? 'Join open line' : 'Open line'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {(rec.error || (radio?.status === 'error' && radio.error)) && (
        <p role="alert" className="mx-auto mt-3 flex max-w-[360px] items-start gap-2 rounded-2xl bg-[#4A1D3F] px-4 py-3 text-sm text-[#FF9A8F]">
          <span className="flex-1">{rec.error || radio?.error}</span>
          {radio?.status === 'error' && <button onClick={clearRadioError} className="font-bold underline">OK</button>}
        </p>
      )}
      {viewer && <p className="mx-auto mt-3 max-w-[360px] text-center text-sm text-[#B8ABE6]">Guests can listen. Crew hold the button to talk.</p>}

      {/* Channel strip */}
      <div className="-mx-5 mt-8 flex gap-2 overflow-x-auto px-5 pb-1" role="radiogroup" aria-label="Channel">
        {channels.map((c) => (
          <button key={c} role="radio" aria-checked={c === teamId} onClick={() => onChange(c)}
            className={cx('shrink-0 rounded-full px-3.5 py-2 text-sm font-semibold', c === teamId ? 'bg-[#7C4DFF] text-white' : 'bg-[#251856] text-[#CFC4F5]')}>
            <span className={cx('mr-1 font-mono font-bold', c === teamId ? 'text-[#FF9CCB]' : 'text-[#8C7FC0]')}>{chNo(c)}</span>{teamOf(c).short}
          </button>
        ))}
      </div>

      <h2 className="mt-5 mb-2 px-1 font-display text-[20px] font-extrabold">On CH{chNo(teamId)} lately</h2>
      <ul className="space-y-2">
        {recent.length === 0 && <li className="rounded-[20px] bg-[#251856] p-4 text-center text-sm text-[#B8ABE6]">{room.loading ? 'Tuning in…' : 'Quiet channel. Be the first to key up.'}</li>}
        {recent.map((m) => <Recent key={m.id} m={m} />)}
      </ul>
    </div>
  );
}

function Recent({ m }: { m: ChatMsg }) {
  const c = m.content as Record<string, unknown>;
  return (
    <li className="flex items-center gap-3 rounded-[20px] bg-[#251856] px-4 py-3">
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-bold text-[#B8ABE6]">{m.mine ? 'You' : m.senderId === 'backstagebot' ? 'Backstage' : m.senderName} · {clock(m.sentAt)}</span>
        {m.type === 'RC:HQVCMsg'
          ? <span className="text-white"><VoiceClip url={String(c.remoteUrl ?? '')} secs={Number(c.duration ?? 0)} mine={false} /></span>
          : <span className="block truncate text-sm">{m.type === 'RC:TxtMsg' ? String(c.text ?? '') : m.type === 'RC:ImgMsg' ? '📷 Photo' : String(c.title ?? c.text ?? 'Update')}</span>}
      </span>
    </li>
  );
}
