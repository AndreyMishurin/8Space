-- =============================================================================
-- Single-tenant mode: auto-add new users to ALL active projects
-- =============================================================================

-- Trigger 1: When a new profile is created (after handle_new_user),
-- automatically add the user to all non-archived projects as 'editor'.
CREATE OR REPLACE FUNCTION public.auto_join_projects()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.project_members (project_id, user_id, role)
  SELECT p.id, NEW.id, 'editor'::project_role
  FROM public.projects p
  WHERE p.archived_at IS NULL
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_profile_created_join_projects
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_join_projects();


-- Trigger 2: When a new project is created,
-- automatically add ALL existing users as members.
-- The project creator gets 'owner' role (already inserted by create_project_with_defaults),
-- everyone else gets 'editor'.
CREATE OR REPLACE FUNCTION public.auto_add_members_to_new_project()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.project_members (project_id, user_id, role)
  SELECT NEW.id, p.id,
    CASE WHEN p.id = NEW.created_by THEN 'owner'::project_role
         ELSE 'editor'::project_role END
  FROM public.profiles p
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_project_created_add_members
  AFTER INSERT ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_add_members_to_new_project();


-- Backfill: add all existing users to all existing active projects
-- (safe to re-run, ON CONFLICT DO NOTHING)
INSERT INTO project_members (project_id, user_id, role)
SELECT p.id, pr.id, 'editor'::project_role
FROM projects p CROSS JOIN profiles pr
WHERE p.archived_at IS NULL
ON CONFLICT DO NOTHING;
