# PAUSE 1 — Validation utilisateur

Statut : `user-validation`  
Epic suivant : verrouillé jusqu’à confirmation explicite.

## Résultat

L’Epic 1 est implémenté et validé sur Supabase local ainsi que sur deux restaurations indépendantes de la production. La production reste inchangée : son historique contient toujours 11 migrations, jusqu’à `20260720195739`.

| Story | Statut | Résultat |
|---|---|---|
| 1.1 Rôles | user-validation | `admin`, `member`, `guest`, compatibilité `owner`, backfill journalisé |
| 1.2 Fonctions privées | user-validation | schéma non exposé, `search_path` vide, privilèges explicites |
| 1.3 Matrice RLS | user-validation | quatre rôles testés par SQL, JWT/REST et Worker |
| 1.4 Cycle des membres | user-validation | RPC transactionnelles et protection concurrente du dernier admin |
| 1.5 Intégrité | user-validation | quarantaine, contraintes composites et `workspace_id` immuable |

## Données avant/après sur la copie de production

| Donnée | Avant | Après | Écart |
|---|---:|---:|---:|
| Membres | 8 | 8 | 0 |
| Administrateurs (`owner` avant, `admin` après) | 5 | 5 | 0 |
| Chansons | 18 | 18 | 0 |
| Setlists | 5 | 5 | 0 |
| Entrées de setlist | 21 | 21 | 0 |
| Références audio | 22 | 22 | 0 |
| Anomalies multi-espace non résolues | 0 | 0 | 0 |

Les cinq conversions `owner → admin` disposent chacune d’une entrée dans `private.workspace_role_migration_journal`. Aucun objet R2 n’a été déplacé, réécrit ou supprimé.

## Migrations préparées

1. `20260720201559_epic_1_1_extend_workspace_roles`
2. `20260720201828_epic_1_2_private_authorization_functions`
3. `20260720202011_epic_1_3_role_based_rls_matrix`
4. `20260720202501_epic_1_3_explicit_auth_helper_privileges`
5. `20260720202612_epic_1_4_transactional_member_lifecycle`
6. `20260720203039_epic_1_5_quarantine_and_expand_integrity`
7. `20260720203049_epic_1_5_validate_integrity_and_lock_workspace`
8. `20260720203641_epic_1_harden_legacy_function_search_paths`

Elles sont appliquées uniquement aux environnements isolés. La migration d’expansion crée les contraintes `NOT VALID`; la migration suivante bloque si la quarantaine n’est pas vide, valide les contraintes, puis active l’immuabilité.

## Tests automatiques

| Contrôle | Résultat |
|---|---|
| Typecheck | réussi |
| Lint | réussi, 2 avertissements préexistants |
| Vitest | 16 fichiers, 67/67 tests |
| Build PWA | réussi |
| Test Worker ciblé | 7/7 tests |
| Wrangler types | à jour |
| Bundle Worker dry-run | réussi, aucun déploiement |
| Supabase DB lint | aucune erreur |
| Supabase advisors | aucun avertissement après correction |
| Matrice SQL quatre rôles | réussie sur local et deux restaurations |
| JWT/REST réel | admin/membre écrivent, invité lit, non-membre ne voit rien |
| Dernier admin concurrent | 1 succès, 1 refus, 1 admin restant |
| Comptages protégés | identiques avant/après |

## Staging local disponible

URL : `http://127.0.0.1:5173`

Mot de passe commun : `FaderZero1!`

| Rôle | Compte |
|---|---|
| Admin | `admin@epic1.local` |
| Membre | `member@epic1.local` |
| Invité | `guest@epic1.local` |
| Non-membre | `outsider@epic1.local` |

Le staging contient `Groupe test Epic 1`, une chanson et une setlist. Il utilise Supabase local et ne modifie pas la production.

## Checklist utilisateur

- [ ] Admin : se connecter, ouvrir le groupe, modifier la chanson, lancer la synchronisation.
- [ ] Membre : se connecter, lire puis modifier la chanson, lancer la synchronisation.
- [ ] Invité : se connecter, lire la chanson et la setlist ; une écriture serveur doit être refusée.
- [ ] Non-membre : se connecter et vérifier que le groupe n’est pas visible.
- [ ] Revenir avec l’admin et vérifier que les modifications admin/membre sont présentes.
- [ ] Confirmer explicitement : « Pause 1 validée » ou signaler l’anomalie observée.

## Rollback disponible

- Le dump Epic 0 et les deux restaurations pré-migration restent disponibles.
- Le backfill de rôles est réversible à partir du journal exact des cinq lignes.
- Les politiques et fonctions précédentes restent dans l’historique versionné.
- `owner` reste accepté et interprété comme `admin` pendant deux versions et trente jours minimum.
- Les anciennes clés étrangères simples restent en place ; aucune phase `contract` n’a commencé.
- Le Worker n’a pas été déployé et la production Supabase n’a reçu aucune migration Epic 1.

## Risques restants

- L’interface n’adapte pas encore tous ses boutons au rôle : le serveur reste l’autorité et refuse les écritures d’un invité. L’administration visuelle complète est prévue à l’Epic 6.
- Le staging local ne contient pas de copie des objets audio R2 ; la matrice audio est couverte par les tests Worker et le dry-run.
- La production ne recevra ces migrations et le Worker qu’après validation de cette pause et un contrôle final des comptages.

## Point d’arrêt

Ne pas commencer l’Epic 2 et ne rien déployer en production sans validation explicite de la Pause 1.
