-- Fix 409 Conflict when creating a project:
-- The trigger on_project_created_add_members runs AFTER project insert and adds ALL users
-- (including creator as owner). The function was then inserting the creator again, causing
-- a duplicate key violation. Remove the redundant insert from the function.
CREATE OR REPLACE FUNCTION public.create_project_with_defaults(p_name text, p_description text default null)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_project_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  INSERT INTO public.projects (name, description, created_by)
  VALUES (trim(p_name), nullif(trim(p_description), ''), auth.uid())
  RETURNING id INTO new_project_id;

  -- Creator is added by trigger on_project_created_add_members, no need to insert here

  INSERT INTO public.workflow_columns (project_id, name, kind, position)
  VALUES
    (new_project_id, 'Backlog', 'backlog', 100),
    (new_project_id, 'To Do', 'todo', 200),
    (new_project_id, 'In Progress', 'in_progress', 300),
    (new_project_id, 'Done', 'done', 400);

  RETURN new_project_id;
END;
$$;
