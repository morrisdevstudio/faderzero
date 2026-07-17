-- =====================================================================
-- 00_RESET_FADERZERO.SQL
-- Nettoyage complet des objets FaderZero de la base de données.
-- =====================================================================


-- Suppression des fonctions
DROP FUNCTION IF EXISTS bump_server_version() CASCADE;
DROP FUNCTION IF EXISTS is_workspace_member(uuid) CASCADE;
DROP FUNCTION IF EXISTS handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS is_admin() CASCADE;
DROP FUNCTION IF EXISTS is_musician() CASCADE;

-- Suppression des tables dans l'ordre inverse des dépendances (ou avec CASCADE)
DROP TABLE IF EXISTS song_assets CASCADE;
DROP TABLE IF EXISTS setlist_songs CASCADE;
DROP TABLE IF EXISTS setlists CASCADE;
DROP TABLE IF EXISTS songs CASCADE;
DROP TABLE IF EXISTS workspace_invites CASCADE;
DROP TABLE IF EXISTS workspace_members CASCADE;
DROP TABLE IF EXISTS workspaces CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;

-- Suppression d'anciennes tables détectées sur l'instance
DROP TABLE IF EXISTS setlist_items CASCADE;
DROP TABLE IF EXISTS bookings CASCADE;

-- Suppression de la séquence globale
DROP SEQUENCE IF EXISTS global_server_version_seq CASCADE;

-- Note sur le stockage (Storage) :
-- Le nettoyage du bucket de stockage 'faderzero-audio' doit être effectué depuis 
-- la console d'administration de Supabase ou via l'API Storage (car les fichiers 
-- physiques sous-jacents ne sont pas supprimés uniquement par du SQL public).
