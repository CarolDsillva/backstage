'use client';
import type { EventState } from '@/lib/client/useEventState';
import { Poster } from './ui/Poster';
import { AvatarStack } from './ui/Avatar';
import { Banner } from './Banner';
import { songQueue } from '@/lib/shared/cards';
import { attendeeLabel } from '@/lib/shared/incidents';
import type { CardType } from '@/lib/shared/types';
import { Music, Users, Car, LifeBuoy, Heart, Mic, type LucideIcon } from 'lucide-react';

type Action = { id: string; icon: LucideIcon; label: string; hint: string; tone: string; onClick: () => void };

/** Home for attendees: what's happening and the three things you can do right now. */
export function TonightTab({
  state,
  onNewCard,
  onReport,
  onOpen,
}: {
  state: EventState;
  onNewCard: (type: CardType) => void;
  onReport: () => void;
  onOpen: (tab: 'chat' | 'map' | 'help' | 'fan') => void;
}) {
  const { phase, event } = state;
  const queue = songQueue(state.cards).slice(0, 3);
  const solo = state.cards.filter((c) => c.type === 'meetup').reduce((n, c) => n + 1 + c.votes.length, 0);
  const openReports = state.myIncidents.filter((i) => i.status !== 'resolved');

  const actions: Action[] = [
    ...(phase === 'live'
      ? [{ id: 'song', icon: Music, label: 'Request a song', hint: 'The crowd votes it up', tone: 'bg-gel/15 text-gel', onClick: () => onNewCard('song') }]
      : []),
    ...(phase !== 'after'
      ? [
          { id: 'solo', icon: Users, label: 'I’m going solo', hint: solo ? `${solo} going solo so far` : 'Meet people at the door', tone: 'bg-violet-500/20 text-violet-300', onClick: () => onNewCard('meetup') },
          { id: 'ride', icon: Car, label: 'Share a ride', hint: 'Offer or grab a seat', tone: 'bg-sky-500/15 text-sky-300', onClick: () => onNewCard('carpool') },
        ]
      : [
          { id: 'fan', icon: Heart, label: 'Fan club', hint: `${state.fan.optins} joined for the next gig`, tone: 'bg-spot/15 text-spot', onClick: () => onOpen('fan') },
          { id: 'ask', icon: Mic, label: `Ask ${event.artist}`, hint: 'Top questions get answered', tone: 'bg-gel/15 text-gel', onClick: () => onNewCard('question') },
        ]),
    { id: 'help', icon: LifeBuoy, label: 'Tell the crew', hint: 'Private, only crew see it', tone: 'bg-warn/15 text-warn', onClick: onReport },
  ];

  return (
    <div className="flex-1 overflow-y-auto pb-6">
      <div className="px-4">
        <Poster artist={event.artist} title={event.title} startsAt={event.startsAt} phase={phase} className="mt-1 min-h-48 rounded-[1.75rem]">
          <div className="mt-3 flex items-center gap-2">
            <AvatarStack names={state.room.faces} total={state.room.people} size={26} />
            <span className="text-sm text-white/85">{state.room.people} in the room</span>
          </div>
        </Poster>
      </div>

      <Banner conditions={state.conditions} places={state.places} onOpenMap={() => onOpen('map')} />

      <h2 className="mt-6 mb-3 px-4 text-lg font-bold">Right now</h2>
      <div className="grid grid-cols-2 gap-3 px-4">
        {actions.map((a) => (
          <button key={a.id} onClick={a.onClick} className="flex min-h-28 flex-col justify-between rounded-[1.5rem] bg-velvet p-4 text-left transition-transform active:scale-[0.98]">
            <span className={`grid h-11 w-11 place-items-center rounded-2xl ${a.tone}`} aria-hidden><a.icon size={22} strokeWidth={2.2} /></span>
            <span>
              <span className="block font-bold leading-tight">{a.label}</span>
              <span className="block text-xs text-haze">{a.hint}</span>
            </span>
          </button>
        ))}
      </div>

      {phase === 'live' && (
        <section className="mt-6 px-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-bold">Crowd setlist</h2>
            <button onClick={() => onOpen('chat')} className="text-sm font-semibold text-spot">Vote in chat</button>
          </div>
          {queue.length === 0 ? (
            <button onClick={() => onNewCard('song')} className="w-full rounded-[1.5rem] border border-dashed border-line p-4 text-left text-sm text-haze">
              No requests yet. Be the first to pick a song.
            </button>
          ) : (
            <ol className="setlist -rotate-[0.6deg] rounded-sm px-5 py-3">
              {queue.map((c, i) => (
                <li key={c.id} className="flex items-baseline justify-between gap-3 border-b border-ink/10 py-1.5 last:border-0">
                  <span className="truncate font-hand text-xl"><span className="mr-2 text-ink/40">{i + 1}.</span>{c.payload.title as string}</span>
                  <span className="shrink-0 font-bold text-gel">{c.votes.length} ▲</span>
                </li>
              ))}
            </ol>
          )}
        </section>
      )}

      {openReports.length > 0 && (
        <section className="mt-6 px-4">
          <h2 className="mb-3 text-lg font-bold">Your reports</h2>
          <button onClick={() => onOpen('help')} className="w-full rounded-[1.5rem] bg-velvet p-4 text-left">
            {openReports.slice(0, 2).map((r) => (
              <span key={r.id} className="flex items-center justify-between gap-3 py-1">
                <span className="truncate text-sm">{r.note}</span>
                <span className="shrink-0 rounded-full bg-warn/15 px-2 py-0.5 text-xs font-semibold text-warn">{attendeeLabel(r.status)}</span>
              </span>
            ))}
          </button>
        </section>
      )}
    </div>
  );
}
