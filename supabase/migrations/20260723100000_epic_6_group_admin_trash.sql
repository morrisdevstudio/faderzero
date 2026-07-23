-- Migration Epic 6: Group administration, logo, soft-delete, and trash management

ALTER TABLE public.workspaces ADD COLUMN IF NOT EXISTS logo_url text;
ALTER TABLE public.workspaces ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- Helper function to normalize workspace name
CREATE OR REPLACE FUNCTION public.normalize_workspace_name(p_name text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF p_name IS NULL THEN
    RETURN NULL;
  END IF;
  -- Trim leading/trailing spaces and collapse multiple spaces into one
  RETURN regexp_replace(trim(p_name), '\s+', ' ', 'g');
END;
$$;

-- Check if workspace name is available (insensitive to case and trimmed spaces)
CREATE OR REPLACE FUNCTION public.check_workspace_name_available(
  p_name text,
  p_exclude_workspace_id uuid DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_normalized text;
  v_count integer;
BEGIN
  v_normalized := public.normalize_workspace_name(p_name);
  IF v_normalized IS NULL OR length(v_normalized) = 0 THEN
    RETURN false;
  END IF;

  SELECT count(*) INTO v_count
  FROM public.workspaces w
  WHERE lower(w.name) = lower(v_normalized)
    AND (p_exclude_workspace_id IS NULL OR w.id <> p_exclude_workspace_id)
    AND (w.deleted_at IS NULL OR w.deleted_at > now() - interval '7 days');

  RETURN (v_count = 0);
END;
$$;

-- Soft delete a workspace (Admin only)
CREATE OR REPLACE FUNCTION public.soft_delete_workspace(p_workspace_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_id uuid;
  v_role text;
  v_type text;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED';
  END IF;

  SELECT role INTO v_role
  FROM public.workspace_members
  WHERE workspace_id = p_workspace_id AND user_id = v_caller_id;

  IF v_role IS NULL OR v_role <> 'admin' THEN
    RAISE EXCEPTION 'WORKSPACE_ADMIN_REQUIRED';
  END IF;

  SELECT workspace_type INTO v_type
  FROM public.workspaces
  WHERE id = p_workspace_id;

  IF v_type = 'personal' THEN
    RAISE EXCEPTION 'PERSONAL_WORKSPACE_DELETE_FORBIDDEN';
  END IF;

  UPDATE public.workspaces
  SET deleted_at = now()
  WHERE id = p_workspace_id;
END;
$$;

-- Restore a soft deleted workspace (Admin only)
CREATE OR REPLACE FUNCTION public.restore_workspace(p_workspace_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_id uuid;
  v_role text;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED';
  END IF;

  SELECT role INTO v_role
  FROM public.workspace_members
  WHERE workspace_id = p_workspace_id AND user_id = v_caller_id;

  IF v_role IS NULL OR v_role <> 'admin' THEN
    RAISE EXCEPTION 'WORKSPACE_ADMIN_REQUIRED';
  END IF;

  UPDATE public.workspaces
  SET deleted_at = NULL
  WHERE id = p_workspace_id;
END;
$$;

-- Purge expired workspaces (dry-run mode supported)
CREATE OR REPLACE FUNCTION public.purge_expired_workspaces(p_dry_run boolean DEFAULT true)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_count integer;
BEGIN
  SELECT count(*) INTO v_count
  FROM public.workspaces
  WHERE deleted_at IS NOT NULL AND deleted_at <= now() - interval '7 days';

  IF NOT p_dry_run THEN
    DELETE FROM public.workspaces
    WHERE deleted_at IS NOT NULL AND deleted_at <= now() - interval '7 days';
  END IF;

  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.normalize_workspace_name(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.check_workspace_name_available(text, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.soft_delete_workspace(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.restore_workspace(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.purge_expired_workspaces(boolean) TO authenticated, service_role;
