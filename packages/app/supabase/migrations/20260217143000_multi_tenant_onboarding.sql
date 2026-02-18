-- =============================================================================
-- Multi-tenant model with tenant onboarding support
-- =============================================================================

create type public.tenant_role as enum ('owner', 'admin', 'member');

create table public.tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  created_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  archived_at timestamptz
);

create table public.tenant_members (
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.tenant_role not null,
  joined_at timestamptz not null default now(),
  primary key (tenant_id, user_id)
);

create index tenant_members_user_idx on public.tenant_members (user_id);

alter table public.projects
  add column tenant_id uuid references public.tenants (id) on delete cascade;

create index projects_tenant_idx on public.projects (tenant_id);

create temporary table project_tenant_map (
  project_id uuid primary key,
  tenant_id uuid not null
) on commit drop;

insert into project_tenant_map (project_id, tenant_id)
select p.id, gen_random_uuid()
from public.projects p;

insert into public.tenants (id, name, slug, created_by, created_at)
select
  map.tenant_id,
  case
    when char_length(trim(p.name)) = 0 then 'Workspace'
    else trim(p.name) || ' Space'
  end,
  'space-' || replace(p.id::text, '-', ''),
  p.created_by,
  p.created_at
from public.projects p
join project_tenant_map map on map.project_id = p.id
on conflict (slug) do nothing;

update public.projects p
set tenant_id = map.tenant_id
from project_tenant_map map
where map.project_id = p.id;

insert into public.tenant_members (tenant_id, user_id, role, joined_at)
select distinct
  map.tenant_id,
  pm.user_id,
  case
    when pm.role = 'owner' then 'owner'::public.tenant_role
    when pm.role = 'editor' then 'admin'::public.tenant_role
    else 'member'::public.tenant_role
  end,
  pm.joined_at
from public.project_members pm
join project_tenant_map map on map.project_id = pm.project_id
on conflict (tenant_id, user_id) do update
set role = excluded.role;

insert into public.tenant_members (tenant_id, user_id, role)
select
  map.tenant_id,
  p.created_by,
  'owner'::public.tenant_role
from public.projects p
join project_tenant_map map on map.project_id = p.id
on conflict (tenant_id, user_id) do update
set role = 'owner'::public.tenant_role;

alter table public.projects
  alter column tenant_id set not null;

create or replace function public.normalize_tenant_slug(p_value text)
returns text
language plpgsql
immutable
as $$
declare
  candidate text;
begin
  candidate := lower(coalesce(trim(p_value), ''));
  candidate := regexp_replace(candidate, '[^a-z0-9]+', '-', 'g');
  candidate := regexp_replace(candidate, '(^-|-$)', '', 'g');

  if candidate = '' then
    return 'space';
  end if;

  return candidate;
end;
$$;

create or replace function public.current_tenant_role(p_tenant_id uuid)
returns public.tenant_role
language sql
stable
security definer
set search_path = public
as $$
  select tm.role
  from public.tenant_members tm
  where tm.tenant_id = p_tenant_id
    and tm.user_id = auth.uid();
$$;

