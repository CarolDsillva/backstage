'use client';
import { useCallback, useEffect, useState } from 'react';
import type { Card, Condition, EventRow, Incident, Phase, Place, Role } from '@/lib/shared/types';

export type EventState = {
  event: EventRow;
  phase: Phase;
  places: Place[];
  conditions: Condition[];
  cards: Card[];
  myIncidents: Incident[];
  me: { userId: string; name: string; role: Role };
  channels: { gig: string | null; crew: string | null };
  fan: { optins: number; optedIn: boolean; myRating: number | null };
  roles: Record<string, Role>;
  serverTime: string;
};

type Status = 'loading' | 'join' | 'ready' | 'notfound' | 'error';

export function useEventState(slug: string) {
  const [state, setState] = useState<EventState | null>(null);
  const [status, setStatus] = useState<Status>('loading');

  const refetch = useCallback(async () => {
    try {
      const r = await fetch(`/api/event/${slug}`, { cache: 'no-store' });
      if (r.status === 401) return setStatus('join');
      if (r.status === 404) return setStatus('notfound');
      if (!r.ok) return setStatus((s) => (s === 'ready' ? s : 'error'));
      setState(await r.json());
      setStatus('ready');
    } catch {
      setStatus((s) => (s === 'ready' ? s : 'error'));
    }
  }, [slug]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return { state, status, refetch };
}

export async function postJson<T = unknown>(url: string, body: unknown, method = 'POST'): Promise<T> {
  const r = await fetch(url, {
    method,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((data as { error?: string }).error ?? 'That didn’t go through. Try again.');
  return data as T;
}

const BADGE: Record<Role, string | undefined> = { attendee: undefined, artist: 'Artist', crew: 'Crew', lead: 'Lead' };

export function badgeFor(state: EventState, userId: string): string | undefined {
  const r = state.roles[userId];
  return r ? BADGE[r] : undefined;
}
