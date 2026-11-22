'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, ArrowLeft, Eye, ImagePlus, Inbox as InboxIcon, Mic, Plus, Radio, Send, X } from 'lucide-react';
import { useRoom } from '@/lib/client/useRoom';
import { useRecorder } from '@/lib/client/recorder';
import type { CrewState, FeedItem } from '@/lib/client/useCrew';
import { BS_TYPES } from '@/lib/shared/types';
import { TEAMS, team as teamOf, type TeamId } from '@/lib/shared/teams';
import { Bubble, firstName, preview } from './Messages';
import { Face, TeamBadge, ago, cx, tui } from './ui';

const APP_KEY = process.env.NEXT_PUBLIC_NEXCONN_APP_KEY ?? '';

/** Chat list, like a messenger: one row per team channel, latest line, unread count, open-issue dot. */
export function ChatList({ state, feed, unread, now, onOpen, onInbox }: {
  state: CrewState; feed: FeedItem[]; unread: Partial<Record<TeamId, number>>; now: number;
  onOpen: (t: TeamId) => void; onInbox: () => void;
}) {
  const last = useMemo(() => {
    const m = new Map<string, FeedItem>();
    for (const f of feed) if (!m.has(f.team) && f.type !== BS_TYPES.state) m.set(f.team, f);
    return m;
  }, [feed]);
  const rows = TEAMS.filter((t) => state.canOpen.includes(t.id))
    .sort((a, b) => (last.get(b.id)?.sentAt ?? 0) - (last.get(a.id)?.sentAt ?? 0));
  return (
    <div className="px-4 pt-2 pb-32">
      <ul className="overflow-hidden rounded-[28px] bg-[#251856]">
        {rows.map((t) => {
          const l = last.get(t.id);
          const n = unread[t.id] ?? 0;
          const hot = state.issues.some((i) => i.team === t.id && i.status !== 'resolved' && i.severity === 'critical');
          const members = state.crew.filter((c) => t.id === 'control' || c.team === t.id).length;
          return (
            <li key={t.id} className="border-b border-[#33236B] last:border-0">
              <button data-tour={`chat-${t.id}`} onClick={() => onOpen(t.id)} className="flex w-full items-center gap-3 px-4 py-3.5 text-left active:bg-[#2C1D63]">
                <span className="relative">
                  <TeamBadge team={t.id} size={52} />
                  {hot && <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-[#FF6B5B] ring-[3px] ring-[#160B36]" aria-label="Critical issue open" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="truncate font-display text-[17px] font-bold">{t.name}</span>
                    <span className={cx('shrink-0 text-[11px]', n ? 'font-bold text-[#EC4F9B]' : 'text-[#8C7FC0]')}>{l ? ago(l.sentAt, now) : ''}</span>
                  </span>
                  <span className="mt-0.5 flex items-center justify-between gap-2">
                    <span className={cx('truncate text-sm', n ? 'font-semibold text-white' : 'text-[#B8ABE6]')}>
                      {l ? <>{l.senderId !== 'backstagebot' && <b className="font-semibold">{l.mine ? 'You' : firstName(l.senderName)}: </b>}{preview(l)}</> : <span>{members} people · {t.blurb}</span>}
                    </span>
                    {n > 0 && <span className="grid h-5 min-w-5 shrink-0 place-items-center rounded-full bg-[#EC4F9B] px-1.5 text-[11px] font-bold text-white">{n > 99 ? '99+' : n}</span>}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <button onClick={onInbox} className="mt-3 flex w-full items-center gap-3 rounded-[22px] bg-[#2E2470] p-4 text-left text-[#DCD7FF]">
        <span className="grid h-10 w-10 place-items-center rounded-full bg-[#251856]"><InboxIcon size={18} /></span>
        <span className="flex-1"><b className="block text-[15px]">Classic inbox</b><span className="text-sm opacity-80">Every conversation in the Nexconn Chat UI kit</span></span>
      </button>
    </div>
  );
}

/** One team's conversation. Photo, voice clip (hold the mic), text, and raise-an-issue from the + menu. */
export function ChatView({ state, teamId, slug, viewer, onBack, onRaise, onWalkie, onSent }: {
  state: CrewState; teamId: TeamId; slug: string; viewer: boolean;
  onBack: () => void; onRaise: () => void; onWalkie: () => void; onSent?: (kind: 'text' | 'voice' | 'image') => void;
}) {
  const t = teamOf(teamId);
  const u = tui(teamId);
  const channelId = state.channels[teamId] ?? null;
  const me = useMemo(() => ({ userId: state.me.userId, name: state.me.name, appKey: APP_KEY, setup: { call: true, chatUI: true } }), [state.me.userId, state.me.name]);
  const room = useRoom(channelId, me, slug);
  const members = state.crew.filter((c) => teamId === 'control' || c.team === teamId || c.role === 'lead');
  const openIssues = state.issues.filter((i) => i.team === teamId && i.status !== 'resolved').length;
  const listRef = useRef<HTMLDivElement>(null);
  const [text, setText] = useState('');
  const [menu, setMenu] = useState(false);
  const [err, setErr] = useState('');
  const [sending, setSending] = useState<string | null>(null);
  const rec = useRecorder();
  const fileRef = useRef<HTMLInputElement>(null);
  const disabled = room.status !== 'online' || !channelId;

  useEffect(() => { const el = listRef.current; if (el) el.scrollTop = el.scrollHeight; }, [room.messages.length, sending]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const v = text.trim();
    if (!v) return;
    setText(''); setErr('');
    try { await room.sendText(v); onSent?.('text'); } catch { setText(v); setErr('Not sent. Check your connection and try again.'); }
  }
  async function sendPhoto(f: File) {
    setMenu(false); setErr(''); setSending('Sending photo…');
    try { await room.sendImage(f); onSent?.('image'); } catch { setErr('Photo not sent. Try a smaller image.'); } finally { setSending(null); }
  }
  async function release() {
    const f = await rec.stop();
    if (!f) return;
    setSending('Sending clip…');
    try { await room.sendVoice(f); onSent?.('voice'); } catch (x) { setErr((x as Error).message); } finally { setSending(null); }
  }

  return (
    <div className="fixed inset-0 z-40 mx-auto flex max-w-[480px] flex-col bg-[#160B36] text-white">
      <header className="flex items-center gap-3 bg-[#160B36]/80 px-3 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 backdrop-blur">
        <button onClick={onBack} className="grid h-11 w-11 place-items-center rounded-full bg-[#251856]" aria-label="Back to chats"><ArrowLeft size={20} /></button>
        <TeamBadge team={teamId} size={42} />
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-display text-[19px] leading-tight font-extrabold">{t.name}</h1>
          <p className="truncate text-xs text-[#B8ABE6]">{members.length} people{openIssues ? ` · ${openIssues} open issue${openIssues > 1 ? 's' : ''}` : ''}</p>
        </div>
        <button data-tour="to-walkie" onClick={onWalkie} className="flex h-11 items-center gap-1.5 rounded-full bg-[#7C4DFF] px-4 text-sm font-bold text-white" aria-label={`Open the walkie on ${t.name}`}>
          <Radio size={16} />Walkie
        </button>
      </header>
      <div className="flex gap-1.5 overflow-x-auto px-4 pb-2">
        {members.slice(0, 8).map((m) => (
          <span key={m.userId} className="flex shrink-0 items-center gap-1.5 rounded-full bg-[#251856] py-1 pr-3 pl-1 text-xs font-semibold"><Face name={m.name} size={22} />{firstName(m.name)}</span>
        ))}
      </div>

      <div ref={listRef} className="min-h-0 flex-1 space-y-2.5 overflow-y-auto px-3 py-3" aria-live="polite">
        {room.loading && room.messages.length === 0 && <p className="pt-10 text-center text-sm text-[#8C7FC0]">Loading messages…</p>}
        {!room.loading && room.messages.length === 0 && (
          <p className="mx-auto mt-8 max-w-xs rounded-[22px] bg-[#251856] p-5 text-center text-sm text-[#B8ABE6]">Nothing on {t.name} yet. Say hi, or hold the mic to send a walkie clip.</p>
        )}
        {room.messages.map((m) => <Bubble key={m.id} m={m} team={teamId} />)}
        {sending && <p className="ml-auto w-fit rounded-full bg-[#EC4F9B]/15 px-3 py-1.5 text-xs font-semibold text-[#FF8CC6]">{sending}</p>}
      </div>

      {viewer ? (
        <div className="flex items-center gap-2 bg-[#7C4DFF] px-5 pt-3.5 pb-[max(1rem,env(safe-area-inset-bottom))] text-sm text-white/80">
          <Eye size={16} className="text-[#FF9CCB]" />You’re watching as a guest. Crew members can post here.
        </div>
      ) : (
        <div className="px-3 pt-2 pb-[max(0.8rem,env(safe-area-inset-bottom))]">
          {(err || rec.error) && <p role="alert" className="mb-2 text-center text-xs font-semibold text-[#FF9A8F]">{err || rec.error}</p>}
          {menu && (
            <div className="slide-up mb-2 grid grid-cols-2 gap-2">
              <button onClick={() => fileRef.current?.click()} className="flex items-center gap-2 rounded-[18px] bg-[#251856] p-3 text-sm font-semibold"><span className="grid h-9 w-9 place-items-center rounded-full bg-[#123F3E] text-[#5EE6C0]"><ImagePlus size={17} /></span>Photo</button>
              <button onClick={() => { setMenu(false); onRaise(); }} className="flex items-center gap-2 rounded-[18px] bg-[#251856] p-3 text-sm font-semibold"><span className="grid h-9 w-9 place-items-center rounded-full bg-[#4A1D3F] text-[#FF9A8F]"><AlertTriangle size={17} /></span>Raise issue</button>
            </div>
          )}
          <input ref={fileRef} type="file" accept="image/*" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (f) void sendPhoto(f); e.target.value = ''; }} />
          {rec.recording ? (
            <div className="flex h-14 items-center gap-3 rounded-full bg-[#7C4DFF] px-5 text-white">
              <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-[#FF6B5B]" />
              <span className="flex-1 text-sm font-semibold">Recording for {t.name}… {rec.secs}s</span>
              <span className="text-xs text-white/60">release to send</span>
            </div>
          ) : (
            <form onSubmit={submit} className="flex items-center gap-2">
              <button type="button" onClick={() => setMenu((v) => !v)} aria-label={menu ? 'Close menu' : 'Photo or issue'} aria-expanded={menu}
                className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-[#251856]">{menu ? <X size={20} /> : <Plus size={22} />}</button>
              <label htmlFor="composer" className="sr-only">Message {t.name}</label>
              <input id="composer" data-tour="composer" value={text} onChange={(e) => setText(e.target.value)} disabled={disabled}
                placeholder={disabled ? 'Connecting…' : `Message ${t.name}`} autoComplete="off"
                className="h-12 min-w-0 flex-1 rounded-full bg-[#251856] px-4 text-[15px] placeholder:text-[#7D6FB5] focus:outline-none focus:ring-2 focus:ring-[#EC4F9B]" />
              {text.trim() ? (
                <button data-tour="send" disabled={disabled} className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-[#EC4F9B] text-white disabled:opacity-40" aria-label="Send"><Send size={19} /></button>
              ) : (
                <button type="button" disabled={disabled}
                  onPointerDown={(e) => { e.preventDefault(); (e.target as HTMLElement).setPointerCapture?.(e.pointerId); void rec.start(); }}
                  onPointerUp={() => void release()} onPointerCancel={() => void release()} onContextMenu={(e) => e.preventDefault()}
                  className="grid h-12 w-12 shrink-0 touch-none place-items-center rounded-full bg-[#7C4DFF] text-white disabled:opacity-40" aria-label="Hold to record a walkie clip">
                  <Mic size={19} />
                </button>
              )}
            </form>
          )}
          <p className="mt-1.5 text-center text-[11px] text-[#8C7FC0]" style={{ color: u.ink === '#FFFFFF' ? undefined : undefined }}>Hold the mic to send a voice clip</p>
        </div>
      )}
    </div>
  );
}
