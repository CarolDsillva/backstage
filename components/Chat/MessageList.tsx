'use client';
import { useEffect, useRef } from 'react';
import type { ChatMsg } from '@/lib/client/nexconn';
import { clock } from '@/lib/shared/time';

type Props = {
  messages: ChatMsg[];
  loading: boolean;
  renderCustom: (m: ChatMsg) => React.ReactNode;
  empty: React.ReactNode;
  roleOf?: (userId: string) => string | undefined;
};

function isImage(m: ChatMsg) {
  return m.type === 'RC:ImgMsg';
}

function isText(m: ChatMsg) {
  return m.type === 'RC:TxtMsg';
}

export function MessageList({ messages, loading, renderCustom, empty, roleOf }: Props) {
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    end.current?.scrollIntoView({ block: 'end' });
  }, [messages.length]);

  if (loading && !messages.length) {
    return <div className="flex flex-1 items-center justify-center text-haze">Loading the room…</div>;
  }
  if (!messages.length) return <div className="flex flex-1 flex-col justify-end p-4">{empty}</div>;

  return (
    <div className="flex flex-1 flex-col gap-2 overflow-y-auto px-3 py-4" aria-live="polite">
      {messages.map((m, i) => {
        const prev = messages[i - 1];
        const showName = !m.mine && (!prev || prev.senderId !== m.senderId || !(isText(prev) || isImage(prev)));
        if (!isText(m) && !isImage(m)) {
          return <div key={m.id} className="my-1">{renderCustom(m)}</div>;
        }
        const badge = roleOf?.(m.senderId);
        return (
          <div key={m.id} className={`flex max-w-[82%] flex-col ${m.mine ? 'self-end items-end' : 'self-start'}`}>
            {showName && (
              <span className="mb-0.5 px-1 text-xs text-haze">
                {m.senderName}
                {badge && <span className="ml-1.5 rounded bg-spot/20 px-1 text-[10px] font-semibold text-spot">{badge}</span>}
              </span>
            )}
            {isImage(m) ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={(m.content.remoteUrl as string) || `data:image/jpeg;base64,${m.content.thumbnailBase64 as string}`}
                alt={`Photo from ${m.senderName}`}
                className="max-h-72 rounded-2xl border border-line object-cover"
              />
            ) : (
              <p
                className={`whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 ${
                  m.mine ? 'rounded-br-md bg-spot text-ink' : 'rounded-bl-md bg-velvet-2 text-mist'
                }`}
              >
                {m.content.text as string}
              </p>
            )}
            <span className="mt-0.5 px-1 text-[10px] text-haze/60">{clock(m.sentAt)}</span>
          </div>
        );
      })}
      <div ref={end} />
    </div>
  );
}
