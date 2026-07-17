# Supabase Reset & Bootstrap - FaderZero

Ce dossier contient les scripts SQL necessaires pour initialiser et maintenir l'instance Supabase self-hosted de FaderZero.

## Instance en service

La stack active est la stack Docker officielle Supabase reconstruite dans :

```text
/path/to/supabase-clean
```

Endpoints utiles :

- API gateway : `http://your-supabase-host:54321`
- Studio : `http://your-supabase-host:54323`

> [!WARNING]
> `00_reset_faderzero.sql` est destructif. Il supprime les donnees FaderZero et le bucket de stockage associe.

## Ordre d'execution des scripts SQL

Pour une base vide ou apres reset complet, executez les scripts dans cet ordre :

1. `sql/00_reset_faderzero.sql`
2. `sql/01_schema.sql`
3. `sql/02_rls.sql`
4. `sql/03_storage.sql`
5. `sql/04_seed_minimal.sql` (optionnel)
6. `sql/05_fix_workspace_permissions.sql`
7. `sql/06_song_assets_optional_song.sql`
8. `sql/07_sync_server_version_indexes.sql`
9. `sql/08_setlists_schema_alignment.sql`

## Mode d'administration recommande

Le port Postgres n'est pas expose directement a la machine de dev. L'administration se fait donc :

- soit via **Supabase Studio** sur `http://your-supabase-host:54323`
- soit en **SSH** sur le serveur, puis `docker exec` dans `supabase-clean`

Exemple :

```bash
ssh your-user@your-host
cd ~/appGroup/supabase-clean
docker exec -i supabase-db psql -U postgres -d postgres < faderzero-sql/01_schema.sql
```

## Verifications apres initialisation

Apres bootstrap, verifier que :

1. les tables metier `profiles`, `workspaces`, `workspace_members`, `workspace_invites`, `songs`, `setlists`, `setlist_songs`, `song_assets` existent dans `public`
2. la RLS est active sur toutes ces tables
3. le bucket `faderzero-audio` existe dans `storage.buckets` et reste prive

## Configuration de la PWA

Pour connecter la PWA a cette instance Supabase, gerer les conflits et televerser des fichiers audio, consultez [SUPABASE_SYNC.md](../docs/SUPABASE_SYNC.md).
