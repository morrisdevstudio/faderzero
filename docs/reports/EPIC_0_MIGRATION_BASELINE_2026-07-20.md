# Epic 0 — Rapport de baseline des migrations du 20 juillet 2026

## Historique récupéré

Les dix migrations présentes dans `supabase_migrations.schema_migrations` ont été récupérées avec Supabase CLI 2.109.1 dans `supabase/migrations/` :

1. `20260717142736_bootstrap_schema`
2. `20260717142743_configure_rls`
3. `20260717142753_configure_storage`
4. `20260717142758_fix_workspace_permissions`
5. `20260717142804_allow_unlinked_song_assets`
6. `20260717142809_add_sync_indexes`
7. `20260717142814_align_setlists_schema`
8. `20260717142822_add_workspace_invite_links`
9. `20260717142829_add_logical_client_timestamps`
10. `20260717142834_add_setlist_display_modes`

Aucun `DROP TABLE` ni `TRUNCATE TABLE` n’est présent. Le script historique `supabase/sql/00_reset_faderzero.sql` n’est pas une migration et ne doit jamais être exécuté sur la production.

## Dérive capturée

Une comparaison `public` entre la stack fraîche et la production a détecté des privilèges historiques `anon` et des privilèges par défaut non enregistrés dans les dix premières migrations.

La migration `20260720195739_baseline_remote_privileges.sql` reproduit cet état pour obtenir une baseline fidèle. Elle a été :

- créée par `supabase migration new` ;
- appliquée et testée uniquement en local ;
- marquée `applied` dans l’historique distant sans exécuter son SQL ;
- suivie d’un nouveau diff local → production vide (0 octet).

Ces privilèges larges sont du legacy documenté. Ils seront remplacés par des droits explicites et minimaux pendant l’Epic 1.

## Tests locaux

- Démarrage d’une stack Supabase locale neuve : réussi.
- Application des dix migrations historiques : réussie.
- Application de la baseline : réussie.
- `supabase db lint --local --level error` : aucune erreur.
- Rollback local de la dernière migration : réussi.
- Réapplication locale : réussie.
- Historique local/distant : 11/11 versions alignées.

## Tests sur restaurations

- Baseline appliquée à la première restauration de production : réussie.
- Seconde restauration indépendante du dump : réussie.
- Comptages seconde restauration : `4,4,5,8,32,18,5,21,22` pour utilisateurs, profils, workspaces, membres, invitations, chansons, setlists, relations et audios.
- Aucune opération de restauration n’a ciblé la production.

## Rollback

Le rollback testé utilise exclusivement `supabase migration down --local --last 1`. Cette commande reconstruit la base locale et détruit ses données ; elle est interdite sur la production. La remise en état utilise `supabase migration up --local`.
