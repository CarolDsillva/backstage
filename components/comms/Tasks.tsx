'use client';
import { useState } from 'react';
import { CheckCircle2, ChevronDown, Hand, MapPin } from 'lucide-react';
import { crewPost, type CrewState } from '@/lib/client/useCrew';
import type { Incident } from '@/lib/shared/types';
import { team as teamOf, type TeamId } from '@/lib/shared/teams';
import { firstName } from './Messages';
import { Face, SEV, TeamBadge, ago, cx } from './ui';

type Filter = 'all' | 'mine' | 'free';

/** Every open task and who is working on what. One tap to take or close one. */
export function Tasks({ state, now, slug, viewer, onOpenChat, onChanged, onIssueAction, tourIssueId }: {
  state: CrewState; now: number; slug: string; viewer: boolean; tourIssueId?: string | null;
  onOpenChat: (t: TeamId) => void; onChanged: () => void; onIssueAction?: (a: 'take' | 'fix', i: Incident) => void;
}) {
  const [filter, setFilter] = useState<Filter>('all');
  const [showDone, setShowDone] = useState(false);
  const me = state.me.userId;
  const sevRank = (i: Incident) => (i.severity === 'critical' ? 0 : i.severity === 'urgent' ? 1 : 2);
  const open = state.issues.filter((i) => i.status !== 'resolved').sort((a, b) => sevRank(a) - sevRank(b) || +new Date(a.createdAt) - +new Date(b.createdAt));
  const free = open.filter((i) => i.status === 'new');
  const taken = open.filter((i) => i.status !== 'new');
  const done = state.issues.filter((i) => i.status === 'resolved');
  const mine = taken.filter((i) => i.assigneeId === me);

  // Group in-progress tasks by the person doing them.
  const people = new Map<string, { name: string; tasks: Incident[] }>();
  for (const i of filter === 'mine' ? mine : taken) {
    const k = i.assigneeId ?? 'someone';
    const p = people.get(k) ?? { name: i.assigneeName ?? 'Someone', tasks: [] };
    p.tasks.push(i);
    people.set(k, p);
  }

  return (
    <div className="px-5 pb-36">
      <div className="grid grid-cols-3 gap-2.5">
        <Count n={free.length} label="Need someone" tone={free.length ? '#FF6B5B' : undefined} />
        <Count n={taken.length} label="In progress" tone="#7C4DFF" />
        <Count n={done.length} label="Done tonight" tone="#123F3E" ink="#5EE6C0" />
      </div>

      <div className="mt-4 flex gap-2" role="tablist" aria-label="Show">
        {([['all', 'Everything'], ['mine', `Mine${mine.length ? ` · ${mine.length}` : ''}`], ['free', 'Unassigned']] as [Filter, string][]).map(([k, l]) => (
          <button key={k} role="tab" aria-selected={filter === k} onClick={() => setFilter(k)}
            className={cx('h-9 rounded-full px-4 text-sm font-semibold', filter === k ? 'bg-white text-[#160B36]' : 'bg-white/[0.07] text-[#CFC4F5]')}>{l}</button>
        ))}
      </div>

      {filter !== 'mine' && (
        <section className="mt-7" aria-label="Needs someone">
          <H title="Needs someone" n={free.length} />
          {free.length === 0 ? <Empty text="Nothing unassigned. Every open task has an owner." /> : (
            <ul className="space-y-3">
              {free.map((i) => <Row key={i.id} i={i} now={now} slug={slug} state={state} viewer={viewer} onOpenChat={onOpenChat} onChanged={onChanged} onIssueAction={onIssueAction} />)}
            </ul>
          )}
        </section>
      )}

      {filter !== 'free' && (
        <section className="mt-8" aria-label="Who is on what">
          <H title="Who’s on what" n={filter === 'mine' ? mine.length : taken.length} />
          {people.size === 0 ? <Empty text={filter === 'mine' ? 'You haven’t taken anything yet. Tap “I’ll take it” on a task.' : 'Nobody is working on anything right now.'} /> : (
            <ul className="space-y-3">
              {[...people.entries()].map(([id, p]) => (
                <li key={id} className="rounded-[24px] bg-[#251856] p-3.5">
                  <div className="flex items-center gap-2.5">
                    <Face name={p.name} size={34} />
                    <p className="flex-1 font-display text-[17px] font-bold">{id === me ? 'You' : /^(You|Guest) · /.test(p.name) ? 'Guest' : firstName(p.name)}</p>
                    <span className="rounded-full bg-white/[0.08] px-2.5 py-1 text-xs font-semibold text-[#CFC4F5]">{p.tasks.length} task{p.tasks.length > 1 ? 's' : ''}</span>
                  </div>
                  <ul className="mt-2.5 space-y-2">
                    {p.tasks.map((i) => <Row key={i.id} i={i} now={now} slug={slug} state={state} viewer={viewer} compact tour={i.id === tourIssueId} onOpenChat={onOpenChat} onChanged={onChanged} onIssueAction={onIssueAction} />)}
                  </ul>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {filter === 'all' && done.length > 0 && (
        <section className="mt-6">
          <button onClick={() => setShowDone((v) => !v)} aria-expanded={showDone} className="flex w-full items-center justify-between px-1">
            <span className="font-display text-[20px] font-extrabold">Done tonight <span className="text-[#8C7FC0]">· {done.length}</span></span>
            <ChevronDown size={20} className={cx('transition-transform', showDone && 'rotate-180')} />
          </button>
          {showDone && (
            <ul className="mt-2 space-y-1.5">
              {done.map((i) => (
                <li key={i.id} className="flex items-center gap-2.5 rounded-[18px] bg-white/[0.05] px-3 py-2.5 text-sm">
                  <CheckCircle2 size={16} className="shrink-0 text-[#5EE6C0]" />
                  <span className="min-w-0 flex-1 truncate text-[#CFC4F5] line-through decoration-white/30">{i.title ?? i.note}</span>
                  <span className="shrink-0 text-xs text-[#8C7FC0]">{firstName(i.assigneeName ?? '')}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}

function Count({ n, label, tone, ink }: { n: number; label: string; tone?: string; ink?: string }) {
  return (
    <div className="rounded-[22px] p-3.5" style={{ background: tone ?? 'rgba(255,255,255,.06)', color: ink ?? '#fff' }}>
      <p className="font-display text-[30px] leading-none font-extrabold">{n}</p>
      <p className="mt-1 text-xs font-semibold opacity-85">{label}</p>
    </div>
  );
}
function H({ title, n }: { title: string; n: number }) {
  return <h2 className="mb-2.5 px-1 font-display text-[20px] font-extrabold">{title} <span className="text-[#8C7FC0]">· {n}</span></h2>;
}
function Empty({ text }: { text: string }) {
  return <p className="rounded-[20px] bg-white/[0.05] p-4 text-center text-sm text-[#B8ABE6]">{text}</p>;
}

function Row({ i, now, slug, state, viewer, compact, tour, onOpenChat, onChanged, onIssueAction }: {
  i: Incident; now: number; slug: string; state: CrewState; viewer: boolean; compact?: boolean; tour?: boolean;
  onOpenChat: (t: TeamId) => void; onChanged: () => void; onIssueAction?: (a: 'take' | 'fix', i: Incident) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const sev = SEV[i.severity ?? 'normal'] ?? SEV.normal;
  const canAct = !viewer && state.canOpen.includes((i.team ?? 'control') as TeamId);
  const place = state.places.find((p) => p.id === i.placeId)?.name;
  async function act(action: 'take' | 'fix') {
    setBusy(true); setErr('');
    try { await crewPost(`/api/crew/${slug}/issues/${i.id}`, { action }, 'PATCH'); onIssueAction?.(action, i); onChanged(); }
    catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }
  return (
    <li className={cx('rounded-[20px]', compact ? 'bg-white/[0.05] p-3' : 'bg-[#251856] p-3.5')} style={i.severity === 'critical' ? { boxShadow: 'inset 0 0 0 2px #FF6B5B' } : undefined}>
      <div className="flex items-start gap-3">
        <button onClick={() => onOpenChat((i.team ?? 'control') as TeamId)} aria-label={`Open ${teamOf(i.team).name} chat`}><TeamBadge team={i.team ?? 'control'} size={compact ? 34 : 40} /></button>
        <div className="min-w-0 flex-1">
          <p className="font-semibold leading-snug">{i.title ?? i.note}</p>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-[#B8ABE6]">
            <span className="rounded-full px-1.5 py-px text-[10px] font-bold" style={{ background: sev.bg, color: sev.ink }}>{sev.label}</span>
            <span>{teamOf(i.team).name}</span>
            {place && <span className="flex items-center gap-0.5"><MapPin size={11} />{place}</span>}
            <span>{i.status === 'new' ? `waiting ${ago(i.createdAt, now)}` : `opened ${ago(i.createdAt, now)} ago`}</span>
          </p>
        </div>
        {canAct && (i.status === 'new'
          ? <button onClick={() => act('take')} disabled={busy} className="flex h-9 shrink-0 items-center gap-1 rounded-full bg-[#7C4DFF] px-3 text-xs font-bold disabled:opacity-50"><Hand size={13} />I’ll take it</button>
          : <button data-tour={tour ? 'fix' : undefined} onClick={() => act('fix')} disabled={busy} className="flex h-9 shrink-0 items-center gap-1 rounded-full bg-[#123F3E] px-3 text-xs font-bold text-[#5EE6C0] disabled:opacity-50"><CheckCircle2 size={13} />Done</button>)}
      </div>
      {err && <p role="alert" className="mt-1.5 text-xs font-semibold text-[#FF9A8F]">{err}</p>}
    </li>
  );
}
