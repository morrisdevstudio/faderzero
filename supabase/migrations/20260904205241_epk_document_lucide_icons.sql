INSERT INTO public.design_icon_roles (key, label, description, icon_name, status)
VALUES
  ('clipboard-list', 'Liste', 'Icône de liste pour un document EPK.', 'clipboard-list', 'approved'),
  ('list-checks', 'Checklist', 'Icône de checklist pour un document EPK.', 'list-checks', 'approved'),
  ('wrench', 'Technique', 'Icône technique pour un document EPK.', 'wrench', 'approved'),
  ('cable', 'Câblage', 'Icône de câblage pour un document EPK.', 'cable', 'approved'),
  ('mic-vocal', 'Voix', 'Icône de micro pour un document EPK.', 'mic-vocal', 'approved'),
  ('speaker', 'Sono', 'Icône d’enceinte pour un document EPK.', 'speaker', 'approved'),
  ('audio-lines', 'Audio', 'Icône audio pour un document EPK.', 'audio-lines', 'approved'),
  ('images', 'Photos', 'Icône photos pour un document EPK.', 'images', 'approved'),
  ('briefcase-business', 'Pro', 'Icône pro pour un document EPK.', 'briefcase-business', 'approved'),
  ('file-music', 'Partition', 'Icône musicale pour un document EPK.', 'file-music', 'approved'),
  ('file-archive', 'Archive', 'Icône d’archive pour un document EPK.', 'file-archive', 'approved'),
  ('file-text', 'Document', 'Icône de document pour un fichier EPK.', 'file-text', 'approved')
ON CONFLICT (key) DO NOTHING;

ALTER TABLE public.epk_documents DROP CONSTRAINT IF EXISTS epk_documents_icon_check;

UPDATE public.epk_documents
SET icon = 'file-text'
WHERE icon IS NULL OR icon NOT IN (
  'clipboard-list', 'list-checks', 'wrench', 'cable', 'mic-vocal', 'speaker',
  'audio-lines', 'images', 'briefcase-business', 'file-music', 'file-archive', 'file-text'
);

ALTER TABLE public.epk_documents ALTER COLUMN icon SET DEFAULT 'file-text';

ALTER TABLE public.epk_documents
  ADD CONSTRAINT epk_documents_icon_check CHECK (icon IN (
    'clipboard-list', 'list-checks', 'wrench', 'cable', 'mic-vocal', 'speaker',
    'audio-lines', 'images', 'briefcase-business', 'file-music', 'file-archive', 'file-text'
  ));
