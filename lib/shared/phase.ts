import type { Phase } from './types';

export function phaseOf(now: Date, startsAt: Date, endsAt: Date, override?: Phase | null): Phase {
  if (override) return override;
  if (now < startsAt) return 'before';
  if (now < endsAt) return 'live';
  return 'after';
}

export const PHASE_LABEL: Record<Phase, string> = { before: 'Before', live: 'Live', after: 'After' };
