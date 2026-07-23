# Epic 0 — Rapport d’inventaire du 20 juillet 2026

Projet Supabase : `faderzero` (`lragtkgshbnwvufjqnzm`)  
Région : `eu-west-3`  
État observé : `ACTIVE_HEALTHY`  
Bucket R2 : `faderzero-audio`

Toutes les requêtes Supabase ont été exécutées dans des transactions `READ ONLY`. Les appels Cloudflare utilisés sont des requêtes `GET`.

## Comptages de référence

| Relation | Total | Tombstones |
|---|---:|---:|
| `auth.users` | 4 | 0 |
| `public.profiles` | 4 | 0 |
| `public.workspaces` | 5 | 0 |
| `public.workspace_members` | 8 | 0 |
| `public.workspace_invites` | 32 | 0 |
| `public.songs` | 18 | 0 |
| `public.setlists` | 5 | 0 |
| `public.setlist_songs` | 21 | 0 |
| `public.song_assets` | 22 | 1 |

Rôles : 5 `owner`, 3 `member`.  
Invitations : 29 `pending`, 3 `accepted`.

## Reproductibilité

Deux exécutions indépendantes ont produit la même empreinte logique :

`8fc3da941220d73b2d20fcec68e3d374`

Cette empreinte couvre profils, workspaces, membres, invitations et tables métier. Elle sert de repère, pas de sauvegarde cryptographique.

## Contrôles d’intégrité

| Contrôle | Résultat |
|---|---:|
| Utilisateurs sans profil | 0 |
| Profils sans utilisateur Auth | 0 |
| Workspaces sans membre | 0 |
| Workspaces sans owner | 0 |
| Appartenances dupliquées | 0 |
| Relations setlist inter-espace | 0 |
| Relations audio inter-espace | 0 |
| Préfixes R2 incompatibles avec le workspace | 0 |
| Chemins de stockage dupliqués | 0 |
| Noms de workspace normalisés dupliqués | 1 |

Le doublon de nom est uniquement signalé. Aucune ligne ne doit être renommée ou supprimée automatiquement.

## Rapprochement Supabase ↔ R2

| Mesure | Supabase | R2 | Écart |
|---|---:|---:|---:|
| Références/objets | 22 | 22 | 0 |
| Taille totale | 60 760 447 octets | 60 760 447 octets | 0 |
| Clés manquantes dans R2 | — | — | 0 |
| Objets R2 orphelins | — | — | 0 |
| Tailles différentes | — | — | 0 |

Le manifeste détaillé est enregistré dans [R2_MANIFEST_FADERZERO_2026-07-20.csv](./R2_MANIFEST_FADERZERO_2026-07-20.csv).

## Données locales historiques

- Base Dexie globale : `faderzero-pwa`.
- Version de schéma courante : 8.
- Tables : `songs`, `setlists`, `setlistSongs`, `songAssets`, `syncQueue`, `syncConflicts`, `syncState`.
- La migration Dexie v7 attribue les anciennes lignes sans workspace à `default-workspace`.
- Les comptages IndexedDB sont propres à chaque navigateur/appareil et ne sont pas lisibles depuis Supabase ou Cloudflare. Ils devront être exportés depuis chaque installation historique avant la Story 4.1.

## Conclusion Story 0.2

L’inventaire distant est cohérent et reproductible. Aucun objet R2 manquant ou orphelin n’a été détecté. La seule anomalie métier relevée est un doublon de nom de workspace, conservé intact pour traitement manuel ultérieur.
