'use client';
import { useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';
import { useEventState } from '@/lib/client/useEventState';
import { useRoom } from '@/lib/client/useRoom';
import { songQueue } from '@/lib/shared/cards';
import { JoinScreen } from '@/components/JoinScreen';
import { Centered } from '@/components/GigApp';

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
    QRCode.toDataURL(url, { margin: 1, width: 320, color: { dark: '#2a2233', light: '#f6eedb' } }).then(setQr);
  }, [slug]);

  if (status === 'join') return <JoinScreen slug={slug} onJoined={refetch} />;
  if (!state) return <Centered title="Loading the stage screen…" />;

  const queue = songQueue(state.cards).slice(0, 8);
  return (
    <main className="stage-light grid min-h-dvh grid-cols-[1fr_auto] gap-12 p-12">
      <section>
        <p className="text-2xl text-haze">{state.event.artist}, the crowd wants</p>
        <ol className="setlist mt-8 max-w-3xl rotate-[-0.6deg] rounded-sm px-10 py-8">
          {queue.length === 0 && (
            <li className="font-hand text-3xl text-ink/50">No requests yet. Scan the code and pick the first song.</li>
          )}
          {queue.map((c, i) => (
            <li
              key={c.id}
              className="flex items-baseline justify-between gap-6 border-b border-ink/10 py-3 transition-all duration-700 last:border-0"
            >
              <span className="font-hand text-4xl leading-tight">
                <span className="mr-4 text-ink/40">{i + 1}.</span>
                {c.payload.title as string}
              </span>
              <span className="shrink-0 text-2xl font-semibold text-gel">{c.votes.length} ▲</span>
            </li>
          ))}
        </ol>
      </section>
      <aside className="flex w-80 flex-col items-center justify-end gap-4 text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {qr && <img src={qr} alt="QR code to join the room" className="w-72 rounded-xl" />}
        <p className="text-xl">Scan to join the room and vote</p>
        <p className="text-sm text-haze">{conn === 'online' ? 'Updating live' : 'Reconnecting…'}</p>
      </aside>
    </main>
  );
}
