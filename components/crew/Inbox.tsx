'use client';
import { useEffect, useRef, useState } from 'react';
import { getChatUIApp } from '@/lib/client/nexconn';

/**
 * Every channel and direct message in one place, using the ready-made Nexconn Chat UI kit
 * (<nc-chat-ui-app-provider>). The kit was initialised and ready() before connect (see nexconn.ts).
 */
export function Inbox() {
  const host = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(() => !!getChatUIApp());

  useEffect(() => {
    if (ready) return;
    const id = setInterval(() => { if (getChatUIApp()) setReady(true); }, 300);
    return () => clearInterval(id);
  }, [ready]);

  useEffect(() => {
    if (!ready || !host.current) return;
    const el = document.createElement('nc-chat-ui-app-provider');
    el.style.display = 'block';
    el.style.height = '100%';
    host.current.replaceChildren(el);
    return () => { el.remove(); };
  }, [ready]);

  return (
    <div className="flex h-full flex-col px-3 pb-3">
      <p className="mb-2 px-1 text-sm text-[#B8ABE6]">Every channel and message in the ready-made Nexconn Chat UI kit.</p>
      <div className="min-h-0 flex-1 overflow-hidden rounded-[24px] bg-[#251856] text-white">
        {!ready && <p className="p-6 text-sm text-black/50">Opening your inbox…</p>}
        <div ref={host} className="h-full" />
      </div>
    </div>
  );
}
