INSERT INTO public.design_icon_roles (key, label, description, icon_name, status)
VALUES
  ('globe-2', 'Monde', 'Icône de globe pour un élément En bref.', 'globe-2', 'approved'),
  ('flag', 'Drapeau', 'Icône de drapeau pour un élément En bref.', 'flag', 'approved'),
  ('building-2', 'Lieu', 'Icône de bâtiment pour un élément En bref.', 'building-2', 'approved'),
  ('guitar', 'Guitare', 'Icône de guitare pour un élément En bref.', 'guitar', 'approved'),
  ('drum', 'Batterie', 'Icône de batterie pour un élément En bref.', 'drum', 'approved'),
  ('music-note', 'Musique', 'Icône de note de musique pour un élément En bref.', 'music', 'approved'),
  ('user-round', 'Personne', 'Icône de personne pour un élément En bref.', 'user-round', 'approved'),
  ('clock', 'Horloge', 'Icône d’horloge pour un élément En bref.', 'clock', 'approved'),
  ('heart', 'Cœur', 'Icône de cœur pour un élément En bref.', 'heart', 'approved'),
  ('radio', 'Radio', 'Icône de radio pour un élément En bref.', 'radio', 'approved'),
  ('disc-3', 'Disque', 'Icône de disque pour un élément En bref.', 'disc-3', 'approved'),
  ('zap', 'Énergie', 'Icône d’éclair pour un élément En bref.', 'zap', 'approved'),
  ('flame', 'Flamme', 'Icône de flamme pour un élément En bref.', 'flame', 'approved'),
  ('languages', 'Langues', 'Icône de langues pour un élément En bref.', 'languages', 'approved'),
  ('sparkles', 'Éclat', 'Icône d’éclat pour un élément En bref.', 'sparkles', 'approved')
ON CONFLICT (key) DO NOTHING;
