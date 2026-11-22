'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, AlertTriangle, CheckCircle2, Hand, ImagePlus, Megaphone, Radio, RadioTower, Send, Volume2, VolumeX } from 'lucide-react';
import { useRoom } from '@/lib/client/useRoom';
import type { ChatMsg } from '@/lib/client/nexconn';
import { crewPost, type CrewState } from '@/lib/client/useCrew';
import { clearRadioError, goLive, key, leave, onRadio, radioAvailable, setAutoJoin, type RadioState } from '@/lib/client/radio';
import { BS_TYPES, type Incident } from '@/lib/shared/types';
import { team as teamOf, ISSUE_STATUS_LABEL, type TeamId } from '@/lib/shared/teams';
import { ChLabel, Face, SEVERITY_STYLE, ago, cx, useNow } from './bits';

const APP_KEY = process.env.NEXT_PUBLIC_NEXCONN_APP_KEY ?? '';

export function TeamRoom({ state, teamId, slug, onBack, onRaise, onChanged }: {
  state: CrewState; teamId: TeamId; slug: string; onBack: () => void; onRaise: () => void; onChanged: () => void;
}) {
  const t = teamOf(teamId);
  const channelId = state.channels[teamId] ?? null;
  const me = useMemo(() => ({ userId: state.me.userId, name: state.me.name, appKey: APP_KEY, setup: { call: true, chatUI: true } }), [state.me.userId, state.me.name]);
  const room = useRoom(channelId, me, slug);
  const now = useNow(20_000);
  const [radio, setRadio] = useState<RadioState | null>(null);
  const [radioOn, setRadioOn] = useState(() => readPref(slug, teamId));
  const members = state.crew.filter((c) => (teamId === 'control' ? true : c.team === teamId || c.role === 'lead'));
  const issues = state.issues.filter((i) => i.team === teamId && i.status !== 'resolved');
  const liveSession = state.radio.find((r) => r.team === teamId) ?? null;
  const onAirHere = radio?.status === 'live' && radio.team === teamId;
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => onRadio(setRadio), []);
  useEffect(() => { setAutoJoin(teamId, radioOn); writePref(slug, teamId, radioOn); }, [slug, teamId, radioOn]);
  useEffect(() => { const el = listRef.current; if (el) el.scrollTop = el.scrollHeight; }, [room.messages.length]);

  // "Radio on": play incoming walkie clips out loud as they arrive.
  const lastPlayed = useRef<string | null>(null);
  useEffect(() => {
    if (!radioOn || onAirHere) return;
    const last = room.messages[room.messages.length - 1];
    if (!last || last.mine || last.type !== 'RC:HQVCMsg' || last.id === lastPlayed.current) return;
    if (Date.now() - last.sentAt > 15_000) return; // only fresh clips, not history
    lastPlayed.current = last.id;
    const url = String((last.content as { remoteUrl?: string }).remoteUrl ?? '');
    if (url) void new Audio(url).play().catch(() => {});
  }, [room.messages, radioOn, onAirHere]);

  const goOnAir = () => channelId && void goLive({
    slug, team: teamId, channelId, existingCallId: liveSession?.callId,
    members: members.map((m) => m.userId),
  });

  return (
    <div className="crew-bg fixed inset-0 z-40 flex flex-col">
      <header className="relative px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3">
        <div className="absolute inset-x-0 top-0 h-1" style={{ background: t.color }} aria-hidden />
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="grid h-11 w-11 place-items-center rounded-full bg-white/10" aria-label="Back"><ArrowLeft size={20} /></button>
          <div className="min-w-0 flex-1">
            <ChLabel team={teamId} />
            <h1 className="truncate font-display text-2xl leading-tight font-extrabold">{t.name}</h1>
          </div>
          <button onClick={() => setRadioOn((v) => !v)} aria-pressed={radioOn}
            className={cx('flex h-11 items-center gap-1.5 rounded-full px-3 text-xs font-bold', radioOn ? 'bg-[#d7ff3a] text-[#05060d]' : 'bg-white/10 text-white/70')}
            title="Radio on: auto-join when someone goes on air, and play voice clips out loud">
            {radioOn ? <Volume2 size={16} /> : <VolumeX size={16} />}Radio {radioOn ? 'on' : 'off'}
          </button>
        </div>
        <div className="mt-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="flex -space-x-2">{members.slice(0, 5).map((m) => <Face key={m.userId} name={m.name} color={t.color} size={26} />)}</span>
            <span className="text-xs text-white/55">{members.length} on channel</span>
          </div>
          {radioAvailable() && (onAirHere ? (
            <button onClick={() => void leave()} className="lcd flex items-center gap-1.5 rounded-full bg-[#ff3d6e] px-3 py-1.5 text-[11px] font-bold">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />ON AIR · {radio?.listeners ?? 0} LISTENING · LEAVE
            </button>
          ) : (
            <button onClick={goOnAir} disabled={radio?.status === 'connecting'}
              className={cx('lcd flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-bold', liveSession ? 'bg-[#ff3d6e]/20 text-[#ff8fab] ring-1 ring-[#ff3d6e]/60' : 'bg-white/10 text-white/80')}>
              <RadioTower size={13} />{radio?.status === 'connecting' && radio.team === teamId ? 'TUNING IN…' : liveSession ? 'RADIO LIVE · JOIN' : 'GO LIVE ON RADIO'}
            </button>
          ))}
        </div>
        {radio?.error && radio.status === 'error' && (
          <p role="alert" className="mt-2 flex items-start gap-2 rounded-xl bg-[#ff3d6e]/15 px-3 py-2 text-xs text-[#ff8fab]">
            <span className="flex-1">{radio.error}</span>
            <button onClick={clearRadioError} className="font-bold underline">OK</button>
          </p>
        )}
      </header>

      {issues.length > 0 && <IssueStrip issues={issues} slug={slug} now={now} onChanged={onChanged} />}

      <div ref={listRef} className="min-h-0 flex-1 space-y-2.5 overflow-y-auto px-4 py-3" aria-live="polite">
        {room.loading && room.messages.length === 0 && <p className="text-center text-sm text-white/50">Tuning in…</p>}
        {!room.loading && room.messages.length === 0 && (
          <p className="glass mx-auto mt-6 max-w-xs rounded-3xl p-5 text-center text-sm text-white/65">
            Channel {t.ch} is quiet. Hold the big button to talk, or raise an issue so everyone sees it on the map.
          </p>
        )}
        {room.messages.map((m) => <Bubble key={m.id} m={m} color={t.color} now={now} />)}
      </div>

      <Dock teamId={teamId} channelId={channelId} slug={slug} onAirHere={onAirHere} radio={radio} disabled={room.status !== 'online' || !channelId}
        onText={room.sendText} onImage={room.sendImage} onVoice={room.sendVoice} onRaise={onRaise} />
    </div>
  );
}

