# PAUSE 2 — Validation utilisateur

Statut : `user-validation`  
Epic suivant : verrouillé jusqu’à confirmation explicite.

## Résultat

L’Epic 2 est implémenté et validé sur Supabase local. Les invitations sont générées côté serveur, limitées par rôle, hachées, révocables et consommables une seule fois. La production reste inchangée.

| Story | Statut | Résultat |
|---|---|---|
| 2.1 Extension | user-validation | empreinte SHA-256, rôle, consommation, révocation, compatibilité historique et expiration à 24 h |
| 2.2 RPC | user-validation | création serveur, limite de cinq par rôle, révocation et consommation atomique |
| 2.3 Administration | user-validation | choix du rôle, liste active, copie du secret disponible et confirmation de révocation |
| 2.4 Sans compte | user-validation | token retiré de l’URL, contexte local 24 h et revalidation après authentification |

## Données avant/après sur Supabase local

| Donnée | Avant | Après | Écart |
|---|---:|---:|---:|
| Workspaces | 1 | 1 | 0 |
| Membres | 3 | 3 | 0 |
| Invitations | 0 | 0 | 0 |

Tous les comptes, groupes et invitations créés par les tests ont été supprimés. Les tests ont vérifié explicitement les identifiants et comptages historiques avant leur nettoyage.

La production a uniquement été consultée en lecture seule : ses 32 invitations historiques, dont 29 en attente et 3 acceptées, n’ont pas été modifiées. Aucun objet R2 n’a été lu, déplacé ou supprimé pendant cet epic.

## Migrations appliquées localement

1. `20260722100000_epic_2_1_expand_workspace_invites`
2. `20260722101000_epic_2_2_atomic_invite_rpcs`

Elles ne sont pas appliquées en production.

## Tests automatiques

| Contrôle | Résultat |
|---|---|
| Typecheck | réussi |
| Lint | réussi, 2 avertissements préexistants |
| Vitest | 17 fichiers, 75/75 tests |
| Build PWA | réussi |
| Expansion et compatibilité historique | réussi |
| Rôles, limite, révocation et usage unique | réussi |
| Consommation concurrente | 1 succès, 1 refus, 1 membre créé |
| Supabase DB lint | aucune erreur |
| Supabase security advisors | aucun problème |
| Privilèges directs `authenticated` sur les invitations | aucune écriture directe |
| Comptages locaux avant/après | identiques |

## Fichiers principaux

- `supabase/migrations/20260722100000_epic_2_1_expand_workspace_invites.sql`
- `supabase/migrations/20260722101000_epic_2_2_atomic_invite_rpcs.sql`
- `supabase/tests/epic-2-1-invite-expansion.sql`
- `supabase/tests/epic-2-invite-rpcs.sql`
- `supabase/tests/epic-2-invite-concurrency-setup.sql`
- `supabase/tests/epic-2-invite-concurrency-cleanup.sql`
- `scripts/test-epic-2-invite-concurrency.ps1`
- `src/services/supabase/workspace.ts`
- `src/services/supabase/workspace.test.ts`
- `src/services/supabase/inviteContext.ts`
- `src/services/supabase/inviteContext.test.ts`
- `src/features/account/AccountPage.tsx`
- `src/components/WorkspaceInvitePage.tsx`
- `src/app/App.tsx`

## Staging local

URL : `http://127.0.0.1:5173`

Les comptes de la Pause 1 restent disponibles avec le mot de passe commun `FaderZero1!` :

| Rôle | Compte |
|---|---|
| Admin | `admin@epic1.local` |
| Membre | `member@epic1.local` |
| Invité | `guest@epic1.local` |
| Non-membre | `outsider@epic1.local` |

## Checklist utilisateur

- [ ] Se connecter avec l’administrateur et ouvrir Compte → Groupes → bouton de partage.
- [ ] Créer un lien `invité`, vérifier qu’il est copié et qu’il apparaît avec environ 24 heures restantes.
- [ ] Créer un lien `membre`, puis le révoquer après confirmation ; vérifier qu’il disparaît.
- [ ] Coller le lien invité dans une fenêtre privée : vérifier que `?invite=…` disparaît immédiatement de l’URL.
- [ ] Se connecter avec `outsider@epic1.local` et accepter le lien ; vérifier que le groupe est rejoint avec le rôle invité.
- [ ] Réutiliser le même lien avec un autre compte : le message doit seulement indiquer que le lien n’est plus disponible.
- [ ] Confirmer explicitement : « Pause 2 validée » ou signaler l’anomalie observée.

## Rollback disponible

- Les nouvelles colonnes et empreintes restent en place ; aucune donnée ne doit être supprimée.
- L’ancien frontend peut être restauré temporairement en réaccordant ses droits directs sur `workspace_invites` ; le trigger de compatibilité générera l’empreinte et plafonnera toujours l’expiration.
- Les fonctions historiques conservent leurs noms et leurs paramètres ; leurs contrôles plus stricts restent compatibles avec la lecture et l’acceptation côté ancien client.
- Les deux migrations ne sont présentes que sur Supabase local, donc aucun rollback de production n’est nécessaire.

## Risques restants

- Un token brut n’est volontairement jamais récupérable depuis la base. Après rechargement, un lien actif historique est visible mais doit être remplacé pour être recopié.
- La base locale ne contenait aucune invitation historique ; le backfill a donc été vérifié avec des lignes synthétiques, tandis que les 32 lignes de production ont seulement été inventoriées.
- La vérification visuelle automatique a été refusée par la politique du navigateur intégré ; la checklist ci-dessus constitue la recette visuelle humaine.
- Aucun déploiement de production ne doit avoir lieu avant validation de cette pause et nouvel inventaire des 32 invitations.

## Point d’arrêt

Ne pas commencer l’Epic 3 et ne rien déployer en production sans validation explicite de la Pause 2.
