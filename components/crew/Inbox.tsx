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
    <div className="flex h-full flex-col px-3 pb-28">
      <div className="mb-3 px-1">
        <h1 className="font-display text-[30px] leading-none font-extrabold tracking-tight">Inbox</h1>
        <p className="mt-1 text-sm text-white/60">All your channels and messages, powered by the Nexconn Chat UI kit.</p>
      </div>
      <div className="min-h-0 flex-1 overflow-hidden rounded-[28px] bg-white text-[#05060d] shadow-2xl">
        {!ready && <p className="p-6 text-sm text-black/50">Opening your inbox…</p>}
        <div ref={host} className="h-full" />
      </div>
    </div>
  );
}
