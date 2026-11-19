import type { Condition, Incident, IncidentStatus, Proposal, Role } from '@/lib/shared/types';
import { can } from '@/lib/shared/permissions';
import { HttpError } from './http';

export type DecideDeps = {
  getProposal(id: string): Promise<Proposal | null>;
  getIncident(id: string): Promise<Incident | null>;
  decide(id: string, state: 'approved' | 'rejected', by: string, notice?: string): Promise<boolean>;
  upsertCondition(eventId: string, c: Condition): Promise<void>;
  setIncidentStatus(id: string, s: IncidentStatus): Promise<void>;
  addAudit(incidentId: string, actorId: string, kind: string, oldV: string | null, newV: string | null): Promise<void>;
  announce(a: { incident: Incident; condition: Condition }): Promise<void>;
  signalRooms(incident: Incident): Promise<void>;
  now(): Date;
};

type Ctx = { eventId: string; userId: string; name: string; role: Role };

/**
 * The only path that changes official venue state: a lead approving a proposal.
 * Compare-and-set on the proposal makes double taps and two leads racing safe.
 */
export function makeDecide(d: DecideDeps) {
  return async (ctx: Ctx, proposalId: string, decision: 'approve' | 'reject', editedNotice?: string) => {
    if (!can(ctx.role, 'approveUpdate')) throw new HttpError(403, 'Only a lead can approve crew updates.');
    const p = await d.getProposal(proposalId);
    const inc = p ? await d.getIncident(p.incidentId) : null;
    if (!p || !inc || inc.eventId !== ctx.eventId) throw new HttpError(404, 'Update not found');

    const state = decision === 'approve' ? 'approved' : 'rejected';
    const notice = editedNotice?.trim().slice(0, 140) || p.notice;
    const changed = await d.decide(p.id, state, ctx.name, notice);
    if (!changed) {
      const current = await d.getProposal(p.id);
      return { state: current?.state ?? p.state, changed: false };
    }

    const target = `${p.placeId}:${p.status}`;
    if (state === 'rejected') {
      await d.addAudit(inc.id, ctx.userId, 'rejected_update', null, target);
      await d.signalRooms(inc);
      return { state, changed: true };
    }

    const now = d.now();
    const condition: Condition = {
      placeId: p.placeId,
      status: p.status,
      notice,
      approvedBy: ctx.name,
      approvedAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + p.expiresMins * 60_000).toISOString(),
    };
    // Persist first (so refetches see it), then tell every room at once.
    await Promise.all([
      d.upsertCondition(ctx.eventId, condition),
      d.setIncidentStatus(inc.id, p.status === 'ok' ? 'resolved' : 'verified'),
      d.addAudit(inc.id, ctx.userId, 'approved_update', null, target),
    ]);
    await Promise.all([d.announce({ incident: inc, condition }), d.signalRooms(inc)]);
    return { state, changed: true };
  };
}
