UPDATE public.design_icon_roles AS role
SET label = corrected.label,
    version = role.version + 1,
    updated_at = now()
FROM (VALUES
  ('download', 'Télécharger'),
  ('fullscreen', 'Plein écran'),
  ('menu', 'Plus d’actions'),
  ('metronome', 'Métronome'),
  ('settings', 'Réglages'),
  ('stop', 'Arrêt')
) AS corrected(key, label)
WHERE role.key = corrected.key
  AND role.label IS DISTINCT FROM corrected.label;
