'use client';
import { useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';
import { useEventState } from '@/lib/client/useEventState';
import { useRoom } from '@/lib/client/useRoom';
import { songQueue } from '@/lib/shared/cards';
import { JoinScreen } from '@/components/JoinScreen';
import { Centered } from '@/components/GigApp';
import { LivePill } from '@/components/ui/Poster';
import { AvatarStack } from '@/components/ui/Avatar';

const APP_KEY = process.env.NEXT_PUBLIC_NEXCONN_APP_KEY ?? '';

/** Projector view: the crowd's song queue as a setlist taped to the stage. */
export function StageScreen({ slug }: { slug: string }) {
  const { state, status, refetch } = useEventState(slug);
  const [qr, setQr] = useState('');
  const me = useMemo(
    () => (state ? { userId: state.me.userId, name: state.me.name, appKey: APP_KEY } : null),
    [state?.me.userId, state?.me.name], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const { onState, status: conn } = useRoom(state?.channels.gig ?? null, me, slug);
  useEffect(() => onState(() => void refetch()), [onState, refetch]);

  useEffect(() => {
    const url = `${window.location.origin}/e/${slug}`;
    QRCode.toDataURL(url, { margin: 1, width: 320, color: { dark: '#16121f', light: '#ffffff' } }).then(setQr);
  }, [slug]);

  if (status === 'join') return <JoinScreen slug={slug} onJoined={refetch} />;
  if (!state) return <Centered title="Loading the stage screen…" />;

  const queue = songQueue(state.cards).slice(0, 8);
  const top = queue[0]?.votes.length ?? 0;
  return (
    <main className="stage-light grid min-h-dvh grid-cols-[1fr_22rem] gap-10 p-10 xl:p-14">
      <section className="flex min-h-0 flex-col">
        <div className="flex items-center gap-3">
          <LivePill phase={state.phase} />
          <span className="text-lg text-haze">{state.event.venue}</span>
        </div>
        <h1 className="mt-3 text-7xl font-extrabold tracking-tight">{state.event.artist}</h1>
        <p className="mt-2 text-2xl text-haze">The crowd wants to hear</p>
        <ol className="setlist mt-8 max-w-4xl rotate-[-0.5deg] rounded-sm px-10 py-7">
          {queue.length === 0 && (
            <li className="font-hand text-3xl text-ink/50">No requests yet. Scan the code and pick the first song.</li>
          )}
          {queue.map((c, i) => (
            <li key={c.id} className="relative flex items-center justify-between gap-6 border-b border-ink/10 py-3 last:border-0">
              <span
                className="absolute inset-y-1 left-0 -z-0 rounded bg-gel/10 transition-[width] duration-700"
                style={{ width: `${top ? (c.votes.length / top) * 100 : 0}%` }}
                aria-hidden
              />
              <span className="relative font-hand text-4xl leading-tight">
                <span className="mr-4 text-ink/40">{i + 1}.</span>
                {c.payload.title as string}
              </span>
              <span className="relative shrink-0 text-3xl font-extrabold text-gel">{c.votes.length}</span>
            </li>
          ))}
        </ol>
      </section>
      <aside className="flex flex-col justify-end gap-4">
        <div className="rounded-[2rem] bg-spot p-6 text-ink">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {qr && <img src={qr} alt="QR code to join the room" className="w-full rounded-2xl" />}
          <p className="mt-4 text-2xl font-extrabold leading-tight">Scan to join the room and vote</p>
          <p className="mt-1 text-sm font-semibold opacity-70">No app needed. Just your name.</p>
        </div>
        <div className="flex items-center justify-between rounded-[1.5rem] bg-velvet px-5 py-4">
          <span className="flex items-center gap-3">
            <AvatarStack names={state.room.faces} total={state.room.people} size={34} />
            <span className="text-lg font-bold">{state.room.people} in the room</span>
          </span>
          <span className="text-sm text-haze">{conn === 'online' ? 'Live' : 'Reconnecting…'}</span>
        </div>
      </aside>
    </main>
  );
}
