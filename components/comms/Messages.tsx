'use client';
import { useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Hand, Megaphone, Mic, Pause, Play, Radio } from 'lucide-react';
import { cardDigest, type ChatMsg } from '@/lib/client/nexconn';
import { BS_TYPES } from '@/lib/shared/types';
import { ISSUE_STATUS_LABEL } from '@/lib/shared/teams';
import { Face, SEV, clock, cx, tui } from './ui';

/** One line for chat lists, toasts and the activity feed. */
export function preview(m: ChatMsg): string {
  const c = m.content as Record<string, unknown>;
  if (m.type === 'RC:TxtMsg') return String(c.text ?? c.content ?? '');
  if (m.type === 'RC:HQVCMsg') return `🎙️ Walkie clip${c.duration ? ` · ${c.duration}s` : ''}`;
  if (m.type === 'RC:ImgMsg') return '📷 Photo';
  return cardDigest(m.type, c);
}

export function firstName(n: string) {
  return n.split(' · ')[0].split(' ')[0];
}

export function Bubble({ m, team }: { m: ChatMsg; team: string }) {
  const c = m.content as Record<string, unknown>;
  if (m.type === BS_TYPES.issue) {
    const sev = SEV[String(c.severity ?? 'normal')] ?? SEV.normal;
    return (
      <div className="mx-auto w-full max-w-sm rounded-[22px] bg-[#251856] p-4 shadow-[0_1px_0_#33236B]" style={c.severity === 'critical' ? { boxShadow: 'inset 0 0 0 2px #FF6B5B' } : undefined}>
        <div className="flex items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-full" style={{ background: sev.bg, color: sev.ink }}><AlertTriangle size={14} /></span>
          <span className="text-xs font-bold uppercase tracking-wide" style={{ color: c.severity === 'critical' ? '#FF9A8F' : '#B8ABE6' }}>{sev.label} issue</span>
          <span className="ml-auto text-[11px] text-[#8C7FC0]">{clock(m.sentAt)}</span>
        </div>
        <p className="mt-2 font-display text-lg leading-snug font-bold text-white">{String(c.title ?? '')}</p>
        {c.note ? <p className="mt-0.5 text-sm text-[#CFC4F5]">{String(c.note)}</p> : null}
        <p className="mt-2 text-xs text-[#B8ABE6]">{c.placeName ? `📍 ${String(c.placeName)} · ` : ''}raised by {String(c.reporterName ?? 'crew')}</p>
      </div>
    );
  }
  if (m.type === BS_TYPES.issueUpdate) {
    const fixed = c.action === 'fix';
    return (
      <p className="mx-auto flex w-fit max-w-full items-center gap-1.5 rounded-full bg-white/[0.06] px-3 py-1.5 text-xs text-[#CFC4F5]">
        {fixed ? <CheckCircle2 size={13} className="shrink-0 text-[#5EE6C0]" /> : <Hand size={13} className="shrink-0 text-[#FFCB5C]" />}
        <span className="truncate"><b className="text-white">{firstName(String(c.by ?? 'Someone'))}</b>{fixed ? ' fixed ' : c.action === 'take' ? ' is on ' : ' reopened '}“{String(c.title ?? '')}”</span>
        <span className="shrink-0 font-semibold">· {ISSUE_STATUS_LABEL[String(c.status)] ?? ''}</span>
      </p>
    );
  }
  if (m.type === BS_TYPES.radio) {
    return (
      <p className="mx-auto flex w-fit items-center gap-1.5 rounded-full bg-[#7C4DFF] px-3 py-1.5 text-[11px] font-bold text-white">
        <Radio size={12} />{c.live ? `Open line started by ${firstName(String(c.by ?? ''))}` : 'Open line closed'}
      </p>
    );
  }
  if (m.type === BS_TYPES.announce) {
    return (
      <div className="mx-auto w-full max-w-sm rounded-[22px] bg-[#7C4DFF] p-4 text-white">
        <p className="flex items-center gap-1.5 text-[11px] font-bold tracking-wide text-[#FF9CCB] uppercase"><Megaphone size={13} />All hands · {firstName(String(c.by ?? 'Show caller'))}</p>
        <p className="mt-1 font-display text-lg leading-snug font-bold">{String(c.text ?? '')}</p>
      </div>
    );
  }
  let body: React.ReactNode;
  if (m.type === 'RC:HQVCMsg') body = <VoiceClip url={String(c.remoteUrl ?? '')} secs={Number(c.duration ?? 0)} mine={m.mine} />;
  else if (m.type === 'RC:ImgMsg') {
    const thumb = c.thumbnailBase64 ?? c.content;
    const src = String(c.remoteUrl || c.imageUri || (thumb ? `data:image/jpeg;base64,${thumb}` : ''));
    // eslint-disable-next-line @next/next/no-img-element
    body = <a href={src} target="_blank" rel="noreferrer"><img src={src} alt="Photo shared in the channel" className="-mx-1 mt-0.5 max-h-60 w-full rounded-2xl object-cover" /></a>;
  } else body = <p className="whitespace-pre-wrap break-words">{String(c.text ?? c.content ?? '')}</p>;
  const u = tui(team);
  return (
    <div className={cx('flex items-end gap-2', m.mine ? 'justify-end' : 'justify-start')}>
      {!m.mine && <Face name={m.senderName} size={30} />}
      <div className={cx('max-w-[80%] rounded-[22px] px-3.5 py-2.5 text-[15px] leading-snug', m.mine ? 'rounded-br-md bg-[#EC4F9B] text-white' : 'rounded-bl-md bg-[#251856] text-white')}>
        {!m.mine && <p className="mb-0.5 text-xs font-bold" style={{ color: team === 'control' ? '#FF8CC6' : u.ink }}>{m.senderName}</p>}
        {body}
        <p className={cx('mt-0.5 text-right text-[10px]', m.mine ? 'text-white/75' : 'text-[#8C7FC0]')}>{clock(m.sentAt)}</p>
      </div>
    </div>
  );
}

export function VoiceClip({ url, secs, mine, autoPlay }: { url: string; secs: number; mine: boolean; autoPlay?: boolean }) {
  const [playing, setPlaying] = useState(false);
  const ref = useRef<HTMLAudioElement | null>(null);
  function toggle() {
    if (!url) return;
    ref.current ??= new Audio(url);
    const a = ref.current;
    a.onended = () => setPlaying(false);
    if (playing) { a.pause(); setPlaying(false); } else { void a.play().then(() => setPlaying(true)).catch(() => setPlaying(false)); }
  }
  void autoPlay;
  return (
    <button onClick={toggle} className="flex items-center gap-2.5 py-0.5" aria-label={playing ? 'Pause walkie clip' : 'Play walkie clip'}>
      <span className={cx('grid h-9 w-9 place-items-center rounded-full', mine ? 'bg-[#251856] text-[#EC4F9B]' : 'bg-[#7C4DFF] text-white')}>
        {playing ? <Pause size={15} /> : <Play size={15} className="translate-x-px" />}
      </span>
      <span className={cx('eq flex h-6 items-end gap-[3px]', !playing && '[&>span]:[animation-play-state:paused]')}>
        {[0.45, 0.9, 0.6, 1, 0.7, 0.5, 0.8].map((h, i) => <span key={i} style={{ height: `${h * 100}%`, background: 'currentColor', opacity: 0.8 }} />)}
      </span>
      <span className="flex items-center gap-1 text-xs opacity-80"><Mic size={12} />{secs ? `${secs}s` : 'clip'}</span>
    </button>
  );
}
