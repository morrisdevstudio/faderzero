-- Story 9.4: security advisor remediation for an existing helper.

ALTER FUNCTION public.normalize_workspace_name(TEXT)
    SET search_path = '';
