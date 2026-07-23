# Epic 0 — Rapport de sauvegarde et restauration du 20 juillet 2026

## Sauvegarde PostgreSQL

- Source : projet Supabase `faderzero` (`lragtkgshbnwvufjqnzm`).
- Connexion : session pooler TLS.
- Outil : `pg_dump` PostgreSQL 17, format custom, compression gzip niveau 9.
- Fichier local : `.backups/epic-0/faderzero-20260720.dump`.
- Taille : 302 038 octets.
- Table des matières : 527 entrées.
- SHA-256 : `B02603E7BE3F60A550B4552F2ABAFB86FED4B4917D8086700443F52570CA6E46`.
- Protection : dossier exclu de Git et chiffré avec Windows EFS.

Le dump original est complet et inchangé. La connexion de production n’a servi qu’à `pg_dump` et à des requêtes `READ ONLY` de comparaison.

## Restauration isolée

- Docker Desktop 4.83.0, moteur 29.6.2.
- Cible : conteneur dédié `faderzero-epic0-restore`.
- PostgreSQL : 17.
- Port local : `127.0.0.1:55432`.
- Base : `faderzero_restore`.
- Volume dédié : `faderzero-epic0-restore-data`.

La restauration de validation exclut uniquement `supabase_vault`, extension absente de l’image PostgreSQL standard. Cette exclusion concerne la cible de test, pas le dump original. Les rôles Supabase nécessaires aux politiques ont été créés localement en `NOLOGIN`.

## Comparaison des données

| Relation | Production | Restauration | Tombstones restaurées |
|---|---:|---:|---:|
| `auth.users` | 4 | 4 | 0 |
| `public.profiles` | 4 | 4 | 0 |
| `public.workspaces` | 5 | 5 | 0 |
| `public.workspace_members` | 8 | 8 | 0 |
| `public.workspace_invites` | 32 | 32 | 0 |
| `public.songs` | 18 | 18 | 0 |
| `public.setlists` | 5 | 5 | 0 |
| `public.setlist_songs` | 21 | 21 | 0 |
| `public.song_assets` | 22 | 22 | 1 |
| `storage.buckets` | 1 | 1 | 0 |
| `storage.objects` | 0 | 0 | 0 |

Les empreintes de contenu correspondent pour 8/8 tables applicatives : profils, workspaces, membres, invitations, chansons, setlists, relations de setlist et références audio.

Auth restauré : 4 utilisateurs, 4 hashes de mot de passe et 4 identités. Le test de connexion via l’API Auth locale sera exécuté après installation de l’environnement Supabase reproductible de la Story 0.4.

## Sauvegarde R2

- Source : `faderzero-audio`.
- Destination séparée : `faderzero-audio-backup-20260720`.
- Localisation : `WEUR`.
- Objets copiés : 22/22.
- Taille vérifiée : 60 760 447 octets.
- Vérification : retéléchargement exhaustif de la destination et comparaison taille + MD5/ETag pour chaque clé.
- Résultat : aucun objet manquant, aucun orphelin dans le lot, aucune différence de taille ou d’ETag.
- En-têtes audio : 22/22 reconnus comme ID3 ou frame MPEG.
- Métadonnées : `Content-Type` et `Cache-Control` reproduits ; métadonnées personnalisées conservées dans le manifeste versionné.

Manifeste : [R2_MANIFEST_FADERZERO_2026-07-20.csv](./R2_MANIFEST_FADERZERO_2026-07-20.csv)  
SHA-256 du manifeste : `323A721A42B6FECB19C60187AFCB4E3F052B6C4BE8FCDD08A9E1AC7AA349F8D3`.

## Impact production

- Aucune ligne créée, modifiée ou supprimée.
- Aucun objet du bucket source modifié ou supprimé.
- Aucun arrêt de l’application.
- Seules écritures externes : création et alimentation du bucket de sauvegarde séparé.

## Points restant avant validation de la Story 0.3

- Démarrer l’environnement Supabase local complet de Story 0.4.
- Tester une connexion Auth via API sur les données restaurées.
- Lire manuellement au moins un audio restauré dans un parcours applicatif isolé.
