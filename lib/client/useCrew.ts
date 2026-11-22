'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { connectNexconn, loadHistory, onMessage, onStatus, setChatProfiles, type ChatMsg, type ConnStatus } from './nexconn';
import { BS_TYPES, SYSTEM_USER_ID, type Condition, type EventRow, type Incident, type Phase, type Place, type Role } from '@/lib/shared/types';
import { isRenderable } from '@/lib/shared/trust';
import { team as teamOf, type TeamId } from '@/lib/shared/teams';

export type CrewState = {
  event: EventRow;
  phase: Phase;
  me: { userId: string; name: string; role: Role; team: TeamId | null; viewer?: boolean };
  canOpen: TeamId[];
  channels: Partial<Record<TeamId, string>>;
  places: Place[];
  conditions: Condition[];
  issues: Incident[];
  crew: { userId: string; name: string; role: Role; team: string | null }[];
  radio: { team: string; callId: string; startedBy: string; startedAt: string }[];
  serverTime: string;
};

type Status = 'loading' | 'checkin' | 'ready' | 'notfound' | 'error';
const APP_KEY = process.env.NEXT_PUBLIC_NEXCONN_APP_KEY ?? '';

/** Live feed entry: a recent message from any channel this member hears. */
export type FeedItem = ChatMsg & { team: TeamId };

export function useCrew(slug: string) {
  const [state, setState] = useState<CrewState | null>(null);
  const [status, setStatus] = useState<Status>('loading');
  const [conn, setConn] = useState<ConnStatus>('connecting');
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [unread, setUnread] = useState<Partial<Record<TeamId, number>>>({});
  const openRoom = useRef<TeamId | null>(null);
  const tokenRef = useRef<string | undefined>(undefined);

  const refetch = useCallback(async () => {
    try {
      const r = await fetch(`/api/crew/${slug}`, { cache: 'no-store' });
      if (r.status === 401 || r.status === 403) return setStatus('checkin');
      if (r.status === 404) return setStatus('notfound');
      if (!r.ok) return setStatus((s) => (s === 'ready' ? s : 'error'));
      const data = (await r.json()) as CrewState;
      setState(data);
      setStatus('ready');
    } catch {
      setStatus((s) => (s === 'ready' ? s : 'error'));
    }
  }, [slug]);

  useEffect(() => { void refetch(); }, [refetch]);
  useEffect(() => onStatus(setConn), []);

  // channelId -> team, for routing live messages.
  const teamByChannel = useMemo(() => {
    const m = new Map<string, TeamId>();
    if (state) for (const [t, ch] of Object.entries(state.channels)) if (ch) m.set(ch, t as TeamId);
    return m;
  }, [state]);

  // Connect once we know who we are (Chat SDK + Call SDK + Chat UI kit).
  const me = state?.me;
  useEffect(() => {
    if (!me) return;
    void connectNexconn({ appKey: APP_KEY, userId: me.userId, name: me.name, token: tokenRef.current, setup: { call: true, chatUI: true } }).catch(() => {});
  }, [me?.userId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Profiles for the Chat UI kit (names instead of ids).
  useEffect(() => {
    if (!state) return;
    setChatProfiles(
      [{ userId: SYSTEM_USER_ID, name: 'Backstage' }, ...state.crew.map((c) => ({ userId: c.userId, name: c.name }))],
      Object.entries(state.channels).map(([t, ch]) => ({
        channelId: ch!, name: `CH${teamOf(t).ch} · ${teamOf(t).name}`,
        members: state.crew.filter((c) => c.role === 'lead' || t === 'control' || c.team === t).map((c) => c.userId),
      })),
    );
  }, [state]);

  // Seed the live feed with recent history from each channel (in parallel), once connected.
  const seeded = useRef(false);
  useEffect(() => {
    if (!state || conn !== 'online' || seeded.current) return;
    seeded.current = true;
    void Promise.all(Object.entries(state.channels).map(async ([t, ch]) => {
      const hist = await loadHistory(ch!, 30).catch(() => [] as ChatMsg[]);
      return hist.filter((m) => isRenderable(m) && m.type !== BS_TYPES.state).map((m) => ({ ...m, team: t as TeamId }));
    })).then((all) => setFeed((prev) => merge(prev, all.flat())));
  }, [state, conn]);

  // One listener for every channel: refetch on state signals, feed + unread for everything else.
  useEffect(() => onMessage((m) => {
    const t = teamByChannel.get(m.channelId);
    if (!t || !isRenderable(m)) return;
    if (m.type === BS_TYPES.state) return void refetch();
    setFeed((prev) => merge(prev, [{ ...m, team: t }]));
    if (!m.mine && openRoom.current !== t) setUnread((u) => ({ ...u, [t]: (u[t] ?? 0) + 1 }));
    if (m.type === BS_TYPES.issue || m.type === BS_TYPES.issueUpdate || m.type === BS_TYPES.radio || m.type === BS_TYPES.announce) void refetch();
  }), [teamByChannel, refetch]);

  const setOpenRoom = useCallback((t: TeamId | null) => {
    openRoom.current = t;
    if (t) setUnread((u) => ({ ...u, [t]: 0 }));
  }, []);

  return { state, status, conn, feed, unread, refetch, setOpenRoom, setToken: (t?: string) => { tokenRef.current = t; } };
}

function merge(prev: FeedItem[], add: FeedItem[]) {
  const seen = new Set(prev.map((p) => p.id));
  return [...prev, ...add.filter((a) => !seen.has(a.id))].sort((a, b) => b.sentAt - a.sentAt).slice(0, 300);
}

export async function crewPost<T = unknown>(url: string, body: unknown, method = 'POST'): Promise<T> {
  const r = await fetch(url, { method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((data as { error?: string }).error ?? 'That didn’t go through. Try again.');
  return data as T;
}
