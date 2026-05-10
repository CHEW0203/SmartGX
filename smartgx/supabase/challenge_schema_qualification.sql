-- SmartGX Challenge Garden — reward qualification columns (optional normalized reporting)
-- Run after challenge_schema.sql. App also stores qualification in challenge_user_state JSON bundle.

alter table public.challenge_participants
  add column if not exists completed_missions_total integer not null default 0;

alter table public.challenge_participants
  add column if not exists is_reward_qualified boolean not null default false;

alter table public.challenge_participants
  add column if not exists qualification_checked_at timestamptz;

alter table public.challenge_participants
  add column if not exists qualification_details jsonb not null default '{}'::jsonb;

comment on column public.challenge_participants.completed_missions_total is
  'Challenge missions claimed during the challenge window (client-computed at finalize).';
comment on column public.challenge_participants.is_reward_qualified is
  'True if participant met mission, tree level, and Challenge SmartScore thresholds at end.';
comment on column public.challenge_participants.qualification_details is
  'Snapshot: thresholds, checks, missingRequirements (mirrors app StoredRewardQualification).';

create table if not exists public.challenge_qualification_results (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references public.challenges (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  completed_missions integer not null default 0,
  required_missions integer not null default 0,
  tree_level integer not null default 0,
  required_tree_level integer not null default 0,
  smartscore integer not null default 0,
  required_smartscore integer not null default 0,
  is_qualified boolean not null default false,
  checks jsonb not null default '{}'::jsonb,
  evaluated_at timestamptz not null default now(),
  unique (challenge_id, user_id)
);

alter table public.challenge_qualification_results enable row level security;

drop policy if exists challenge_qualification_results_read on public.challenge_qualification_results;
create policy challenge_qualification_results_read on public.challenge_qualification_results
  for select using (
    exists (
      select 1 from public.challenge_participants cp
      where cp.challenge_id = challenge_qualification_results.challenge_id
        and cp.user_id = auth.uid()
    )
  );
