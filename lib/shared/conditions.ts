import type { Condition, ConditionStatus } from './types';

export type Effective = {
  status: ConditionStatus | 'stale';
  notice?: string;
  approvedBy?: string;
  approvedAt?: string;
};

/** What attendees should see for a place right now. Expired updates never linger as fact. */
export function effectiveCondition(c: Condition | undefined, now: Date): Effective {
  if (!c) return { status: 'ok' };
  if (c.expiresAt && new Date(c.expiresAt) <= now) {
    return { status: 'stale', approvedBy: c.approvedBy, approvedAt: c.approvedAt };
  }
  return { status: c.status, notice: c.notice, approvedBy: c.approvedBy, approvedAt: c.approvedAt };
}

export const STATUS_LABEL: Record<Effective['status'], string> = {
  ok: 'Open',
  limited: 'Limited',
  closed: 'Closed',
  stale: 'Needs reconfirmation',
};

export const STATUS_ICON: Record<Effective['status'], string> = {
  ok: '●',
  limited: '▲',
  closed: '✕',
  stale: '?',
};
