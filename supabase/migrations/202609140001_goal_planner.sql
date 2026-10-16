-- Pace: secure, user-scoped persistence for goals and AI-generated plans.
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  timezone text not null default 'UTC',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(trim(title)) between 1 and 240),
  desired_outcome text,
  input_context jsonb not null default '{}'::jsonb,
  plan_summary text,
  estimated_days integer check (estimated_days between 1 and 3650),
  planned_start_date date not null default current_date,
  expected_completion_date date,
  status text not null default 'active' check (status in ('active', 'completed', 'paused', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.plan_versions (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid not null references public.goals(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  version_number integer not null check (version_number > 0),
  generation_kind text not null check (generation_kind in ('initial', 'adjustment')),
  adjustment_reason text,
  plan jsonb not null,
  created_at timestamptz not null default now(),
  unique(goal_id, version_number)
);

create table if not exists public.milestones (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid not null references public.goals(id) on delete cascade,
  plan_version_id uuid references public.plan_versions(id) on delete set null,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(trim(title)) between 1 and 160),
  description text,
  success_criteria text,
  target_day integer check (target_day > 0),
  due_date date,
  position integer not null default 0,
  status text not null default 'upcoming' check (status in ('upcoming', 'active', 'completed')),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid not null references public.goals(id) on delete cascade,
  plan_version_id uuid references public.plan_versions(id) on delete set null,
  milestone_id uuid references public.milestones(id) on delete set null,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(trim(title)) between 1 and 180),
  description text,
  scheduled_day integer check (scheduled_day > 0),
  scheduled_for date,
  estimated_minutes integer check (estimated_minutes between 5 and 720),
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high')),
  position integer not null default 0,
  status text not null default 'pending' check (status in ('pending', 'completed', 'skipped', 'cancelled')),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.progress_events (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid not null references public.goals(id) on delete cascade,
  task_id uuid references public.tasks(id) on delete set null,
  user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null check (event_type in ('task_completed', 'task_reopened', 'plan_generated', 'plan_adjusted', 'note')),
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);

create index if not exists goals_user_status_idx on public.goals(user_id, status, updated_at desc);
create index if not exists tasks_goal_status_schedule_idx on public.tasks(goal_id, status, scheduled_for);
create index if not exists milestones_goal_position_idx on public.milestones(goal_id, position);
create index if not exists progress_events_goal_time_idx on public.progress_events(goal_id, occurred_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, nullif(new.raw_user_meta_data ->> 'full_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke all on function public.handle_new_user() from public;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute procedure public.handle_new_user();

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at before update on public.profiles for each row execute procedure public.set_updated_at();
drop trigger if exists goals_updated_at on public.goals;
create trigger goals_updated_at before update on public.goals for each row execute procedure public.set_updated_at();
drop trigger if exists milestones_updated_at on public.milestones;
create trigger milestones_updated_at before update on public.milestones for each row execute procedure public.set_updated_at();
drop trigger if exists tasks_updated_at on public.tasks;
create trigger tasks_updated_at before update on public.tasks for each row execute procedure public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.goals enable row level security;
alter table public.plan_versions enable row level security;
alter table public.milestones enable row level security;
alter table public.tasks enable row level security;
alter table public.progress_events enable row level security;

grant select, insert, update on public.profiles to authenticated;
grant select, insert, update, delete on public.goals to authenticated;
grant select, insert on public.plan_versions to authenticated;
grant select, insert, update, delete on public.milestones to authenticated;
grant select, insert, update, delete on public.tasks to authenticated;
grant select, insert on public.progress_events to authenticated;

create policy "Users manage their profile" on public.profiles for all to authenticated
using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
create policy "Users manage their goals" on public.goals for all to authenticated
using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users read and create own plan versions" on public.plan_versions for select to authenticated
using ((select auth.uid()) = user_id);
create policy "Users create own plan versions" on public.plan_versions for insert to authenticated
with check (
  (select auth.uid()) = user_id
  and exists (select 1 from public.goals where goals.id = plan_versions.goal_id and goals.user_id = (select auth.uid()))
);
create policy "Users manage own milestones" on public.milestones for all to authenticated
using ((select auth.uid()) = user_id)
with check (
  (select auth.uid()) = user_id
  and exists (select 1 from public.goals where goals.id = milestones.goal_id and goals.user_id = (select auth.uid()))
);
create policy "Users manage own tasks" on public.tasks for all to authenticated
using ((select auth.uid()) = user_id)
with check (
  (select auth.uid()) = user_id
  and exists (select 1 from public.goals where goals.id = tasks.goal_id and goals.user_id = (select auth.uid()))
);
create policy "Users read and create own progress events" on public.progress_events for select to authenticated
using ((select auth.uid()) = user_id);
create policy "Users create own progress events" on public.progress_events for insert to authenticated
with check (
  (select auth.uid()) = user_id
  and exists (select 1 from public.goals where goals.id = progress_events.goal_id and goals.user_id = (select auth.uid()))
);
