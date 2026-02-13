create extension if not exists pgcrypto;

create type public.project_role as enum ('owner', 'editor', 'viewer');
create type public.task_priority as enum ('p0', 'p1', 'p2');
create type public.workflow_column_kind as enum ('backlog', 'todo', 'in_progress', 'done', 'custom');
create type public.dependency_type as enum ('FS');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default 'User',
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  description text,
  created_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  archived_at timestamptz
);

create table public.project_members (
  project_id uuid not null references public.projects (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.project_role not null,
  joined_at timestamptz not null default now(),
  primary key (project_id, user_id)
);

create table public.workflow_columns (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  kind public.workflow_column_kind not null default 'custom',
  position integer not null,
  wip_limit integer,
  definition_of_done text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, position)
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 240),
  status_column_id uuid not null references public.workflow_columns (id) on delete restrict,
  start_date date,
  due_date date,
  priority public.task_priority not null default 'p1',
  order_rank numeric(18, 6) not null default 1000,
  description text,
  estimate numeric(10, 2),
  is_milestone boolean not null default false,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint task_dates_valid check (
    due_date is null
    or start_date is null
    or due_date >= start_date
  )
);

create table public.task_assignees (
  task_id uuid not null references public.tasks (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (task_id, user_id)
);

create table public.task_labels (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  name text not null,
  color text not null,
  created_at timestamptz not null default now(),
  unique (project_id, name)
);

create table public.task_label_links (
  task_id uuid not null references public.tasks (id) on delete cascade,
  label_id uuid not null references public.task_labels (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (task_id, label_id)
);

create table public.task_checklist_items (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 240),
  is_done boolean not null default false,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.task_attachments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  url text not null,
  title text,
  created_at timestamptz not null default now()
);

create table public.task_dependencies (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  predecessor_task_id uuid not null references public.tasks (id) on delete cascade,
  successor_task_id uuid not null references public.tasks (id) on delete cascade,
  type public.dependency_type not null default 'FS',
  created_at timestamptz not null default now(),
  constraint task_dependency_no_self check (predecessor_task_id <> successor_task_id),
  unique (project_id, predecessor_task_id, successor_task_id, type)
);

create table public.task_activity (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  task_id uuid not null references public.tasks (id) on delete cascade,
  actor_id uuid not null references public.profiles (id) on delete restrict,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index tasks_project_column_rank_idx on public.tasks (project_id, status_column_id, order_rank);
create index tasks_project_due_date_idx on public.tasks (project_id, due_date);
create index task_assignees_user_idx on public.task_assignees (user_id);
create index task_dependencies_project_link_idx on public.task_dependencies (project_id, predecessor_task_id, successor_task_id);
create index project_members_user_idx on public.project_members (user_id);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger touch_profiles_updated_at
before update on public.profiles
for each row execute procedure public.touch_updated_at();

create trigger touch_workflow_columns_updated_at
before update on public.workflow_columns
for each row execute procedure public.touch_updated_at();

create trigger touch_tasks_updated_at
before update on public.tasks
for each row execute procedure public.touch_updated_at();

create trigger touch_task_checklist_updated_at
before update on public.task_checklist_items
for each row execute procedure public.touch_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

create or replace function public.current_project_role(p_project_id uuid)
returns public.project_role
language sql
stable
security definer
set search_path = public
as $$
  select pm.role
  from public.project_members pm
  where pm.project_id = p_project_id
    and pm.user_id = auth.uid();
$$;

create or replace function public.is_project_member(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_project_role(p_project_id) is not null;
$$;

create or replace function public.can_edit_project(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_project_role(p_project_id) in ('owner', 'editor');
$$;

create or replace function public.is_project_owner(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_project_role(p_project_id) = 'owner';
$$;

create or replace function public.create_project_with_defaults(p_name text, p_description text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_project_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  insert into public.projects (name, description, created_by)
  values (trim(p_name), nullif(trim(p_description), ''), auth.uid())
  returning id into new_project_id;

  insert into public.project_members (project_id, user_id, role)
  values (new_project_id, auth.uid(), 'owner');

  insert into public.workflow_columns (project_id, name, kind, position)
  values
    (new_project_id, 'Backlog', 'backlog', 100),
    (new_project_id, 'To Do', 'todo', 200),
    (new_project_id, 'In Progress', 'in_progress', 300),
    (new_project_id, 'Done', 'done', 400);

  return new_project_id;
end;
$$;

create or replace function public.move_task(p_task_id uuid, p_to_column_id uuid, p_new_rank numeric)
returns public.tasks
language plpgsql
security definer
set search_path = public
as $$
declare
  current_task public.tasks;
  target_column public.workflow_columns;
  updated_task public.tasks;
begin
  select * into current_task
  from public.tasks
  where id = p_task_id;

  if not found then
    raise exception 'Task not found';
  end if;

  if not public.can_edit_project(current_task.project_id) then
    raise exception 'Insufficient rights';
  end if;

  select * into target_column
  from public.workflow_columns
  where id = p_to_column_id;

  if not found then
    raise exception 'Target column not found';
  end if;

  if target_column.project_id <> current_task.project_id then
    raise exception 'Task and target column belong to different projects';
  end if;

  update public.tasks
  set status_column_id = p_to_column_id,
      order_rank = p_new_rank,
      updated_at = now()
  where id = p_task_id
  returning * into updated_task;

  insert into public.task_activity (project_id, task_id, actor_id, event_type, payload)
  values (
    current_task.project_id,
    current_task.id,
    auth.uid(),
    'task_moved',
    jsonb_build_object(
      'fromColumnId', current_task.status_column_id,
      'toColumnId', p_to_column_id,
      'orderRank', p_new_rank
    )
  );

  return updated_task;
end;
$$;

create or replace function public.dashboard_metrics(p_project_id uuid, p_days_window int default 14)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  tasks_by_status jsonb := '{}'::jsonb;
  overdue_count integer := 0;
  due_this_week integer := 0;
  workload jsonb := '[]'::jsonb;
  completion_trend jsonb := '[]'::jsonb;
begin
  if not public.is_project_member(p_project_id) then
    raise exception 'Insufficient rights';
  end if;

  select coalesce(jsonb_object_agg(status_key, task_count), '{}'::jsonb)
  into tasks_by_status
  from (
    select wc.kind::text as status_key, count(t.id)::int as task_count
    from public.workflow_columns wc
    left join public.tasks t
      on t.status_column_id = wc.id
    where wc.project_id = p_project_id
    group by wc.kind
  ) stats;

  select count(*)::int
  into overdue_count
  from public.tasks t
  left join public.workflow_columns wc on wc.id = t.status_column_id
  where t.project_id = p_project_id
    and t.due_date is not null
    and t.due_date < current_date
    and coalesce(wc.kind::text, '') <> 'done';

  select count(*)::int
  into due_this_week
  from public.tasks t
  left join public.workflow_columns wc on wc.id = t.status_column_id
  where t.project_id = p_project_id
    and t.due_date between current_date and (current_date + 6)
    and coalesce(wc.kind::text, '') <> 'done';

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'userId', stats.user_id,
        'displayName', stats.display_name,
        'activeCount', stats.active_count
      )
      order by stats.active_count desc
    ),
    '[]'::jsonb
  )
  into workload
  from (
    select
      ta.user_id,
      p.display_name,
      count(*)::int as active_count
    from public.task_assignees ta
    join public.tasks t on t.id = ta.task_id
    join public.workflow_columns wc on wc.id = t.status_column_id
    join public.profiles p on p.id = ta.user_id
    where t.project_id = p_project_id
      and wc.kind <> 'done'
    group by ta.user_id, p.display_name
  ) stats;

  select coalesce(
    jsonb_agg(
      jsonb_build_object('date', day::text, 'doneCount', done_count)
      order by day
    ),
    '[]'::jsonb
  )
  into completion_trend
  from (
    select
      gs.day,
      count(t.id)::int as done_count
    from generate_series(current_date - greatest(p_days_window - 1, 1), current_date, interval '1 day') as gs(day)
    left join public.tasks t
      on t.project_id = p_project_id
     and t.completed_at::date = gs.day
    group by gs.day
    order by gs.day
  ) trend;

  return jsonb_build_object(
    'tasksByStatus', tasks_by_status,
    'overdueCount', overdue_count,
    'dueThisWeek', due_this_week,
    'workloadByAssignee', workload,
    'completionTrend', completion_trend
  );
end;
$$;

alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.project_members enable row level security;
alter table public.workflow_columns enable row level security;
alter table public.tasks enable row level security;
alter table public.task_assignees enable row level security;
alter table public.task_labels enable row level security;
alter table public.task_label_links enable row level security;
alter table public.task_checklist_items enable row level security;
alter table public.task_attachments enable row level security;
alter table public.task_dependencies enable row level security;
alter table public.task_activity enable row level security;

create policy "profiles_select_authenticated"
on public.profiles
for select
to authenticated
using (true);

create policy "profiles_insert_self"
on public.profiles
for insert
to authenticated
with check (id = auth.uid());

create policy "profiles_update_self"
on public.profiles
for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

create policy "projects_select_members"
on public.projects
for select
to authenticated
using (public.is_project_member(id));

create policy "projects_insert_owner"
on public.projects
for insert
to authenticated
with check (created_by = auth.uid());

create policy "projects_update_owner"
on public.projects
for update
to authenticated
using (public.is_project_owner(id))
with check (public.is_project_owner(id));

create policy "projects_delete_owner"
on public.projects
for delete
to authenticated
using (public.is_project_owner(id));

create policy "project_members_select_members"
on public.project_members
for select
to authenticated
using (public.is_project_member(project_id));

create policy "project_members_mutate_owner"
on public.project_members
for all
to authenticated
using (public.is_project_owner(project_id))
with check (public.is_project_owner(project_id));

create policy "workflow_columns_select_members"
on public.workflow_columns
for select
to authenticated
using (public.is_project_member(project_id));

create policy "workflow_columns_mutate_owner"
on public.workflow_columns
for all
to authenticated
using (public.is_project_owner(project_id))
with check (public.is_project_owner(project_id));

create policy "tasks_select_members"
on public.tasks
for select
to authenticated
using (public.is_project_member(project_id));

create policy "tasks_insert_editors"
on public.tasks
for insert
to authenticated
with check (public.can_edit_project(project_id));

create policy "tasks_update_editors"
on public.tasks
for update
to authenticated
using (public.can_edit_project(project_id))
with check (public.can_edit_project(project_id));

create policy "tasks_delete_editors"
on public.tasks
for delete
to authenticated
using (public.can_edit_project(project_id));

create policy "task_assignees_select_members"
on public.task_assignees
for select
to authenticated
using (
  exists (
    select 1
    from public.tasks t
    where t.id = task_assignees.task_id
      and public.is_project_member(t.project_id)
  )
);

create policy "task_assignees_mutate_editors"
on public.task_assignees
for all
to authenticated
using (
  exists (
    select 1
    from public.tasks t
    where t.id = task_assignees.task_id
      and public.can_edit_project(t.project_id)
  )
)
with check (
  exists (
    select 1
    from public.tasks t
    where t.id = task_assignees.task_id
      and public.can_edit_project(t.project_id)
  )
);

create policy "task_labels_select_members"
on public.task_labels
for select
to authenticated
using (public.is_project_member(project_id));

create policy "task_labels_mutate_editors"
on public.task_labels
for all
to authenticated
using (public.can_edit_project(project_id))
with check (public.can_edit_project(project_id));

create policy "task_label_links_select_members"
on public.task_label_links
for select
to authenticated
using (
  exists (
    select 1
    from public.tasks t
    where t.id = task_label_links.task_id
      and public.is_project_member(t.project_id)
  )
);

create policy "task_label_links_mutate_editors"
on public.task_label_links
for all
to authenticated
using (
  exists (
    select 1
    from public.tasks t
    where t.id = task_label_links.task_id
      and public.can_edit_project(t.project_id)
  )
)
with check (
  exists (
    select 1
    from public.tasks t
    where t.id = task_label_links.task_id
      and public.can_edit_project(t.project_id)
  )
);

create policy "task_checklist_select_members"
on public.task_checklist_items
for select
to authenticated
using (
  exists (
    select 1
    from public.tasks t
    where t.id = task_checklist_items.task_id
      and public.is_project_member(t.project_id)
  )
);

create policy "task_checklist_mutate_editors"
on public.task_checklist_items
for all
to authenticated
using (
  exists (
    select 1
    from public.tasks t
    where t.id = task_checklist_items.task_id
      and public.can_edit_project(t.project_id)
  )
)
with check (
  exists (
    select 1
    from public.tasks t
    where t.id = task_checklist_items.task_id
      and public.can_edit_project(t.project_id)
  )
);

create policy "task_attachments_select_members"
on public.task_attachments
for select
to authenticated
using (
  exists (
    select 1
    from public.tasks t
    where t.id = task_attachments.task_id
      and public.is_project_member(t.project_id)
  )
);

create policy "task_attachments_mutate_editors"
on public.task_attachments
for all
to authenticated
using (
  exists (
    select 1
    from public.tasks t
    where t.id = task_attachments.task_id
      and public.can_edit_project(t.project_id)
  )
)
with check (
  exists (
    select 1
    from public.tasks t
    where t.id = task_attachments.task_id
      and public.can_edit_project(t.project_id)
  )
);

create policy "task_dependencies_select_members"
on public.task_dependencies
for select
to authenticated
using (public.is_project_member(project_id));

create policy "task_dependencies_mutate_editors"
on public.task_dependencies
for all
to authenticated
using (public.can_edit_project(project_id))
with check (public.can_edit_project(project_id));

create policy "task_activity_select_members"
on public.task_activity
for select
to authenticated
using (public.is_project_member(project_id));

create policy "task_activity_insert_editors"
on public.task_activity
for insert
to authenticated
with check (public.can_edit_project(project_id));

grant execute on function public.create_project_with_defaults(text, text) to authenticated;
grant execute on function public.move_task(uuid, uuid, numeric) to authenticated;
grant execute on function public.dashboard_metrics(uuid, int) to authenticated;
grant execute on function public.current_project_role(uuid) to authenticated;
grant execute on function public.is_project_member(uuid) to authenticated;
grant execute on function public.can_edit_project(uuid) to authenticated;
grant execute on function public.is_project_owner(uuid) to authenticated;
