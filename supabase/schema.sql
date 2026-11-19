-- Backstage schema. Run in the Supabase SQL editor. All access is server-side with the service key.
create table if not exists events (
  id text primary key,
  slug text unique not null,
  title text not null,
  artist text not null,
  venue text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  phase_override text check (phase_override in ('before','live','after')),
  crew_code text not null,
  lead_code text not null,
  artist_code text not null
);

create table if not exists users (
  id text primary key,
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists memberships (
  event_id text references events(id) on delete cascade,
  user_id text references users(id) on delete cascade,
  role text not null check (role in ('attendee','crew','lead','artist')),
  joined_at timestamptz not null default now(),
  primary key (event_id, user_id)
);

create table if not exists channels (
  context_type text not null,
  context_id text not null,
  channel_id text not null unique,
  created_at timestamptz not null default now(),
  primary key (context_type, context_id)
);

create table if not exists places (
  id text not null,
  event_id text references events(id) on delete cascade,
  name text not null,
  kind text not null,
  x real not null,
  y real not null,
  primary key (event_id, id)
);

create table if not exists conditions (
  event_id text references events(id) on delete cascade,
  place_id text not null,
  status text not null check (status in ('ok','limited','closed')),
  notice text not null,
  approved_by text not null,
  approved_at timestamptz not null,
  expires_at timestamptz,
  primary key (event_id, place_id)
);

create table if not exists incidents (
  id text primary key,
  event_id text references events(id) on delete cascade,
  place_id text,
  category text not null,
  note text not null,
  status text not null default 'new',
  reporter_id text references users(id),
  channel_id text not null,
  created_at timestamptz not null default now(),
  verified_at timestamptz,
  resolved_at timestamptz
);

create table if not exists incident_updates (
  id bigserial primary key,
  incident_id text references incidents(id) on delete cascade,
  actor_id text references users(id),
  kind text not null,
  old text,
  new text,
  created_at timestamptz not null default now()
);

create table if not exists proposals (
  id text primary key,
  incident_id text references incidents(id) on delete cascade,
  place_id text not null,
  status text not null,
  notice text not null,
  expires_mins int not null,
  state text not null default 'pending',
  source text not null,
  decided_by text,
  decided_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists cards (
  id text primary key,
  event_id text references events(id) on delete cascade,
  type text not null,
  author_id text references users(id),
  payload jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists card_votes (
  card_id text references cards(id) on delete cascade,
  user_id text not null,
  value text not null default '',
  created_at timestamptz not null default now(),
  primary key (card_id, user_id)
);

create table if not exists fan_optins (
  event_id text references events(id) on delete cascade,
  user_id text references users(id),
  created_at timestamptz not null default now(),
  primary key (event_id, user_id)
);

create table if not exists feedback (
  event_id text references events(id) on delete cascade,
  user_id text references users(id),
  rating int not null check (rating between 1 and 5),
  quote text,
  created_at timestamptz not null default now(),
  primary key (event_id, user_id)
);

create table if not exists activity (
  event_id text references events(id) on delete cascade,
  user_id text references users(id),
  messages int not null default 0,
  last_at timestamptz not null default now(),
  primary key (event_id, user_id)
);

-- Atomic message counter used by /api/activity
create or replace function bump_activity(p_event text, p_user text, p_n int)
returns void language sql as $$
  insert into activity(event_id, user_id, messages, last_at) values (p_event, p_user, p_n, now())
  on conflict (event_id, user_id) do update set messages = activity.messages + p_n, last_at = now();
$$;

-- Lock everything to the service role (no anon access).
alter table events enable row level security;
alter table users enable row level security;
alter table memberships enable row level security;
alter table channels enable row level security;
alter table places enable row level security;
alter table conditions enable row level security;
alter table incidents enable row level security;
alter table incident_updates enable row level security;
alter table proposals enable row level security;
alter table cards enable row level security;
alter table card_votes enable row level security;
alter table fan_optins enable row level security;
alter table feedback enable row level security;
alter table activity enable row level security;
