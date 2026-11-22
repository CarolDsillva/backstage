'use client';
import { useState } from 'react';
import { Bell, BellRing, CheckCircle2, Hand, MapPin, Megaphone } from 'lucide-react';
import { crewPost, type CrewState, type FeedItem } from '@/lib/client/useCrew';
import { BS_TYPES, type Incident } from '@/lib/shared/types';
import { team as teamOf, type TeamId } from '@/lib/shared/teams';
import { preview, firstName } from './Messages';
import { Face, SEV, TeamBadge, ago, cx, tui } from './ui';

/** Home tab: what needs attention right now. Big numbers, then the issues, then everything else. */
export function Alerts({ state, feed, now, slug, viewer, notif, onEnableNotif, onOpenChat, onChanged, onIssueAction, tourIssueId }: {
  state: CrewState; feed: FeedItem[]; now: number; slug: string; viewer: boolean;
  notif: NotificationPermission | 'unsupported'; onEnableNotif: () => void;
  onOpenChat: (t: TeamId) => void; onChanged: () => void; onIssueAction?: (a: 'take' | 'fix', i: Incident) => void; tourIssueId?: string | null;
}) {
  const open = state.issues.filter((i) => i.status !== 'resolved');
  const order = (i: Incident) => (i.severity === 'critical' ? 0 : i.severity === 'urgent' ? 1 : 2) * 10 + (i.status === 'new' ? 0 : 1);
  open.sort((a, b) => order(a) - order(b) || +new Date(b.createdAt) - +new Date(a.createdAt));
  const critical = open.filter((i) => i.severity === 'critical').length;
  const fixed = state.issues.filter((i) => i.status === 'resolved').length;
  const announcements = feed.filter((f) => f.type === BS_TYPES.announce).slice(0, 1);
  const activity = feed.filter((f) => f.type !== BS_TYPES.state).slice(0, 12);
  const firstCriticalNew = open.find((i) => i.severity === 'critical' && i.status === 'new');

  return (
    <div className="space-y-5 px-4 pt-2 pb-32">
      {/* Big numbers */}
      <section data-tour="stats" className="glass-card overflow-hidden rounded-[32px] p-4" aria-label="Right now">
        <Orbit state={state} onOpenChat={onOpenChat} />
        <div className="mt-1 flex items-end justify-between px-1">
          <div>
            <p className="font-display text-[44px] leading-none font-extrabold">{open.length}</p>
            <p className="text-sm text-[#B8ABE6]">Open issues</p>
          </div>
          <div className="text-right">
            <p className="font-display text-[28px] leading-none font-extrabold">{state.canOpen.length}<span className="text-lg text-[#B8ABE6]"> teams</span></p>
            <p className="text-sm text-[#B8ABE6]">{state.crew.length} crew on the radio</p>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2.5">
          <div className="rounded-[22px] p-3.5" style={{ background: critical ? 'linear-gradient(135deg,#FF6B5B,#E0356E)' : 'rgba(255,255,255,.06)' }}>
            <p className="text-xs font-semibold opacity-85">Critical</p>
            <p className="font-display text-[30px] leading-none font-extrabold">{critical}</p>
          </div>
          <div className="rounded-[22px] bg-white/[0.06] p-3.5">
            <p className="text-xs font-semibold text-[#B8ABE6]">Fixed tonight</p>
            <p className="font-display text-[30px] leading-none font-extrabold text-[#5EE6C0]">{fixed}</p>
          </div>
        </div>
      </section>

      {!viewer && notif !== 'granted' && notif !== 'unsupported' && (
        <button onClick={onEnableNotif} className="flex w-full items-center gap-3 rounded-[22px] bg-[#251856] p-4 text-left">
          <span className="grid h-10 w-10 place-items-center rounded-full bg-[#7C4DFF] text-white"><Bell size={18} /></span>
          <span className="flex-1"><b className="block text-[15px]">Turn on alerts</b><span className="text-sm text-[#B8ABE6]">Get a ping for critical issues, even when this tab is in the background.</span></span>
        </button>
      )}
      {notif === 'granted' && <p className="flex items-center gap-1.5 px-1 text-xs font-semibold text-[#5EE6C0]"><BellRing size={13} />Alerts are on for this device</p>}

      {announcements.map((a) => (
        <button key={a.id} onClick={() => onOpenChat('control')} className="block w-full rounded-[24px] bg-[#7C4DFF] p-4 text-left text-white">
          <p className="flex items-center gap-1.5 text-[11px] font-bold tracking-[0.12em] text-[#FF9CCB] uppercase"><Megaphone size={13} />Latest call · {firstName(String((a.content as { by?: string }).by ?? 'Show caller'))} · {ago(a.sentAt, now)}</p>
          <p className="mt-1 font-display text-xl leading-snug font-bold">{String((a.content as { text?: string }).text ?? '')}</p>
        </button>
      ))}

      <section aria-label="Needs attention">
        <SectionTitle title="Needs attention" sub={open.length ? `${open.length} open` : 'nothing open'} />
        {open.length === 0 ? (
          <p className="rounded-[22px] bg-[#251856] p-5 text-center text-sm text-[#B8ABE6]">No open issues. When a team raises one it shows up here first.</p>
        ) : (
          <ul className="space-y-2.5">
            {open.slice(0, 8).map((i) => (
              <IssueCard key={i.id} i={i} now={now} slug={slug} viewer={viewer} canAct={state.canOpen.includes((i.team ?? 'control') as TeamId)}
                place={state.places.find((p) => p.id === i.placeId)?.name} tour={tourIssueId ? i.id === tourIssueId : i === firstCriticalNew}
                onOpen={() => onOpenChat((i.team ?? 'control') as TeamId)} onChanged={onChanged} onAction={onIssueAction} />
            ))}
          </ul>
        )}
      </section>

      <section aria-label="Activity">
        <SectionTitle title="Across the event" sub="latest first" />
        <ul className="overflow-hidden rounded-[24px] bg-[#251856]">
          {activity.length === 0 && <li className="p-5 text-center text-sm text-[#B8ABE6]">Loading the chatter…</li>}
          {activity.map((f) => (
            <li key={f.id} className="border-b border-[#33236B] last:border-0">
              <button onClick={() => onOpenChat(f.team)} className="flex w-full items-center gap-3 px-4 py-3 text-left">
                <TeamBadge team={f.team} size={36} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5 text-xs text-[#B8ABE6]"><b className="text-white">{teamOf(f.team).name}</b>· {f.senderId === 'backstagebot' ? 'Backstage' : firstName(f.senderName)}</span>
                  <span className="block truncate text-[14px]">{preview(f)}</span>
                </span>
                <span className="shrink-0 text-[11px] text-[#8C7FC0]">{ago(f.sentAt, now)}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      {state.event.refs?.sets?.length ? (
        <section aria-label="Tonight">
          <SectionTitle title="Tonight" sub={state.event.refs.doors ? `doors ${state.event.refs.doors}` : ''} />
          <ol className="flex gap-2.5 overflow-x-auto pb-1">
            {state.event.refs.sets.map((s) => (
              <li key={s.time + s.name} className="w-44 shrink-0 rounded-[22px] bg-[#2E2470] p-4 text-[#B7AEFF]">
                <p className="font-display text-xl font-extrabold">{s.time}</p>
                <p className="mt-0.5 text-sm leading-snug font-semibold text-[#DCD7FF]">{s.name}</p>
              </li>
            ))}
          </ol>
        </section>
      ) : null}
    </div>
  );
}

function Stat({ label, value, bg, ink }: { label: string; value: number; bg: string; ink: string }) {
  return (
    <div className="rounded-[24px] p-4" style={{ background: bg, color: ink }}>
      <p className="text-sm font-semibold opacity-85">{label}</p>
      <p className="font-display text-[40px] leading-none font-extrabold">{value}</p>
    </div>
  );
}

export function SectionTitle({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="mb-2.5 flex items-end justify-between px-1">
      <h2 className="font-display text-[22px] font-extrabold tracking-tight">{title}</h2>
      {sub && <span className="text-xs font-medium text-[#8C7FC0]">{sub}</span>}
    </div>
  );
}

export function IssueCard({ i, now, slug, viewer, canAct, place, tour, onOpen, onChanged, onAction }: {
  i: Incident; now: number; slug: string; viewer: boolean; canAct: boolean; place?: string; tour?: boolean;
  onOpen: () => void; onChanged: () => void; onAction?: (a: 'take' | 'fix', i: Incident) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const sev = SEV[i.severity ?? 'normal'] ?? SEV.normal;
  async function act(action: 'take' | 'fix') {
    setBusy(true); setErr('');
    try { await crewPost(`/api/crew/${slug}/issues/${i.id}`, { action }, 'PATCH'); onAction?.(action, i); onChanged(); }
    catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }
  const u = tui(i.team);
  return (
    <li className="rounded-[24px] bg-[#251856] p-4" style={i.severity === 'critical' ? { boxShadow: 'inset 0 0 0 2px #FF6B5B' } : undefined}>
      <button onClick={onOpen} className="flex w-full items-start gap-3 text-left">
        <TeamBadge team={i.team ?? 'control'} size={42} />
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-1.5">
            <span className="rounded-full px-2 py-0.5 text-[11px] font-bold" style={{ background: sev.bg, color: sev.ink }}>{sev.label}</span>
            <span className="text-xs font-semibold" style={{ color: i.team === 'control' ? '#7C4DFF' : u.ink }}>{teamOf(i.team).name}</span>
            <span className="text-xs text-[#8C7FC0]">· {ago(i.createdAt, now)}</span>
          </span>
          <span className="mt-1 block font-display text-[17px] leading-snug font-bold">{i.title ?? i.note}</span>
          <span className="mt-1 flex items-center gap-2 text-xs text-[#B8ABE6]">
            {place && <span className="flex items-center gap-0.5"><MapPin size={12} />{place}</span>}
            {i.status === 'new' ? <span>Raised by {firstName(i.reporterName)}</span> : <span className="flex items-center gap-1"><Face name={i.assigneeName ?? 'Someone'} size={16} />{firstName(i.assigneeName ?? 'Someone')} is on it</span>}
          </span>
        </span>
      </button>
      {!viewer && canAct && (
        <div className="mt-3 flex gap-2">
          {i.status === 'new' && (
            <button data-tour={tour ? 'take' : undefined} onClick={() => act('take')} disabled={busy}
              className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-full bg-[#7C4DFF] text-sm font-bold text-white disabled:opacity-50"><Hand size={15} />I’m on it</button>
          )}
          <button data-tour={tour && i.status !== 'new' ? 'fix' : undefined} data-issue={i.id} onClick={() => act('fix')} disabled={busy}
            className={cx('flex h-11 flex-1 items-center justify-center gap-1.5 rounded-full text-sm font-bold disabled:opacity-50', i.status === 'new' ? 'bg-[#33236B] text-white' : 'bg-[#123F3E] text-[#5EE6C0]')}><CheckCircle2 size={15} />Fixed</button>
        </div>
      )}
      {err && <p role="alert" className="mt-2 text-xs font-semibold text-[#FF9A8F]">{err}</p>}
    </li>
  );
}

/** The event as a glowing orb with each team orbiting it. Teams with open issues light up. */
function Orbit({ state, onOpenChat }: { state: CrewState; onOpenChat: (t: TeamId) => void }) {
  const teams = state.canOpen;
  const hot = new Map<string, string>();
  for (const i of state.issues) {
    if (i.status === 'resolved' || !i.team) continue;
    const cur = hot.get(i.team);
    if (i.severity === 'critical' || !cur) hot.set(i.team, i.severity ?? 'normal');
  }
  const R = [62, 98];
  return (
    <div className="relative mx-auto h-[230px] w-[230px]">
      {R.map((r) => <span key={r} className="absolute rounded-full border border-white/12" style={{ width: r * 2, height: r * 2, left: 115 - r, top: 115 - r }} aria-hidden />)}
      <span className="orb absolute top-1/2 left-1/2 h-[68px] w-[68px] -translate-x-1/2 -translate-y-1/2 rounded-full" aria-hidden />
      <div className="orbit-spin absolute inset-0">
        {teams.map((t, k) => {
          const ring = R[k % 2];
          const ang = (k / teams.length) * Math.PI * 2 - Math.PI / 2;
          const x = 115 + ring * Math.cos(ang);
          const y = 115 + ring * Math.sin(ang);
          const sev = hot.get(t);
          const size = sev ? 22 : 13;
          const col = sev === 'critical' ? '#FF6B5B' : sev === 'urgent' ? '#FFCB5C' : sev ? '#B7AEFF' : '#FFFFFF';
          return (
            <button key={t} onClick={() => onOpenChat(t)} aria-label={`${teamOf(t).name}${sev ? `: ${sev} issue open` : ''}`}
              className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: x, top: y }}>
              <span className="orbit-spin-rev relative grid place-items-center">
                {sev && <span className="ring-out absolute rounded-full" style={{ width: size, height: size, background: col }} />}
                <span className="relative block rounded-full" style={{ width: size, height: size, background: col, boxShadow: `0 0 ${sev ? 16 : 6}px ${col}` }} />
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
