export type Role = 'attendee' | 'crew' | 'lead' | 'artist';
export type Phase = 'before' | 'live' | 'after';

export type PlaceKind =
  | 'stage' | 'bar' | 'toilet' | 'exit' | 'entry' | 'merch' | 'firstaid' | 'water' | 'barrier';

export type Place = { id: string; name: string; kind: PlaceKind; x: number; y: number };

export type ConditionStatus = 'ok' | 'limited' | 'closed';

export type Condition = {
  placeId: string;
  status: ConditionStatus;
  notice: string;
  approvedBy: string; // display name of the lead
  approvedAt: string; // ISO
  expiresAt: string | null;
};

export type CardType = 'poll' | 'song' | 'meetup' | 'carpool' | 'question';

export type Card = {
  id: string;
  eventId: string;
  type: CardType;
  authorId: string;
  authorName: string;
  payload: Record<string, unknown>;
  createdAt: string;
  votes: string[]; // userIds; poll votes are "userId:optionIndex"
};

export type IncidentStatus = 'new' | 'checking' | 'verified' | 'resolved';
export type IncidentCategory = 'lost_item' | 'lost_group' | 'place_problem' | 'help';

export type Incident = {
  id: string;
  eventId: string;
  placeId: string | null;
  category: IncidentCategory;
  note: string;
  status: IncidentStatus;
  reporterId: string;
  reporterName: string;
  channelId: string;
  createdAt: string;
  /** Crew issues only. */
  team?: string | null;
  severity?: string;
  title?: string | null;
  assigneeId?: string | null;
  assigneeName?: string | null;
};

export type ProposalState = 'pending' | 'approved' | 'rejected';

export type Proposal = {
  id: string;
  incidentId: string;
  placeId: string;
  status: ConditionStatus;
  notice: string;
  expiresMins: number;
  state: ProposalState;
  source: 'ai' | 'fallback';
  decidedBy: string | null;
  decidedAt: string | null;
};

export type EventRow = {
  id: string;
  slug: string;
  title: string;
  artist: string;
  venue: string;
  startsAt: string;
  endsAt: string;
  phaseOverride: Phase | null;
  /** Quick references for the crew HQ (set times, contacts, notes). */
  refs?: EventRefs;
};

export type EventRefs = {
  doors?: string;
  sets?: { time: string; name: string }[];
  contacts?: { role: string; name: string; channel?: string }[];
  notes?: string[];
  /** Server-only: read-only viewer code (stripped by publicEvent). */
  viewerCode?: string;
  /** Number of pre-joined read-only viewer accounts (rv_01..). */
  viewerPool?: number;
  /** Demo event: anyone can enter by picking a role, and scripted demo crew keep it busy. */
  demo?: boolean;
  /** Short label for the event card (e.g. "Mumbai · Tonight"). */
  tagline?: string;
};

/** Custom Nexconn message types. Registered on the client before connect. */
export const BS_TYPES = {
  poll: 'BS:Poll',
  song: 'BS:SongReq',
  meetup: 'BS:Meetup',
  carpool: 'BS:Carpool',
  question: 'BS:Question',
  incident: 'BS:Incident',
  proposal: 'BS:Proposal',
  announce: 'BS:Announce',
  state: 'BS:State',
  /** Crew: an issue raised in a team room (also shown on the HQ map/feed). */
  issue: 'BS:Issue',
  /** Crew: someone took an issue or fixed it. */
  issueUpdate: 'BS:IssueUpd',
  /** Crew: a team's radio (Nexconn group audio call) went live or off air. */
  radio: 'BS:Radio',
} as const;

export const CARD_MESSAGE_TYPE: Record<CardType, string> = {
  poll: BS_TYPES.poll,
  song: BS_TYPES.song,
  meetup: BS_TYPES.meetup,
  carpool: BS_TYPES.carpool,
  question: BS_TYPES.question,
};

export type StateSignal = { kind: 'event' | 'card' | 'conditions' | 'incident' | 'proposal' | 'crew'; id?: string };

/** Server-side sender id for system messages posted into rooms. */
export const SYSTEM_USER_ID = 'backstagebot';
