-- Backstage crew comms (22 Nov 2026). Paste into the Supabase SQL editor and run once.
-- Safe to re-run: every statement is idempotent.

-- Which team a crew member is on (control, artist, production, hospitality, security, runners, stalls, foh, medical).
alter table memberships add column if not exists team text;

-- Quick references shown on the HQ dashboard (set times, contacts, gates, wifi, emergency plan).
alter table events add column if not exists refs jsonb not null default '{}'::jsonb;

-- Team issues reuse the incidents table: which team room raised it, how urgent, who is on it.
alter table incidents add column if not exists team text;
alter table incidents add column if not exists severity text not null default 'normal';
alter table incidents add column if not exists assignee_id text references users(id);
alter table incidents add column if not exists title text;

create index if not exists incidents_event_team on incidents (event_id, team);

-- One live radio (Nexconn group audio call) per team channel, so late joiners can tune in.
create table if not exists radio_sessions (
  event_id text references events(id) on delete cascade,
  team text not null,
  call_id text not null,
  started_by text references users(id),
  started_at timestamptz not null default now(),
  primary key (event_id, team)
);
alter table radio_sessions enable row level security;

-- Demo quick references for the seeded show (edit freely).
update events set refs = '{
  "doors": "18:30",
  "sets": [
    {"time": "19:15", "name": "Opening act"},
    {"time": "20:30", "name": "Raahe (headliner)"},
    {"time": "22:15", "name": "Curfew / house lights"}
  ],
  "contacts": [
    {"role": "Show caller", "name": "Ops lead", "channel": "control"},
    {"role": "Artist liaison", "name": "Artist team lead", "channel": "artist"},
    {"role": "Head of security", "name": "Security lead", "channel": "security"}
  ],
  "notes": [
    "Crew wifi: BACKSTAGE-CREW (ask your lead for the key)",
    "Load-in gate: Gate C (vehicles until 17:30)",
    "Emergency: stop the show only on the show caller''s word. Medical point is next to Gate A."
  ]
}'::jsonb
where slug = 'raahe-live' and refs = '{}'::jsonb;
