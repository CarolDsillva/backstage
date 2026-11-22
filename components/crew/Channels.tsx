'use client';
import { Lock, Radio } from 'lucide-react';
import type { CrewState } from '@/lib/client/useCrew';
import { TEAMS, type TeamId } from '@/lib/shared/teams';
import { Face, cx } from './bits';

/** The walkie dial: every team channel, with unread, open issues and on-air state. */
export function Channels({ state, unread, onOpen, onChangeTeam }: {
  state: CrewState; unread: Partial<Record<TeamId, number>>; onOpen: (t: TeamId) => void; onChangeTeam: () => void;
}) {
  return (
    <div className="space-y-3 px-4 pb-32">
      <div className="flex items-end justify-between px-1">
        <div>
          <h1 className="font-display text-[30px] leading-none font-extrabold tracking-tight">Channels</h1>
          <p className="mt-1 text-sm text-white/60">
            {state.me.role === 'lead' ? 'You’re the show caller: you hear every channel.' : `You’re on ${TEAMS.find((t) => t.id === state.me.team)?.name ?? 'Control'}.`}
          </p>
        </div>
        <button onClick={onChangeTeam} className="text-sm font-semibold text-[#d7ff3a]">Switch team</button>
      </div>
      <ul className="space-y-2.5">
        {TEAMS.map((t, idx) => {
          const can = state.canOpen.includes(t.id);
          const members = state.crew.filter((c) => (t.id === 'control' ? true : c.team === t.id));
          const issues = state.issues.filter((i) => i.team === t.id && i.status !== 'resolved');
          const critical = issues.some((i) => i.severity === 'critical');
          const live = state.radio.some((r) => r.team === t.id);
          const n = unread[t.id] ?? 0;
          return (
            <li key={t.id} className="slide-up" style={{ animationDelay: `${idx * 35}ms` }}>
              <button disabled={!can} onClick={() => onOpen(t.id)}
                className={cx('group relative flex w-full items-center gap-4 overflow-hidden rounded-[26px] p-4 text-left transition-transform active:scale-[.99]',
                  can ? 'glass' : 'border border-white/5 bg-white/[0.02] opacity-55')}>
                <span className="absolute inset-y-0 left-0 w-1.5" style={{ background: t.color }} aria-hidden />
                <span className="lcd grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-black/50 text-lg font-bold ring-1 ring-white/10" style={{ color: t.color }}>
                  {String(t.ch).padStart(2, '0')}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="font-display text-lg font-bold">{t.name}</span>
                    {live && <span className="lcd flex items-center gap-1 rounded-full bg-[#ff3d6e] px-2 py-0.5 text-[10px] font-bold"><Radio size={11} />ON AIR</span>}
                  </span>
                  <span className="block truncate text-[13px] text-white/55">{t.blurb}</span>
                  <span className="mt-2 flex items-center gap-3">
                    <span className="flex -space-x-2">
                      {members.slice(0, 4).map((m) => <Face key={m.userId} name={m.name} color={t.color} size={22} />)}
                    </span>
                    <span className="text-xs text-white/50">{members.length} on channel</span>
                    {issues.length > 0 && (
                      <span className={cx('rounded-full px-2 py-0.5 text-[11px] font-bold', critical ? 'bg-[#ff3d6e] text-white' : 'bg-[#ffb547]/20 text-[#ffb547]')}>
                        {issues.length} open
                      </span>
                    )}
                  </span>
                </span>
                {can ? (
                  n > 0 && <span className="grid h-7 min-w-7 place-items-center rounded-full bg-[#d7ff3a] px-2 text-xs font-extrabold text-[#05060d]">{n > 99 ? '99+' : n}</span>
                ) : <Lock size={16} className="text-white/40" aria-label="Another team's channel" />}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
