import { z } from 'zod';
import type { IncidentStatus, Role } from './types';

const ORDER: IncidentStatus[] = ['new', 'checking', 'verified', 'resolved'];

/** Server-enforced status rules. Verification is a lead decision. */
export function canTransition(from: IncidentStatus, to: IncidentStatus, role: Role): boolean {
  if (role !== 'crew' && role !== 'lead') return false;
  if (from === to) return false;
  if (from === 'resolved' && to === 'checking') return true; // reopen
  if (ORDER.indexOf(to) < ORDER.indexOf(from)) return false;
  if (to === 'verified') return role === 'lead';
  return true;
}

const LABEL: Record<IncidentStatus, string> = {
  new: 'Report received',
  checking: 'Crew is checking',
  verified: 'Crew confirmed',
  resolved: 'Sorted',
};

export function attendeeLabel(s: IncidentStatus) {
  return LABEL[s];
}

export const CATEGORY_LABEL = {
  place_problem: 'Problem at a place',
  lost_item: 'Lost something',
  lost_group: 'Lost my group',
  help: 'I need help',
} as const;

export const incidentInput = z.object({
  slug: z.string().min(1),
  category: z.enum(['place_problem', 'lost_item', 'lost_group', 'help']),
  placeId: z.string().max(40).nullish(),
  note: z.string().trim().min(1, 'Tell the crew what’s going on.').max(500, 'Keep it under 500 characters.'),
});
