INSERT INTO public.design_icon_roles (key, label, description, icon_name, status)
VALUES
  ('show-password', 'Afficher le mot de passe', 'Révèle temporairement un champ de mot de passe.', 'eye', 'approved'),
  ('hide-password', 'Masquer le mot de passe', 'Masque à nouveau un champ de mot de passe.', 'eye-off', 'approved'),
  ('export-pdf', 'Exporter en PDF', 'Crée et télécharge un document PDF.', 'file-down', 'approved')
ON CONFLICT (key) DO NOTHING;
