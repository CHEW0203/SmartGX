-- SmartGX — run in Supabase Dashboard → SQL Editor → New query → Run
-- Creates tables, indexes, updated_at triggers, and Row Level Security policies.

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function public.smartgx_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- users_profile (1:1 with auth.users)
-- ---------------------------------------------------------------------------
create table if not exists public.users_profile (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null references auth.users (id) on delete cascade,
  full_name text not null default '',
  email text not null default '',
  phone text not null default '',
  employment_status text not null default 'student',
  monthly_income numeric not null default 0,
  mykad_verified boolean not null default false,
  profile_extras jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (auth_user_id)
);

create index if not exists idx_users_profile_auth_user_id on public.users_profile (auth_user_id);

drop trigger if exists trg_users_profile_updated_at on public.users_profile;
create trigger trg_users_profile_updated_at
  before update on public.users_profile
  for each row execute function public.smartgx_set_updated_at();

-- ---------------------------------------------------------------------------
-- accounts
-- ---------------------------------------------------------------------------
create table if not exists public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  account_no text not null,
  main_balance numeric not null default 0,
  flexi_limit numeric not null default 5000,
  flexi_used numeric not null default 0,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id),
  unique (account_no)
);

create index if not exists idx_accounts_user_id on public.accounts (user_id);

drop trigger if exists trg_accounts_updated_at on public.accounts;
create trigger trg_accounts_updated_at
  before update on public.accounts
  for each row execute function public.smartgx_set_updated_at();

-- ---------------------------------------------------------------------------
-- savings
-- ---------------------------------------------------------------------------
create table if not exists public.savings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  bonus_balance numeric not null default 0,
  emergency_balance numeric not null default 0,
  goals_balance numeric not null default 0,
  allocation_spending_pct numeric not null default 60,
  allocation_bonus_pct numeric not null default 20,
  allocation_emergency_pct numeric not null default 10,
  allocation_goals_pct numeric not null default 10,
  pending_bonus_reward_name text,
  pending_bonus_reward_amount numeric not null default 0,
  pending_bonus_progress numeric not null default 0,
  pending_bonus_target numeric not null default 0,
  round_up_enabled boolean not null default true,
  round_up_total numeric not null default 0,
  round_up_destination text not null default 'bonus',
  use_ai_allocation boolean not null default false,
  savings_state jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id)
);

create index if not exists idx_savings_user_id on public.savings (user_id);

drop trigger if exists trg_savings_updated_at on public.savings;
create trigger trg_savings_updated_at
  before update on public.savings
  for each row execute function public.smartgx_set_updated_at();

-- ---------------------------------------------------------------------------
-- transactions
-- ---------------------------------------------------------------------------
create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  type text not null,
  category text,
  title text not null,
  description text,
  amount numeric not null,
  direction text,
  source text,
  destination text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_transactions_user_id_created on public.transactions (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- latest_activities
-- ---------------------------------------------------------------------------
create table if not exists public.latest_activities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  type text not null,
  title text not null,
  description text,
  amount numeric,
  target_screen text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_latest_activities_user_id on public.latest_activities (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- notifications
-- ---------------------------------------------------------------------------
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  type text not null,
  title text not null,
  message text not null,
  read boolean not null default false,
  target_screen text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_notifications_user_id on public.notifications (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- gxhealth
-- ---------------------------------------------------------------------------
create table if not exists public.gxhealth (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  score numeric not null default 70,
  analysis text,
  recommended_actions jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id)
);

drop trigger if exists trg_gxhealth_updated_at on public.gxhealth;
create trigger trg_gxhealth_updated_at
  before update on public.gxhealth
  for each row execute function public.smartgx_set_updated_at();

-- ---------------------------------------------------------------------------
-- security_settings
-- ---------------------------------------------------------------------------
create table if not exists public.security_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  pin_hash text,
  pin_set boolean not null default false,
  emergency_lock_active boolean not null default false,
  security_score numeric not null default 50,
  trusted_device boolean not null default true,
  wrong_pin_attempts integer not null default 0,
  security_extras jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id)
);

drop trigger if exists trg_security_settings_updated_at on public.security_settings;
create trigger trg_security_settings_updated_at
  before update on public.security_settings
  for each row execute function public.smartgx_set_updated_at();

-- ---------------------------------------------------------------------------
-- flexicredit_accounts
-- ---------------------------------------------------------------------------
create table if not exists public.flexicredit_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'not_applied',
  approved_limit numeric not null default 0,
  available_credit numeric not null default 0,
  used_credit numeric not null default 0,
  annual_interest_rate numeric not null default 6.00,
  auto_repayment_enabled boolean not null default true,
  application_data jsonb not null default '{}'::jsonb,
  documents jsonb not null default '{}'::jsonb,
  flexi_state jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id)
);

drop trigger if exists trg_flexicredit_accounts_updated_at on public.flexicredit_accounts;
create trigger trg_flexicredit_accounts_updated_at
  before update on public.flexicredit_accounts
  for each row execute function public.smartgx_set_updated_at();

