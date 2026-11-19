'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  connectNexconn, loadHistory, onMessage, onStatus, sendCustom, sendImage, sendText,
  type ChatMsg, type ConnStatus,
} from './nexconn';
import { BS_TYPES, type StateSignal } from '@/lib/shared/types';
import { isRenderable } from '@/lib/shared/trust';

export type Me = { userId: string; name: string; appKey: string };

function bumpActivity(slug?: string) {
  if (!slug) return;
  // Debounced in nexconn layer? Keep simple: at most once per 30s per tab.
  const key = `bs_act_${slug}`;
  const last = Number(sessionStorage.getItem(key) ?? 0);
  const pending = Number(sessionStorage.getItem(key + '_n') ?? 0) + 1;
  sessionStorage.setItem(key + '_n', String(pending));
  if (Date.now() - last < 30_000) return;
  sessionStorage.setItem(key, String(Date.now()));
  sessionStorage.setItem(key + '_n', '0');
  void fetch('/api/activity', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ slug, n: pending }),
  }).catch(() => {});
}

/**
 * Live messages for one Nexconn group channel.
 * BS:State messages are not shown; they fire onState listeners so views can refetch.
 */
export function useRoom(channelId: string | null, me: Me | null, slug?: string) {
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [status, setStatus] = useState<ConnStatus>('connecting');
  const [loading, setLoading] = useState(true);
  const stateCbs = useRef(new Set<(s: StateSignal) => void>());

  useEffect(() => onStatus(setStatus), []);

  useEffect(() => {
    if (!channelId || !me) return;
    let alive = true;
    setLoading(true);
    const off = onMessage((m) => {
      if (m.channelId !== channelId || !isRenderable(m)) return;
      if (m.type === BS_TYPES.state) {
        stateCbs.current.forEach((cb) => cb(m.content as StateSignal));
        return;
      }
      setMessages((prev) => (prev.some((p) => p.id === m.id) ? prev : [...prev, m]));
    });
    connectNexconn(me)
      .then(() => loadHistory(channelId))
      .then((hist) => {
        if (!alive) return;
        setMessages((prev) => {
          const ids = new Set(hist.map((h) => h.id));
          return [...hist.filter((h) => h.type !== BS_TYPES.state && isRenderable(h)), ...prev.filter((p) => !ids.has(p.id))];
        });
      })
      .catch(() => {})
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
      off();
    };
  }, [channelId, me]);

  const append = (m: ChatMsg) =>
    setMessages((prev) => (prev.some((p) => p.id === m.id) ? prev : [...prev, m]));

  const text = useCallback(async (t: string) => {
    if (!channelId) return;
    append(await sendText(channelId, t));
    bumpActivity(slug);
  }, [channelId, slug]);

  const image = useCallback(async (f: File, onProgress?: (p: number) => void) => {
    if (!channelId) return;
    append(await sendImage(channelId, f, onProgress));
    bumpActivity(slug);
  }, [channelId, slug]);

  const custom = useCallback(async (type: string, content: Record<string, unknown>) => {
    if (!channelId) return;
    append(await sendCustom(channelId, type, content));
    bumpActivity(slug);
  }, [channelId, slug]);

  const onState = useCallback((cb: (s: StateSignal) => void) => {
    stateCbs.current.add(cb);
    return () => void stateCbs.current.delete(cb);
  }, []);

  return { messages, status, loading, sendText: text, sendImage: image, sendCustom: custom, onState };
}
