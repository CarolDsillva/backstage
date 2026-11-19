'use client';
import { useEffect, useRef } from 'react';
import type { ChatMsg } from '@/lib/client/nexconn';
import { clock } from '@/lib/shared/time';
import { Avatar } from '../ui/Avatar';

type Props = {
  messages: ChatMsg[];
  loading: boolean;
  renderCustom: (m: ChatMsg) => React.ReactNode;
  empty: React.ReactNode;
  roleOf?: (userId: string) => string | undefined;
};

const isImage = (m: ChatMsg) => m.type === 'RC:ImgMsg';
const isText = (m: ChatMsg) => m.type === 'RC:TxtMsg';
const isUser = (m?: ChatMsg) => !!m && (isText(m) || isImage(m));
const GAP_MS = 10 * 60_000;

const BADGE_TONE: Record<string, string> = {
  Artist: 'bg-gel/20 text-gel',
  Lead: 'bg-spot/20 text-spot',
  Crew: 'bg-warn/20 text-warn',
};

export function MessageList({ messages, loading, renderCustom, empty, roleOf }: Props) {
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    end.current?.scrollIntoView({ block: 'end' });
  }, [messages.length]);

  if (loading && !messages.length) {
    return (
      <div className="flex flex-1 flex-col gap-3 px-4 py-6" aria-label="Loading messages">
        {[60, 40, 70].map((w, i) => (
          <div key={i} className={`flex items-end gap-2 ${i === 1 ? 'flex-row-reverse' : ''}`}>
            <span className="h-8 w-8 animate-pulse rounded-full bg-velvet" />
            <span className="h-10 animate-pulse rounded-3xl bg-velvet" style={{ width: `${w}%` }} />
          </div>
        ))}
      </div>
    );
  }
  if (!messages.length) return <div className="flex flex-1 flex-col justify-end p-4">{empty}</div>;

  return (
    <div className="flex flex-1 flex-col overflow-y-auto px-3 py-4" aria-live="polite">
      {messages.map((m, i) => {
        const prev = messages[i - 1];
        const next = messages[i + 1];
        const gap = !prev || m.sentAt - prev.sentAt > GAP_MS;
        const divider = gap && m.sentAt ? (
          <p className="my-3 text-center text-[11px] font-semibold text-haze/70">{clock(m.sentAt)}</p>
        ) : null;

        if (!isUser(m)) {
          return (
            <div key={m.id}>
              {divider}
              <div className="my-2">{renderCustom(m)}</div>
            </div>
          );
        }

        const firstOfRun = gap || !isUser(prev) || prev!.senderId !== m.senderId;
        const lastOfRun = !isUser(next) || next!.senderId !== m.senderId || next!.sentAt - m.sentAt > GAP_MS;
        const badge = roleOf?.(m.senderId);
        const radius = m.mine
          ? `rounded-3xl ${lastOfRun ? 'rounded-br-lg' : ''} ${firstOfRun ? '' : 'rounded-tr-lg'}`
          : `rounded-3xl ${lastOfRun ? 'rounded-bl-lg' : ''} ${firstOfRun ? '' : 'rounded-tl-lg'}`;

        return (
          <div key={m.id}>
            {divider}
            <div className={`flex items-end gap-2 ${m.mine ? 'flex-row-reverse' : ''} ${firstOfRun ? 'mt-2' : 'mt-0.5'}`}>
              {!m.mine && (
                <span className="w-8 shrink-0">{lastOfRun && <Avatar name={m.senderName} seed={m.senderId} size={32} />}</span>
              )}
              <div className={`flex max-w-[78%] flex-col ${m.mine ? 'items-end' : 'items-start'}`}>
                {firstOfRun && !m.mine && (
                  <span className="mb-1 flex items-center gap-1.5 px-1 text-xs font-semibold text-haze">
                    {m.senderName}
                    {badge && <span className={`rounded-full px-1.5 py-px text-[10px] font-bold ${BADGE_TONE[badge] ?? 'bg-line text-mist'}`}>{badge}</span>}
                  </span>
                )}
                {isImage(m) ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={(m.content.remoteUrl as string) || `data:image/jpeg;base64,${m.content.thumbnailBase64 as string}`}
                    alt={`Photo from ${m.senderName}`}
                    className={`max-h-72 border border-line object-cover ${radius}`}
                  />
                ) : (
                  <p
                    className={`whitespace-pre-wrap break-words px-4 py-2.5 leading-snug ${radius} ${
                      m.mine ? 'bg-spot font-medium text-ink' : 'bg-velvet-2 text-mist'
                    }`}
                    title={clock(m.sentAt)}
                  >
                    {m.content.text as string}
                  </p>
                )}
              </div>
            </div>
          </div>
        );
      })}
      <div ref={end} className="h-1" />
    </div>
  );
}
