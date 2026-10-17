-- Pace: daily habit & focus log for streak tracking.
-- Depends on the auth.users table and public.goals table from the initial migration.

create table if not exists public.daily_logs (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null references auth.users(id) on delete cascade,
  goal_id     uuid        references public.goals(id) on delete cascade,
  title       text        not null check (char_length(trim(title)) between 1 and 300),
  log_date    date        not null default current_date,
  completed   boolean     not null default false,
  minutes_spent integer   not null default 0 check (minutes_spent >= 0),
  notes       text,
  created_at  timestamptz not null default now(),

  unique (user_id, title, log_date)
);

-- Index for quick per-user daily lookups and streak queries
create index if not exists daily_logs_user_date_idx
  on public.daily_logs (user_id, log_date desc);

-- Row Level Security
alter table public.daily_logs enable row level security;

-- Grant CRUD to authenticated role
grant select, insert, update, delete on public.daily_logs to authenticated;

-- Policies: users can only touch their own rows
create policy "Users select own daily logs"
  on public.daily_logs for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users insert own daily logs"
  on public.daily_logs for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users update own daily logs"
  on public.daily_logs for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users delete own daily logs"
  on public.daily_logs for delete to authenticated
  using ((select auth.uid()) = user_id);
