-- Seed users (password for all demo users: password123)
insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  confirmation_token,
  email_change,
  email_change_token_new,
  recovery_token
)
values
  (
    '00000000-0000-0000-0000-000000000000',
    '11111111-1111-1111-1111-111111111111',
    'authenticated',
    'authenticated',
    'owner@gantt.local',
    crypt('password123', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"name":"Olivia Owner"}',
    now(),
    now(),
    '',
    '',
    '',
    ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '22222222-2222-2222-2222-222222222222',
    'authenticated',
    'authenticated',
    'editor@gantt.local',
    crypt('password123', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"name":"Ethan Editor"}',
    now(),
    now(),
    '',
    '',
    '',
    ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '33333333-3333-3333-3333-333333333333',
    'authenticated',
    'authenticated',
    'viewer@gantt.local',
    crypt('password123', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"name":"Vera Viewer"}',
    now(),
    now(),
    '',
    '',
    '',
    ''
  )
on conflict (id) do nothing;

insert into auth.identities (
  id,
  user_id,
  provider_id,
  identity_data,
  provider,
  last_sign_in_at,
  created_at,
  updated_at
)
values
  (
    gen_random_uuid(),
    '11111111-1111-1111-1111-111111111111',
    'owner@gantt.local',
    '{"sub":"11111111-1111-1111-1111-111111111111","email":"owner@gantt.local"}'::jsonb,
    'email',
    now(),
    now(),
    now()
  ),
  (
    gen_random_uuid(),
    '22222222-2222-2222-2222-222222222222',
    'editor@gantt.local',
    '{"sub":"22222222-2222-2222-2222-222222222222","email":"editor@gantt.local"}'::jsonb,
    'email',
    now(),
    now(),
    now()
  ),
  (
    gen_random_uuid(),
    '33333333-3333-3333-3333-333333333333',
    'viewer@gantt.local',
    '{"sub":"33333333-3333-3333-3333-333333333333","email":"viewer@gantt.local"}'::jsonb,
    'email',
    now(),
    now(),
    now()
  )
on conflict (provider, provider_id) do nothing;

insert into public.profiles (id, display_name)
values
  ('11111111-1111-1111-1111-111111111111', 'Olivia Owner'),
  ('22222222-2222-2222-2222-222222222222', 'Ethan Editor'),
  ('33333333-3333-3333-3333-333333333333', 'Vera Viewer')
on conflict (id) do update set display_name = excluded.display_name;

insert into public.tenants (id, name, slug, created_by)
values (
  '88888888-8888-8888-8888-888888888888',
  '8Space Demo',
  'demo-space',
  '11111111-1111-1111-1111-111111111111'
)
on conflict (id) do update
set
  name = excluded.name,
  slug = excluded.slug,
  created_by = excluded.created_by;

insert into public.tenant_members (tenant_id, user_id, role)
values
  ('88888888-8888-8888-8888-888888888888', '11111111-1111-1111-1111-111111111111', 'owner'),
  ('88888888-8888-8888-8888-888888888888', '22222222-2222-2222-2222-222222222222', 'admin'),
  ('88888888-8888-8888-8888-888888888888', '33333333-3333-3333-3333-333333333333', 'member')
on conflict (tenant_id, user_id) do update
set role = excluded.role;

insert into public.projects (id, tenant_id, name, description, created_by)
values (
  '44444444-4444-4444-4444-444444444444',
  '88888888-8888-8888-8888-888888888888',
  'Product Launch Q2',
  'Demo project seeded for local MVP environment',
  '11111111-1111-1111-1111-111111111111'
)
on conflict (id) do nothing;

insert into public.project_members (project_id, user_id, role)
values
  ('44444444-4444-4444-4444-444444444444', '11111111-1111-1111-1111-111111111111', 'owner'),
  ('44444444-4444-4444-4444-444444444444', '22222222-2222-2222-2222-222222222222', 'editor'),
  ('44444444-4444-4444-4444-444444444444', '33333333-3333-3333-3333-333333333333', 'viewer')
on conflict (project_id, user_id) do nothing;

insert into public.workflow_columns (id, project_id, name, kind, position, definition_of_done)
values
  ('55555555-5555-5555-5555-555555555551', '44444444-4444-4444-4444-444444444444', 'Backlog', 'backlog', 100, null),
  ('55555555-5555-5555-5555-555555555552', '44444444-4444-4444-4444-444444444444', 'To Do', 'todo', 200, null),
  ('55555555-5555-5555-5555-555555555553', '44444444-4444-4444-4444-444444444444', 'In Progress', 'in_progress', 300, 'Code merged and test plan ready'),
  ('55555555-5555-5555-5555-555555555554', '44444444-4444-4444-4444-444444444444', 'Done', 'done', 400, 'Released and monitored for 24h')
