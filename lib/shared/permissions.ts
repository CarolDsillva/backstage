import type { Role } from './types';

export type Action =
  | 'phase' | 'approveUpdate' | 'stats'
  | 'crewConsole' | 'proposeUpdate' | 'updateIncident'
  | 'createPoll' | 'answerQuestion';

const RULES: Record<Action, Role[]> = {
  phase: ['lead'],
  approveUpdate: ['lead'],
  stats: ['lead'],
  crewConsole: ['crew', 'lead'],
  proposeUpdate: ['crew', 'lead'],
  updateIncident: ['crew', 'lead'],
  createPoll: ['lead', 'artist'],
  answerQuestion: ['artist', 'lead'],
};

export function can(role: Role, action: Action): boolean {
  return RULES[action].includes(role);
}

export function rolesFor(action: Action): Role[] {
  return RULES[action];
}
