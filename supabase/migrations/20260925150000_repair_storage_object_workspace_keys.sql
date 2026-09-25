-- Every logical key is scoped to the workspace that owns its catalog record.
-- Older imported records can carry the source workspace prefix, which prevents
-- the storage Worker from reading them for the destination workspace.
UPDATE public.storage_objects
SET logical_key = regexp_replace(
  logical_key,
  '^workspaces/[^/]+/',
  'workspaces/' || workspace_id::text || '/'
),
updated_at = now()
WHERE logical_key ~ '^workspaces/[0-9a-f-]+/'
  AND logical_key !~ ('^workspaces/' || workspace_id::text || '/');

UPDATE public.song_assets AS assets
SET storage_path = objects.logical_key,
    updated_at = now()
FROM public.storage_objects AS objects
WHERE assets.storage_object_id = objects.id
  AND assets.workspace_id = objects.workspace_id
  AND assets.storage_path <> objects.logical_key;

UPDATE public.epk_assets AS assets
SET storage_path = objects.logical_key,
    updated_at = now()
FROM public.storage_objects AS objects,
     public.epks AS epks
WHERE epks.id = assets.epk_id
  AND assets.storage_object_id = objects.id
  AND epks.workspace_id = objects.workspace_id
  AND assets.storage_path <> objects.logical_key;