create or replace function public.is_tenant_member(p_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_tenant_role(p_tenant_id) is not null;
$$;

create or replace function public.is_tenant_owner(p_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_tenant_role(p_tenant_id) = 'owner';
$$;

create or replace function public.current_project_role(p_project_id uuid)
returns public.project_role
language sql
stable
security definer
set search_path = public
as $$
  select pm.role
  from public.projects p
  join public.project_members pm
    on pm.project_id = p.id
   and pm.user_id = auth.uid()
  join public.tenant_members tm
    on tm.tenant_id = p.tenant_id
   and tm.user_id = auth.uid()
  where p.id = p_project_id;
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

create or replace function public.create_tenant_with_owner(p_name text, p_slug text default null)
returns public.tenants
language plpgsql
security definer
set search_path = public
as $$
declare
  created public.tenants;
  base_slug text;
  candidate_slug text;
  suffix integer := 2;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if p_name is null or char_length(trim(p_name)) = 0 then
    raise exception 'Tenant name is required';
  end if;

  base_slug := public.normalize_tenant_slug(coalesce(nullif(trim(p_slug), ''), p_name));
  candidate_slug := base_slug;

  loop
    begin
      insert into public.tenants (name, slug, created_by)
      values (trim(p_name), candidate_slug, auth.uid())
      returning * into created;

      exit;
    exception
      when unique_violation then
        candidate_slug := base_slug || '-' || suffix::text;
        suffix := suffix + 1;
    end;
  end loop;

  insert into public.tenant_members (tenant_id, user_id, role)
  values (created.id, auth.uid(), 'owner')
  on conflict (tenant_id, user_id) do update
  set role = 'owner';

  return created;
end;
$$;

drop function if exists public.create_project_with_defaults(text, text);

create or replace function public.create_project_with_defaults(
  p_tenant_slug text,
  p_name text,
  p_description text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_project_id uuid;
  target_tenant_id uuid;
  tenant_role public.tenant_role;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if p_tenant_slug is null or char_length(trim(p_tenant_slug)) = 0 then
    raise exception 'Tenant slug is required';
  end if;

  select t.id
    into target_tenant_id
  from public.tenants t
  where t.slug = trim(lower(p_tenant_slug))
    and t.archived_at is null;

  if target_tenant_id is null then
    raise exception 'Tenant not found';
  end if;

  select tm.role
    into tenant_role
  from public.tenant_members tm
  where tm.tenant_id = target_tenant_id
    and tm.user_id = auth.uid();

  if tenant_role is null then
    raise exception 'Insufficient rights';
  end if;

  insert into public.projects (tenant_id, name, description, created_by)
  values (target_tenant_id, trim(p_name), nullif(trim(p_description), ''), auth.uid())
  returning id into new_project_id;

  insert into public.project_members (project_id, user_id, role)
  select
    new_project_id,
    tm.user_id,
    case
      when tm.user_id = auth.uid() then 'owner'::public.project_role
      when tm.role in ('owner', 'admin') then 'editor'::public.project_role
      else 'viewer'::public.project_role
    end
  from public.tenant_members tm
  where tm.tenant_id = target_tenant_id
  on conflict (project_id, user_id) do nothing;

  insert into public.workflow_columns (project_id, name, kind, position)
  values
    (new_project_id, 'Backlog', 'backlog', 100),
    (new_project_id, 'To Do', 'todo', 200),
    (new_project_id, 'In Progress', 'in_progress', 300),
    (new_project_id, 'Done', 'done', 400);

  return new_project_id;
end;
$$;

alter table public.tenants enable row level security;
alter table public.tenant_members enable row level security;

drop policy if exists "projects_insert_owner" on public.projects;

create policy "projects_insert_owner"
on public.projects
for insert
to authenticated
with check (
  created_by = auth.uid()
  and public.is_tenant_member(tenant_id)
);

create policy "tenants_select_members"
on public.tenants
for select
to authenticated
using (public.is_tenant_member(id));

create policy "tenants_insert_owner"
on public.tenants
for insert
to authenticated
with check (created_by = auth.uid());

create policy "tenants_update_owner"
on public.tenants
for update
to authenticated
using (public.is_tenant_owner(id))
with check (public.is_tenant_owner(id));

create policy "tenants_delete_owner"
on public.tenants
for delete
to authenticated
using (public.is_tenant_owner(id));

create policy "tenant_members_select_members"
on public.tenant_members
for select
to authenticated
using (public.is_tenant_member(tenant_id));

create policy "tenant_members_mutate_owner"
on public.tenant_members
for all
to authenticated
using (public.is_tenant_owner(tenant_id))
with check (public.is_tenant_owner(tenant_id));

grant execute on function public.current_tenant_role(uuid) to authenticated;
grant execute on function public.is_tenant_member(uuid) to authenticated;
grant execute on function public.is_tenant_owner(uuid) to authenticated;
grant execute on function public.create_tenant_with_owner(text, text) to authenticated;
grant execute on function public.create_project_with_defaults(text, text, text) to authenticated;

drop trigger if exists on_profile_created_join_projects on public.profiles;
drop trigger if exists on_project_created_add_members on public.projects;

drop function if exists public.auto_join_projects();
drop function if exists public.auto_add_members_to_new_project();
