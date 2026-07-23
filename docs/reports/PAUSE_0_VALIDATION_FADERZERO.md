# PAUSE 0 — Validation utilisateur

Statut : `user-validation`  
Epic suivant : verrouillé jusqu’à confirmation explicite.

## Stories terminées techniquement

| Story | Statut | Résultat |
|---|---|---|
| 0.1 Artefacts BMAD | user-validation | 11 epics et 47 stories suivis, modèle et validateur présents |
| 0.2 Inventaire | user-validation | Deux lectures identiques, rapprochement Supabase/R2 complet |
| 0.3 Sauvegarde/restauration | user-validation | Dump, deux restaurations locales et backup R2 vérifiés |
| 0.4 Migrations versionnées | user-validation | 11 migrations alignées, stack neuve, rollback/réapplication validés |

## Données avant/après

| Donnée | Production | Restauration 1 | Restauration 2 |
|---|---:|---:|---:|
| Utilisateurs Auth | 4 | 4 | 4 |
| Profils | 4 | 4 | 4 |
| Workspaces | 5 | 5 | 5 |
| Membres | 8 | 8 | 8 |
| Invitations | 32 | 32 | 32 |
| Chansons | 18 | 18 | 18 |
| Setlists | 5 | 5 | 5 |
| Entrées de setlist | 21 | 21 | 21 |
| Références audio | 22 | 22 | 22 |
| Tombstones audio | 1 | 1 | 1 |

Les empreintes de contenu correspondent pour 8/8 tables applicatives.

R2 : 22 objets, 60 760 447 octets, 22/22 tailles et ETag identiques après retéléchargement depuis le bucket de sauvegarde.

## Sauvegardes disponibles

- Dump EFS : `.backups/epic-0/faderzero-20260720.dump`.
- SHA-256 : `B02603E7BE3F60A550B4552F2ABAFB86FED4B4917D8086700443F52570CA6E46`.
- Bucket R2 : `faderzero-audio-backup-20260720`.
- Manifeste : [R2_MANIFEST_FADERZERO_2026-07-20.csv](./R2_MANIFEST_FADERZERO_2026-07-20.csv).
- Deux bases restaurées dans le conteneur local `faderzero-epic0-restore`.

## Migrations

- 10 migrations historiques récupérées depuis Supabase.
- 1 baseline des privilèges historiques : `20260720195739_baseline_remote_privileges`.
- Historique local/distant : 11/11 aligné.
- Diff du schéma `public` après baseline : 0 octet.
- Aucun `DROP TABLE` ou `TRUNCATE TABLE` dans `supabase/migrations/`.
- Le script `supabase/sql/00_reset_faderzero.sql` reste hors migrations et interdit en production.

## Tests automatiques

| Contrôle | Résultat |
|---|---|
| Artefacts BMAD | 11 epics, 47 stories, liens sources valides |
| Supabase DB lint | aucune erreur |
| Migration neuve | réussie |
| Rollback/réapplication local | réussi |
| Deux restaurations | réussies |
| Typecheck | réussi |
| Lint | réussi, 2 avertissements préexistants |
| Vitest | 16 fichiers, 59/59 tests |
| Build PWA | réussi |

## Checklist utilisateur

- [ ] Se connecter avec un compte existant dans l’application habituelle.
- [ ] Vérifier que les 5 workspaces attendus restent visibles selon ce compte.
- [ ] Ouvrir une chanson et une setlist existantes.
- [ ] Lire au moins un audio historique.
- [ ] Vérifier brièvement le mode hors connexion sur un appareil déjà utilisé.
- [ ] Confirmer explicitement : « Pause 0 validée » ou signaler toute anomalie.

## Rollback disponible

- Aucune fonctionnalité applicative ni donnée métier n’a été modifiée.
- La seule écriture Supabase est l’ajout de la version de baseline dans l’historique, correspondant à un état déjà présent.
- Le bucket source R2 est intact ; le bucket de sauvegarde est indépendant.
- Les environnements locaux peuvent être arrêtés sans affecter l’application.

## Risques restants

- Les privilèges historiques `anon` sont larges ; ils sont capturés pour fidélité de baseline et seront corrigés en Epic 1.
- Un groupe de noms de workspace normalisés est dupliqué ; aucune correction automatique n’a été faite.
- Le test de connexion via une API Auth branchée directement sur la restauration reste manuel ; les 4 hashes et 4 identités sont bien restaurés.
- Les comptages IndexedDB propres à chaque appareil seront exportés avant la migration locale de l’Epic 4.

## Point d’arrêt

Ne pas commencer l’Epic 1 sans validation explicite de l’utilisateur.
