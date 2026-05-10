-- SmartGX — Friend Challenge / Challenge Garden
-- Run after schema.sql. Adds dedicated challenge storage (isolated from money_tree).

-- ---------------------------------------------------------------------------
-- challenge_user_state — per-user JSON bundle (prototype sync; full tree in app)
-- ---------------------------------------------------------------------------
create table if not exists public.challenge_user_state (
  user_id uuid primary key references auth.users (id) on delete cascade,
  bundle jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_challenge_user_state_updated_at on public.challenge_user_state;
create trigger trg_challenge_user_state_updated_at
  before update on public.challenge_user_state
  for each row execute function public.smartgx_set_updated_at();

-- ---------------------------------------------------------------------------
-- Normalized challenge tables (for future server-side logic / reporting)
-- ---------------------------------------------------------------------------
create table if not exists public.challenges (
  id uuid primary key default gen_random_uuid(),
  creator_user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  duration_days integer not null,
  start_date date not null,
  end_date date not null,
  status text not null default 'pending',
  reward_config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_challenges_updated_at on public.challenges;
create trigger trg_challenges_updated_at
  before update on public.challenges
  for each row execute function public.smartgx_set_updated_at();

create table if not exists public.challenge_participants (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references public.challenges (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  invite_status text not null default 'accepted',
  joined_at timestamptz not null default now(),
  challenge_tree_level integer not null default 0,
  challenge_tree_exp numeric not null default 0,
  challenge_water integer not null default 0,
  challenge_smartscore integer not null default 0,
  final_challenge_score numeric not null default 0,
  current_rank integer,
  full_completion_streak integer not null default 0,
  last_full_completion_date date,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (challenge_id, user_id)
);

drop trigger if exists trg_challenge_participants_updated_at on public.challenge_participants;
create trigger trg_challenge_participants_updated_at
  before update on public.challenge_participants
  for each row execute function public.smartgx_set_updated_at();

create table if not exists public.challenge_daily_missions (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references public.challenges (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  mission_date date not null,
  mission_key text not null,
  title text not null,
  description text not null,
  mission_type text not null,
  target_value numeric not null default 1,
  progress_value numeric not null default 0,
  status text not null default 'in_progress',
  reward_water integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (challenge_id, user_id, mission_date, mission_key)
);

drop trigger if exists trg_challenge_daily_missions_updated_at on public.challenge_daily_missions;
create trigger trg_challenge_daily_missions_updated_at
  before update on public.challenge_daily_missions
  for each row execute function public.smartgx_set_updated_at();

create table if not exists public.challenge_daily_progress (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references public.challenges (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  date date not null,
  completed_mission_count integer not null default 0,
  all_five_completed boolean not null default false,
  daily_bonus_granted boolean not null default false,
  streak_bonus_granted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (challenge_id, user_id, date)
);

drop trigger if exists trg_challenge_daily_progress_updated_at on public.challenge_daily_progress;
create trigger trg_challenge_daily_progress_updated_at
  before update on public.challenge_daily_progress
  for each row execute function public.smartgx_set_updated_at();

create table if not exists public.challenge_level_events (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references public.challenges (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  old_level integer not null,
  new_level integer not null,
  rank_before integer,
  rank_after integer,
  created_at timestamptz not null default now()
);

create table if not exists public.challenge_rewards (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references public.challenges (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  rank integer not null,
  reward_amount numeric not null,
  reward_bucket text not null default 'bonus',
  credited boolean not null default false,
  credited_at timestamptz,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.challenge_user_state enable row level security;
alter table public.challenges enable row level security;
alter table public.challenge_participants enable row level security;
alter table public.challenge_daily_missions enable row level security;
alter table public.challenge_daily_progress enable row level security;
alter table public.challenge_level_events enable row level security;
alter table public.challenge_rewards enable row level security;

drop policy if exists challenge_user_state_own on public.challenge_user_state;
create policy challenge_user_state_own on public.challenge_user_state
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists challenges_participant_read on public.challenges;
create policy challenges_participant_read on public.challenges
  for select using (
    exists (
      select 1 from public.challenge_participants cp
      where cp.challenge_id = challenges.id and cp.user_id = auth.uid()
    )
    or creator_user_id = auth.uid()
  );

drop policy if exists challenges_creator_write on public.challenges;
create policy challenges_creator_write on public.challenges
  for insert with check (creator_user_id = auth.uid());

drop policy if exists challenges_creator_update on public.challenges;
create policy challenges_creator_update on public.challenges
  for update using (creator_user_id = auth.uid());

drop policy if exists challenge_participants_own on public.challenge_participants;
create policy challenge_participants_own on public.challenge_participants
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists challenge_missions_own on public.challenge_daily_missions;
create policy challenge_missions_own on public.challenge_daily_missions
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists challenge_progress_own on public.challenge_daily_progress;
create policy challenge_progress_own on public.challenge_daily_progress
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists challenge_level_events_read on public.challenge_level_events;
create policy challenge_level_events_read on public.challenge_level_events
  for select using (
    exists (
      select 1 from public.challenge_participants cp
      where cp.challenge_id = challenge_level_events.challenge_id and cp.user_id = auth.uid()
    )
  );

drop policy if exists challenge_level_events_insert on public.challenge_level_events;
create policy challenge_level_events_insert on public.challenge_level_events
  for insert with check (user_id = auth.uid());

drop policy if exists challenge_rewards_own on public.challenge_rewards;
create policy challenge_rewards_own on public.challenge_rewards
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
