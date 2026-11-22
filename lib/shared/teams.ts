/** Crew teams. Each team is one Nexconn group channel (and one walkie channel number). */
export const TEAMS = [
  { id: 'control', ch: 1, name: 'Control', short: 'CTRL', color: '#d7ff3a', blurb: 'All hands · show calls · announcements' },
  { id: 'artist', ch: 2, name: 'Artist team', short: 'ARTIST', color: '#ff5fa2', blurb: 'Talent, riders, set changes' },
  { id: 'production', ch: 3, name: 'Production', short: 'PROD', color: '#7aa2ff', blurb: 'Sound, lights, stage, power' },
  { id: 'hospitality', ch: 4, name: 'Hospitality', short: 'HOSP', color: '#ffb547', blurb: 'Green room, catering, guests' },
  { id: 'security', ch: 5, name: 'Security', short: 'SEC', color: '#ff6a4d', blurb: 'Gates, barriers, crowd' },
  { id: 'runners', ch: 6, name: 'Runners', short: 'RUN', color: '#3ef0c4', blurb: 'Fetch, carry, fix fast' },
  { id: 'stalls', ch: 7, name: 'Stalls & vendors', short: 'STALL', color: '#c9a2ff', blurb: 'Food, bar, merch' },
  { id: 'foh', ch: 8, name: 'Front of house', short: 'FOH', color: '#5fd1ff', blurb: 'Tickets, queues, entry' },
  { id: 'medical', ch: 9, name: 'Medical', short: 'MED', color: '#ff4d6d', blurb: 'First aid, welfare' },
] as const;

export type TeamId = (typeof TEAMS)[number]['id'];
export type Team = (typeof TEAMS)[number];

export const TEAM_IDS = TEAMS.map((t) => t.id) as TeamId[];

export function isTeam(v: unknown): v is TeamId {
  return typeof v === 'string' && (TEAM_IDS as string[]).includes(v);
}

export function team(id: string | null | undefined): Team {
  return TEAMS.find((t) => t.id === id) ?? TEAMS[0];
}

/** Context id for a team's channel in the channels table. */
export function teamContext(eventId: string, teamId: TeamId) {
  return `${eventId}${teamId}`;
}

export type Severity = 'normal' | 'urgent' | 'critical';
export const SEVERITIES: { id: Severity; label: string; hint: string }[] = [
  { id: 'normal', label: 'Normal', hint: 'Needs doing soon' },
  { id: 'urgent', label: 'Urgent', hint: 'Affects the show' },
  { id: 'critical', label: 'Critical', hint: 'Safety / stop now' },
];

export function isSeverity(v: unknown): v is Severity {
  return v === 'normal' || v === 'urgent' || v === 'critical';
}

/** Crew issue lifecycle, stored in incidents.status. */
export const ISSUE_STATUS_LABEL: Record<string, string> = {
  new: 'Open', checking: 'On it', verified: 'On it', resolved: 'Fixed',
};

/** Which teams a member can open. Leads (show callers) hear every channel. */
export function channelsFor(role: string, myTeam: string | null, eventTeams?: readonly string[] | null): TeamId[] {
  // An event can run with only some teams (set when it is created). Control is always there.
  const on = (t: TeamId) => t === 'control' || !eventTeams?.length || eventTeams.includes(t);
  if (role === 'lead') return TEAM_IDS.filter(on);
  if (!isTeam(myTeam) || myTeam === 'control' || !on(myTeam)) return ['control'];
  return ['control', myTeam];
}