function IssueStrip({ issues, slug, now, onChanged }: { issues: Incident[]; slug: string; now: number; onChanged: () => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState('');
  async function act(id: string, action: 'take' | 'fix') {
    setBusy(id + action); setErr('');
    try { await crewPost(`/api/crew/${slug}/issues/${id}`, { action }, 'PATCH'); onChanged(); } catch (e) { setErr((e as Error).message); } finally { setBusy(null); }
  }
  return (
    <div className="border-y border-white/5 bg-black/20 py-2.5">
      <div className="flex snap-x gap-2.5 overflow-x-auto px-4">
        {issues.map((i) => (
          <div key={i.id} className={cx('w-64 shrink-0 snap-start rounded-2xl p-3', i.severity === 'critical' ? 'bg-[#ff3d6e]/15 ring-1 ring-[#ff3d6e]/50' : 'glass')}>
            <div className="flex items-center justify-between">
              <span className={cx('rounded-full px-2 py-0.5 text-[10px] font-bold uppercase', SEVERITY_STYLE[i.severity ?? 'normal'].chip)}>{SEVERITY_STYLE[i.severity ?? 'normal'].label}</span>
              <span className="lcd text-[10px] text-white/45">{ago(i.createdAt, now)}</span>
            </div>
            <p className="mt-1.5 line-clamp-2 text-sm font-semibold">{i.title ?? i.note}</p>
            <p className="text-xs text-white/50">{i.status === 'new' ? `Raised by ${i.reporterName}` : `${i.assigneeName ?? 'Someone'} is on it`}</p>
            <div className="mt-2 flex gap-2">
              {i.status === 'new' && (
                <button onClick={() => act(i.id, 'take')} disabled={!!busy} className="flex flex-1 items-center justify-center gap-1 rounded-full bg-white/12 py-1.5 text-xs font-bold disabled:opacity-50">
                  <Hand size={13} />On it
                </button>
              )}
              <button onClick={() => act(i.id, 'fix')} disabled={!!busy} className="flex flex-1 items-center justify-center gap-1 rounded-full bg-[#3ef0c4] py-1.5 text-xs font-bold text-[#05060d] disabled:opacity-50">
                <CheckCircle2 size={13} />Fixed
              </button>
            </div>
          </div>
        ))}
      </div>
      {err && <p role="alert" className="px-4 pt-1 text-xs text-[#ff8fab]">{err}</p>}
    </div>
  );
}

function Bubble({ m, color, now }: { m: ChatMsg; color: string; now: number }) {
  const c = m.content as Record<string, unknown>;
  if (m.type === BS_TYPES.issue) {
    const sev = SEVERITY_STYLE[String(c.severity ?? 'normal')] ?? SEVERITY_STYLE.normal;
    return (
      <div className={cx('mx-auto max-w-sm rounded-3xl p-4', c.severity === 'critical' ? 'bg-[#ff3d6e]/15 ring-1 ring-[#ff3d6e]/60' : 'glass')}>
        <div className="flex items-center gap-2">
          <AlertTriangle size={16} style={{ color: sev.ring }} />
          <span className="lcd text-[11px] font-bold" style={{ color: sev.ring }}>ISSUE · {sev.label.toUpperCase()}</span>
          <span className="lcd ml-auto text-[10px] text-white/40">{ago(m.sentAt, now)}</span>
        </div>
        <p className="mt-1.5 font-display text-lg leading-snug font-bold">{String(c.title ?? '')}</p>
        {c.note ? <p className="mt-1 text-sm text-white/75">{String(c.note)}</p> : null}
        <p className="mt-2 text-xs text-white/50">{c.placeName ? `📍 ${String(c.placeName)} · ` : ''}raised by {String(c.reporterName ?? 'crew')}</p>
      </div>
    );
  }
  if (m.type === BS_TYPES.issueUpdate) {
    const fixed = c.action === 'fix';
    return (
      <p className="mx-auto flex w-fit items-center gap-1.5 rounded-full bg-white/8 px-3 py-1.5 text-xs text-white/75">
        {fixed ? <CheckCircle2 size={13} className="text-[#3ef0c4]" /> : <Hand size={13} className="text-[#ffb547]" />}
        <b>{String(c.by ?? 'Someone')}</b>{fixed ? ' fixed ' : c.action === 'take' ? ' is on ' : ' reopened '}“{String(c.title ?? '')}” · {ISSUE_STATUS_LABEL[String(c.status)] ?? ''}
      </p>
    );
  }
  if (m.type === BS_TYPES.radio) {
    return (
      <p className="lcd mx-auto flex w-fit items-center gap-1.5 rounded-full bg-[#ff3d6e]/15 px-3 py-1.5 text-[11px] font-bold text-[#ff8fab]">
        <Radio size={12} />{c.live ? `RADIO LIVE · ${String(c.by ?? '')}` : 'RADIO OFF AIR'}
      </p>
    );
  }
  if (m.type === BS_TYPES.announce) {
    return (
      <div className="mx-auto max-w-sm rounded-3xl bg-[#d7ff3a] p-4 text-[#05060d]">
        <p className="lcd flex items-center gap-1.5 text-[11px] font-bold"><Megaphone size={13} />ALL HANDS · {String(c.by ?? 'Show caller')}</p>
        <p className="mt-1 font-display text-lg leading-snug font-bold">{String(c.text ?? '')}</p>
      </div>
    );
  }
  let body: React.ReactNode;
  if (m.type === 'RC:HQVCMsg') body = <VoiceClip url={String(c.remoteUrl ?? '')} secs={Number(c.duration ?? 0)} mine={m.mine} />;
  else if (m.type === 'RC:ImgMsg') {
    const src = String(c.remoteUrl ?? (c.thumbnailBase64 ? `data:image/jpeg;base64,${c.thumbnailBase64}` : ''));
    // eslint-disable-next-line @next/next/no-img-element
    body = <a href={String(c.remoteUrl ?? '#')} target="_blank" rel="noreferrer"><img src={src} alt="Photo" className="max-h-56 rounded-2xl" /></a>;
  } else body = <p className="whitespace-pre-wrap break-words">{String(c.text ?? '')}</p>;
  return (
    <div className={cx('flex items-end gap-2', m.mine ? 'justify-end' : 'justify-start')}>
      {!m.mine && <Face name={m.senderName} color={color} size={28} />}
      <div className={cx('max-w-[78%] rounded-3xl px-4 py-2.5 text-[15px]', m.mine ? 'rounded-br-md bg-[#2f45ff] text-white' : 'rounded-bl-md bg-white/10')}>
        {!m.mine && <p className="mb-0.5 text-xs font-bold" style={{ color }}>{m.senderName}</p>}
        {body}
        <p className={cx('lcd mt-0.5 text-[10px]', m.mine ? 'text-white/60' : 'text-white/40')}>{ago(m.sentAt, now)}</p>
      </div>
    </div>
  );
}

function VoiceClip({ url, secs, mine }: { url: string; secs: number; mine: boolean }) {
  const [playing, setPlaying] = useState(false);
  const ref = useRef<HTMLAudioElement | null>(null);
  function toggle() {
    if (!url) return;
    ref.current ??= new Audio(url);
    const a = ref.current;
    a.onended = () => setPlaying(false);
    if (playing) { a.pause(); setPlaying(false); } else { void a.play().then(() => setPlaying(true)).catch(() => setPlaying(false)); }
  }
  return (
    <button onClick={toggle} className="flex items-center gap-2.5 py-0.5" aria-label={playing ? 'Pause voice clip' : 'Play voice clip'}>
      <span className={cx('grid h-8 w-8 place-items-center rounded-full', mine ? 'bg-white text-[#2f45ff]' : 'bg-[#d7ff3a] text-[#05060d]')}>{playing ? '❚❚' : '▶'}</span>
      <span className={cx('eq flex h-5 items-end gap-[3px]', !playing && '[&>span]:[animation-play-state:paused]')}>
        {[0.5, 0.9, 0.6, 1, 0.7].map((h, i) => <span key={i} style={{ height: `${h * 100}%`, background: 'currentColor' }} />)}
      </span>
      <span className="lcd text-xs opacity-80">{secs ? `${secs}s` : 'clip'}</span>
    </button>
  );
}

/** Composer + the walkie talk button. Live radio: hold = open mic. Off air: hold = record a voice clip. */
function Dock({ teamId, channelId, onAirHere, radio, disabled, onText, onImage, onVoice, onRaise }: {
  teamId: TeamId; channelId: string | null; slug: string; onAirHere: boolean; radio: RadioState | null; disabled: boolean;
  onText: (t: string) => Promise<void>; onImage: (f: File) => Promise<void>; onVoice: (f: File) => Promise<void>; onRaise: () => void;
}) {
  const [text, setText] = useState('');
  const [rec, setRec] = useState<{ start: number; mr: MediaRecorder; chunks: Blob[] } | null>(null);
  const [err, setErr] = useState('');
  const [secs, setSecs] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const holding = useRef(false);
  const t = teamOf(teamId);

  useEffect(() => {
    if (!rec) return;
    const id = setInterval(() => setSecs(Math.round((Date.now() - rec.start) / 1000)), 250);
    return () => clearInterval(id);
  }, [rec]);

  async function down() {
    if (disabled || holding.current) return;
    holding.current = true;
    setErr('');
    if (onAirHere) return void key(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!holding.current) { stream.getTracks().forEach((x) => x.stop()); return; }
      const type = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm'].find((m) => MediaRecorder.isTypeSupported(m)) ?? '';
      const mr = new MediaRecorder(stream, type ? { mimeType: type } : undefined);
      const chunks: Blob[] = [];
      mr.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      mr.start(200);
      setSecs(0);
      setRec({ start: Date.now(), mr, chunks });
    } catch {
      holding.current = false;
      setErr('Allow the microphone to talk on the channel.');
    }
  }

  async function up() {
    if (!holding.current) return;
    holding.current = false;
    if (onAirHere) return void key(false);
    const r = rec;
    setRec(null);
    if (!r) return;
    const dur = Date.now() - r.start;
    await new Promise<void>((res) => { r.mr.onstop = () => res(); r.mr.stop(); });
    r.mr.stream.getTracks().forEach((x) => x.stop());
    if (dur < 600 || !channelId) return setErr(dur < 600 ? 'Hold the button while you talk.' : '');
    const mime = r.mr.mimeType || 'audio/webm';
    const file = new File(r.chunks, `walkie.${mime.includes('mp4') ? 'm4a' : 'webm'}`, { type: mime });
    try { await onVoice(file); } catch (e) { setErr((e as Error).message); }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const v = text.trim();
    if (!v) return;
    setText('');
    try { await onText(v); } catch { setText(v); setErr('Not sent. Check your connection and try again.'); }
  }

  const talking = onAirHere ? !!radio?.talking : !!rec;
  const keyed = onAirHere && (radio?.keyed.length ?? 0) > 0;
  return (
    <div className="border-t border-white/5 bg-[#070915]/95 px-4 pt-3 pb-[max(0.9rem,env(safe-area-inset-bottom))] backdrop-blur">
      {err && <p role="alert" className="mb-2 text-center text-xs text-[#ff8fab]">{err}</p>}
      <div className="flex items-center justify-center gap-5">
        <button onClick={onRaise} className="flex w-16 flex-col items-center gap-1 text-[11px] font-semibold text-white/70">
          <span className="grid h-12 w-12 place-items-center rounded-full bg-[#ffb547]/15 text-[#ffb547]"><AlertTriangle size={20} /></span>Raise issue
        </button>
        <div className="relative">
          {talking && <><span className="ring-out absolute inset-0 rounded-full" style={{ background: t.color }} /><span className="ring-out-2 absolute inset-0 rounded-full" style={{ background: t.color }} /></>}
          <button
            onPointerDown={(e) => { e.preventDefault(); (e.target as HTMLElement).setPointerCapture?.(e.pointerId); void down(); }}
            onPointerUp={() => void up()} onPointerCancel={() => void up()}
            onKeyDown={(e) => { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) { e.preventDefault(); void down(); } }}
            onKeyUp={(e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); void up(); } }}
            onContextMenu={(e) => e.preventDefault()}
            disabled={disabled}
            aria-label={onAirHere ? 'Hold to talk live on the radio' : 'Hold to record a voice message'}
            className="relative grid h-24 w-24 touch-none select-none place-items-center rounded-full text-[#05060d] shadow-[0_18px_40px_-12px_rgba(0,0,0,.8)] transition-transform active:scale-95 disabled:opacity-40"
            style={{ background: `radial-gradient(circle at 35% 30%, #ffffff 0%, ${t.color} 55%, ${t.color} 100%)` }}>
            <span className="flex flex-col items-center">
              {talking ? <span className="eq flex h-7 items-end gap-[3px]">{[0.6, 1, 0.7, 0.9, 0.5].map((h, i) => <span key={i} style={{ height: `${h * 100}%`, background: '#05060d' }} />)}</span>
                : <Radio size={30} strokeWidth={2.4} />}
              <span className="lcd mt-0.5 text-[10px] font-bold">{talking ? (onAirHere ? 'LIVE' : `${secs}s`) : 'HOLD'}</span>
            </span>
          </button>
        </div>
        <button onClick={() => fileRef.current?.click()} disabled={disabled} className="flex w-16 flex-col items-center gap-1 text-[11px] font-semibold text-white/70 disabled:opacity-40">
          <span className="grid h-12 w-12 place-items-center rounded-full bg-white/10"><ImagePlus size={20} /></span>Photo
        </button>
        <input ref={fileRef} type="file" accept="image/*" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (f) void onImage(f).catch(() => setErr('Photo not sent.')); e.target.value = ''; }} />
      </div>
      <p className="lcd mt-2 text-center text-[10px] text-white/45">
        {keyed ? `${radio!.keyed.length} TALKING ON CH${String(t.ch).padStart(2, '0')}` : onAirHere ? 'LIVE RADIO · HOLD TO TALK, RELEASE TO LISTEN' : 'HOLD TO SEND A VOICE CLIP · GO LIVE FOR OPEN RADIO'}
      </p>
      <form onSubmit={submit} className="mt-3 flex items-center gap-2 rounded-full bg-white/8 p-1.5 pl-4">
        <label htmlFor={`m-${teamId}`} className="sr-only">Message {t.name}</label>
        <input id={`m-${teamId}`} value={text} onChange={(e) => setText(e.target.value)} disabled={disabled} placeholder={`Message ${t.name}…`}
          className="min-w-0 flex-1 bg-transparent py-2 text-[15px] placeholder:text-white/35 focus:outline-none" />
        <button disabled={disabled || !text.trim()} className="grid h-10 w-10 place-items-center rounded-full bg-[#2f45ff] disabled:opacity-40" aria-label="Send"><Send size={17} /></button>
      </form>
    </div>
  );
}

function readPref(slug: string, team: string) {
  try { return localStorage.getItem(`bs_radio_${slug}_${team}`) === '1'; } catch { return false; }
}
function writePref(slug: string, team: string, on: boolean) {
  try { localStorage.setItem(`bs_radio_${slug}_${team}`, on ? '1' : '0'); } catch { /* storage blocked */ }
}
