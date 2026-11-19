'use client';
import { useCallback, useEffect, useState } from 'react';
import { useRoom, type Me } from '@/lib/client/useRoom';
import { badgeFor, postJson, type EventState } from '@/lib/client/useEventState';
import { MessageList } from './Chat/MessageList';
import { Composer } from './Chat/Composer';
import { CardRenderer } from './Cards/CardRenderer';
import { attendeeLabel, canDraft, CATEGORY_LABEL } from '@/lib/shared/incidents';
import { timeAgo } from '@/lib/shared/time';
import type { Incident, IncidentStatus } from '@/lib/shared/types';

type Audit = { kind: string; old: string | null; new: string | null; at: string; by: string };

const STATUS_STYLE: Record<IncidentStatus, string> = {
  new: 'bg-gel/20 text-gel',
  checking: 'bg-spot/20 text-spot',
  verified: 'bg-ok/20 text-ok',
  resolved: 'bg-line text-haze',
};

const AUDIT_TEXT: Record<string, (a: Audit) => string> = {
  status: (a) => `${a.by} marked it ${attendeeLabel(a.new as IncidentStatus).toLowerCase()}`,
  drafted_update: (a) => `${a.by} drafted an audience update`,
  approved_update: (a) => `${a.by} approved and published the update`,
  rejected_update: (a) => `${a.by} rejected the drafted update`,
};

/** One report's private room: reporter + crew, with structured actions and the audit trail. */
export function IncidentRoom({
  incidentId,
  state,
  slug,
  me,
  onBack,
  onChanged,
}: {
  incidentId: string;
  state: EventState;
  slug: string;
  me: Me | null;
  onBack: () => void;
  onChanged?: () => void;
}) {
  const [inc, setInc] = useState<Incident | null>(null);
  const [audit, setAudit] = useState<Audit[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [showLog, setShowLog] = useState(false);

  const load = useCallback(async () => {
    const r = await fetch(`/api/incidents/${incidentId}?slug=${slug}`, { cache: 'no-store' });
    if (!r.ok) return setError('Couldn’t load this report. Go back and try again.');
    const d = await r.json();
    setInc(d.incident);
    setAudit(d.audit);
  }, [incidentId, slug]);

  useEffect(() => {
    void load();
  }, [load]);

  const room = useRoom(inc?.channelId ?? null, me, slug);
  const { onState } = room;
  useEffect(
    () =>
      onState(() => {
        setRefreshKey((k) => k + 1);
        void load();
        onChanged?.();
      }),
    [onState, load, onChanged],
  );

  const staff = state.me.role === 'crew' || state.me.role === 'lead';

  async function setStatus(status: IncidentStatus) {
    setBusy(status);
    setError('');
    try {
      await postJson(`/api/incidents/${incidentId}`, { slug, status }, 'PATCH');
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy('');
    }
  }

  async function draft() {
    setBusy('draft');
    setError('');
    try {
      const messages = room.messages
        .filter((m) => m.type === 'RC:TxtMsg')
        .slice(-30)
        .map((m) => ({ name: m.senderName.slice(0, 40), text: String(m.content.text ?? '').slice(0, 1000) }));
      await postJson(`/api/incidents/${incidentId}/propose`, { slug, messages });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy('');
    }
  }

  if (!inc) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-haze">
        {error || 'Opening the report…'}
        <button onClick={onBack} className="text-sm underline">Back</button>
      </div>
    );
  }

  const place = state.places.find((p) => p.id === inc.placeId);
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="border-b border-line px-4 py-3">
        <button onClick={onBack} className="mb-1 text-sm text-haze">‹ All reports</button>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="font-semibold">{CATEGORY_LABEL[inc.category]}{place ? `: ${place.name}` : ''}</h2>
            <p className="text-xs text-haze">From {inc.reporterName}, {timeAgo(inc.createdAt)}</p>
            <p className="mt-1 line-clamp-2 text-sm text-mist">“{inc.note}”</p>
          </div>
          <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_STYLE[inc.status]}`}>
            {attendeeLabel(inc.status)}
          </span>
        </div>
        {staff && (
          <div className="mt-3 flex gap-2 overflow-x-auto">
            {inc.status === 'new' && (
              <button disabled={!!busy} onClick={() => setStatus('checking')} className="h-10 shrink-0 rounded-xl bg-spot px-3 text-sm font-semibold text-ink">
                {busy === 'checking' ? 'Saving…' : 'I’m on it'}
              </button>
            )}
            {canDraft(inc) && (
              <button disabled={!!busy} onClick={draft} className="h-10 shrink-0 rounded-xl border border-spot px-3 text-sm font-semibold text-spot">
                {busy === 'draft' ? 'Drafting…' : 'Draft audience update'}
              </button>
            )}
            {inc.status !== 'resolved' ? (
              <button disabled={!!busy} onClick={() => setStatus('resolved')} className="h-10 shrink-0 rounded-xl border border-line px-3 text-sm text-mist">
                Mark sorted
              </button>
            ) : (
              <button disabled={!!busy} onClick={() => setStatus('checking')} className="h-10 shrink-0 rounded-xl border border-line px-3 text-sm text-mist">
                Reopen
              </button>
            )}
            <button onClick={() => setShowLog((s) => !s)} aria-expanded={showLog} className="h-10 shrink-0 rounded-xl px-3 text-sm text-haze">
              {showLog ? 'Hide history' : 'History'}
            </button>
          </div>
        )}
        {showLog && (
          <ol className="mt-3 flex flex-col gap-1 text-xs text-haze">
            <li>{inc.reporterName} reported it, {timeAgo(inc.createdAt)}</li>
            {audit.map((a, i) => (
              <li key={i}>{(AUDIT_TEXT[a.kind] ?? ((x: Audit) => `${x.by}: ${x.kind}`))(a)}, {timeAgo(a.at)}</li>
            ))}
          </ol>
        )}
        {error && <p role="alert" className="mt-2 text-xs text-gel">{error}</p>}
      </div>
      <MessageList
        messages={room.messages}
        roleOf={(id) => badgeFor(state, id)}
        loading={room.loading}
        renderCustom={(m) => <CardRenderer msg={m} state={state} slug={slug} onChanged={() => setRefreshKey((k) => k + 1)} refreshKey={refreshKey} />}
        empty={<p className="text-sm text-haze">This room is just you and the crew.</p>}
      />
      <Composer
        disabled={room.status !== 'online'}
        onText={room.sendText}
        onImage={room.sendImage}
        placeholder={staff ? 'Message the reporter and crew' : 'Add details or a photo for the crew'}
      />
    </div>
  );
}