on conflict (id) do nothing;

insert into public.task_labels (id, project_id, name, color)
values
  ('77777777-7777-7777-7777-777777777771', '44444444-4444-4444-4444-444444444444', 'Frontend', '#3b82f6'),
  ('77777777-7777-7777-7777-777777777772', '44444444-4444-4444-4444-444444444444', 'Backend', '#10b981'),
  ('77777777-7777-7777-7777-777777777773', '44444444-4444-4444-4444-444444444444', 'Urgent', '#ef4444')
on conflict (id) do nothing;

insert into public.tasks (
  id,
  project_id,
  title,
  status_column_id,
  start_date,
  due_date,
  priority,
  order_rank,
  description,
  is_milestone,
  completed_at,
  created_at,
  updated_at
)
values
  (
    '66666666-6666-6666-6666-666666666661',
    '44444444-4444-4444-4444-444444444444',
    'Define release scope',
    '55555555-5555-5555-5555-555555555552',
    current_date,
    current_date + 2,
    'p1',
    1000,
    'Align team on launch scope and acceptance criteria.',
    false,
    null,
    now() - interval '4 days',
    now() - interval '2 days'
  ),
  (
    '66666666-6666-6666-6666-666666666662',
    '44444444-4444-4444-4444-444444444444',
    'Backend hardening',
    '55555555-5555-5555-5555-555555555553',
    current_date - 1,
    current_date + 4,
    'p0',
    2000,
    'Optimize slow endpoints and add retries.',
    false,
    null,
    now() - interval '5 days',
    now() - interval '1 day'
  ),
  (
    '66666666-6666-6666-6666-666666666663',
    '44444444-4444-4444-4444-444444444444',
    'Landing hero polish',
    '55555555-5555-5555-5555-555555555551',
    null,
    current_date + 6,
    'p2',
    3000,
    'Visual polish and copy review for hero section.',
    false,
    null,
    now() - interval '3 days',
    now() - interval '3 days'
  ),
  (
    '66666666-6666-6666-6666-666666666664',
    '44444444-4444-4444-4444-444444444444',
    'Launch milestone',
    '55555555-5555-5555-5555-555555555554',
    current_date + 7,
    current_date + 7,
    'p1',
    4000,
    'Public release date marker.',
    true,
    null,
    now() - interval '2 days',
    now() - interval '2 days'
  ),
  (
    '66666666-6666-6666-6666-666666666665',
    '44444444-4444-4444-4444-444444444444',
    'Test checklist complete',
    '55555555-5555-5555-5555-555555555554',
    current_date - 5,
    current_date - 2,
    'p1',
    5000,
    'Regression checklist done.',
    false,
    now() - interval '1 day',
    now() - interval '8 days',
    now() - interval '1 day'
  )
on conflict (id) do nothing;

insert into public.task_assignees (task_id, user_id)
values
  ('66666666-6666-6666-6666-666666666661', '11111111-1111-1111-1111-111111111111'),
  ('66666666-6666-6666-6666-666666666662', '22222222-2222-2222-2222-222222222222'),
  ('66666666-6666-6666-6666-666666666663', '11111111-1111-1111-1111-111111111111'),
  ('66666666-6666-6666-6666-666666666663', '22222222-2222-2222-2222-222222222222')
on conflict (task_id, user_id) do nothing;

insert into public.task_label_links (task_id, label_id)
values
  ('66666666-6666-6666-6666-666666666661', '77777777-7777-7777-7777-777777777771'),
  ('66666666-6666-6666-6666-666666666662', '77777777-7777-7777-7777-777777777772'),
  ('66666666-6666-6666-6666-666666666662', '77777777-7777-7777-7777-777777777773')
on conflict (task_id, label_id) do nothing;

insert into public.task_checklist_items (task_id, title, is_done, position)
values
  ('66666666-6666-6666-6666-666666666662', 'Add retries around billing API', true, 1),
  ('66666666-6666-6666-6666-666666666662', 'Profile /dashboard endpoint', false, 2)
on conflict do nothing;

insert into public.task_dependencies (project_id, predecessor_task_id, successor_task_id, type)
values
  ('44444444-4444-4444-4444-444444444444', '66666666-6666-6666-6666-666666666661', '66666666-6666-6666-6666-666666666662', 'FS'),
  ('44444444-4444-4444-4444-444444444444', '66666666-6666-6666-6666-666666666662', '66666666-6666-6666-6666-666666666664', 'FS')
on conflict (project_id, predecessor_task_id, successor_task_id, type) do nothing;