-- ---------------------------------------------------------------------------
-- flexicredit_drawdowns
-- ---------------------------------------------------------------------------
create table if not exists public.flexicredit_drawdowns (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  amount numeric not null,
  purpose text not null,
  tenure_months integer not null,
  interest_rate numeric not null,
  estimated_interest numeric not null,
  total_repayment numeric not null,
  monthly_repayment numeric not null,
  remaining_balance numeric not null,
  status text not null default 'active',
  next_due_date date,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_flexi_drawdowns_user on public.flexicredit_drawdowns (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- streaks
-- ---------------------------------------------------------------------------
create table if not exists public.streaks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  current_streak integer not null default 0,
  longest_streak integer not null default 0,
  last_saved_date date,
  saved_this_month numeric not null default 0,
  streak_milestones_claimed jsonb not null default '[]'::jsonb,
  auto_credited_milestones jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id)
);

drop trigger if exists trg_streaks_updated_at on public.streaks;
create trigger trg_streaks_updated_at
  before update on public.streaks
  for each row execute function public.smartgx_set_updated_at();

-- ---------------------------------------------------------------------------
-- streak_days
-- ---------------------------------------------------------------------------
create table if not exists public.streak_days (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  date date not null,
  saved_amount numeric not null default 0,
  sources jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  unique (user_id, date)
);

-- ---------------------------------------------------------------------------
-- money_tree
-- ---------------------------------------------------------------------------
create table if not exists public.money_tree (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  level integer not null default 1,
  exp numeric not null default 0,
  health numeric not null default 70,
  water integer not null default 0,
  smart_score integer not null default 420,
  rank_movement integer not null default 0,
  tree_state text not null default 'healthy',
  score_breakdown jsonb not null default '{}'::jsonb,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id)
);

drop trigger if exists trg_money_tree_updated_at on public.money_tree;
create trigger trg_money_tree_updated_at
  before update on public.money_tree
  for each row execute function public.smartgx_set_updated_at();

-- ---------------------------------------------------------------------------
-- missions
-- ---------------------------------------------------------------------------
create table if not exists public.missions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  mission_id text not null,
  type text not null,
  title text not null,
  progress numeric not null default 0,
  target numeric not null default 1,
  status text not null default 'in_progress',
  reward_water integer not null default 0,
  reward_points integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, mission_id)
);

drop trigger if exists trg_missions_updated_at on public.missions;
create trigger trg_missions_updated_at
  before update on public.missions
  for each row execute function public.smartgx_set_updated_at();

-- ---------------------------------------------------------------------------
-- campaign_progress
-- ---------------------------------------------------------------------------
create table if not exists public.campaign_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  campaign_id text not null,
  progress numeric not null default 0,
  target numeric not null default 1,
  status text not null default 'not_started',
  reward_credited boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, campaign_id)
);

drop trigger if exists trg_campaign_progress_updated_at on public.campaign_progress;
create trigger trg_campaign_progress_updated_at
  before update on public.campaign_progress
  for each row execute function public.smartgx_set_updated_at();

-- ---------------------------------------------------------------------------
-- friends
-- ---------------------------------------------------------------------------
create table if not exists public.friends (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  friend_user_id uuid not null references auth.users (id) on delete cascade,
  friend_snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (user_id, friend_user_id)
);

create index if not exists idx_friends_user on public.friends (user_id);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.users_profile enable row level security;
alter table public.accounts enable row level security;
alter table public.savings enable row level security;
alter table public.transactions enable row level security;
alter table public.latest_activities enable row level security;
alter table public.notifications enable row level security;
alter table public.gxhealth enable row level security;
alter table public.security_settings enable row level security;
alter table public.flexicredit_accounts enable row level security;
alter table public.flexicredit_drawdowns enable row level security;
alter table public.streaks enable row level security;
alter table public.streak_days enable row level security;
alter table public.money_tree enable row level security;
alter table public.missions enable row level security;
alter table public.campaign_progress enable row level security;
alter table public.friends enable row level security;

-- Drop existing policies if re-running
do $$
declare
  r record;
begin
  for r in
    select policyname, tablename
    from pg_policies
    where schemaname = 'public'
      and tablename in (
        'users_profile','accounts','savings','transactions','latest_activities',
        'notifications','gxhealth','security_settings','flexicredit_accounts',
        'flexicredit_drawdowns','streaks','streak_days','money_tree','missions',
        'campaign_progress','friends'
      )
  loop
    execute format('drop policy if exists %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

-- users_profile
create policy users_profile_select on public.users_profile for select using (auth_user_id = auth.uid());
create policy users_profile_insert on public.users_profile for insert with check (auth_user_id = auth.uid());
create policy users_profile_update on public.users_profile for update using (auth_user_id = auth.uid());

-- accounts
create policy accounts_all on public.accounts for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- savings
create policy savings_all on public.savings for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- transactions
create policy transactions_all on public.transactions for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- latest_activities
create policy activities_all on public.latest_activities for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- notifications
create policy notifications_all on public.notifications for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- gxhealth
create policy gxhealth_all on public.gxhealth for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- security_settings
create policy security_all on public.security_settings for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- flexicredit_accounts
create policy flexi_acct_all on public.flexicredit_accounts for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- flexicredit_drawdowns
create policy flexi_draw_all on public.flexicredit_drawdowns for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- streaks
create policy streaks_all on public.streaks for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- streak_days
create policy streak_days_all on public.streak_days for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- money_tree
create policy money_tree_all on public.money_tree for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- missions
create policy missions_all on public.missions for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- campaign_progress
create policy campaigns_all on public.campaign_progress for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- friends (own row as requester)
create policy friends_all on public.friends for all using (user_id = auth.uid()) with check (user_id = auth.uid());
