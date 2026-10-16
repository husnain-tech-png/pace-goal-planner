-- Explicitly revoke default RPC execution; this trigger-only function must not
-- be exposed through the Data API. Index foreign keys used in plan lifecycle queries.
revoke execute on function public.handle_new_user() from public, anon, authenticated;

create index if not exists plan_versions_user_id_idx on public.plan_versions(user_id);
create index if not exists milestones_plan_version_id_idx on public.milestones(plan_version_id);
create index if not exists milestones_user_id_idx on public.milestones(user_id);
create index if not exists tasks_plan_version_id_idx on public.tasks(plan_version_id);
create index if not exists tasks_milestone_id_idx on public.tasks(milestone_id);
create index if not exists tasks_user_id_idx on public.tasks(user_id);
create index if not exists progress_events_task_id_idx on public.progress_events(task_id);
create index if not exists progress_events_user_id_idx on public.progress_events(user_id);
