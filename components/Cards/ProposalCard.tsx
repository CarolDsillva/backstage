'use client';
import { useEffect, useState } from 'react';
import { postJson, type EventState } from '@/lib/client/useEventState';
import type { Proposal } from '@/lib/shared/types';
import { STATUS_LABEL } from '@/lib/shared/conditions';
import { timeAgo } from '@/lib/shared/time';

/**
 * The moment the conversation changes the venue: a drafted audience update
 * that only a lead can approve, right inside the incident room.
 */
export function ProposalCard({ proposalId, slug, state, refreshKey }: { proposalId: string; slug: string; state: EventState; refreshKey: number }) {
  const [p, setP] = useState<Proposal | null>(null);
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let alive = true;
    fetch(`/api/proposals/${proposalId}?slug=${slug}`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (alive && d) {
          setP(d.proposal);
          setNotice((n) => n || d.proposal.notice);
        }
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [proposalId, slug, refreshKey, tick]);

  if (!p) return <p className="text-center text-xs text-haze">Loading the drafted update…</p>;
  const place = state.places.find((x) => x.id === p.placeId);
  const isLead = state.me.role === 'lead';
  const isCrew = state.me.role === 'crew' || isLead;
  const pending = p.state === 'pending';

  async function decide(decision: 'approve' | 'reject') {
    setBusy(true);
    setError('');
    try {
      await postJson(`/api/proposals/${proposalId}/approve`, { slug, decision, notice: notice.trim() || undefined });
      setTick((t) => t + 1);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      className={`mx-auto w-full max-w-sm rounded-3xl border p-4 ${
        p.state === 'approved' ? 'border-ok/50 bg-ok/10' : p.state === 'rejected' ? 'border-line bg-velvet opacity-70' : 'border-spot/60 bg-velvet'
      }`}
    >
      <p className="text-xs text-haze">
        {p.source === 'ai' ? 'Drafted from this conversation' : 'Drafted from the report'} · for {place?.name ?? 'the venue'}
      </p>
      <p className="mt-1 text-sm">
        Mark as <strong className="text-warn">{STATUS_LABEL[p.status]}</strong> for {p.expiresMins} min, and tell the audience:
      </p>
      {pending && isCrew ? (
        <textarea
          value={notice}
          onChange={(e) => setNotice(e.target.value)}
          maxLength={140}
          rows={2}
          aria-label="Message the audience will see"
          className="mt-2 w-full resize-none rounded-xl border border-line bg-night p-2.5 text-mist outline-none focus:border-spot"
        />
      ) : (
        <p className="mt-2 rounded-xl bg-night/60 p-2.5">“{p.notice}”</p>
      )}

      {pending && isLead && (
        <div className="mt-3 flex gap-2">
          <button disabled={busy || !notice.trim()} onClick={() => decide('approve')} className="h-11 flex-1 rounded-xl bg-spot font-semibold text-ink disabled:opacity-40">
            {busy ? 'Publishing…' : 'Approve and publish'}
          </button>
          <button disabled={busy} onClick={() => decide('reject')} className="h-11 rounded-xl border border-line px-4 text-haze">
            Reject
          </button>
        </div>
      )}
      {pending && !isLead && <p className="mt-2 text-xs text-haze">Waiting for a lead to approve. Nothing changes for the audience until then.</p>}
      {p.state === 'approved' && (
        <p className="mt-2 text-sm font-semibold text-ok">
          Published by {p.decidedBy}{p.decidedAt ? `, ${timeAgo(p.decidedAt)}` : ''}. The map and the room are updated.
        </p>
      )}
      {p.state === 'rejected' && <p className="mt-2 text-sm text-haze">Rejected by {p.decidedBy}. Nothing was published.</p>}
      {error && <p role="alert" className="mt-1 text-xs text-gel">{error}</p>}
    </section>
  );
}
