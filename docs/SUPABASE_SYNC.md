# Synchronisation Cloud Supabase - Documentation Technique & Exploitation (V1)

Ce document decrit le fonctionnement, la configuration et l'exploitation de la synchronisation cloud Supabase pour la PWA FaderZero.

---

## 1. Variables d'Environnement

Pour connecter la PWA a votre instance Supabase, vous devez renseigner les variables d'environnement suivantes dans `.env` (a copier depuis `.env.example`) :

```env
VITE_SUPABASE_URL=http://your-supabase-host:54321
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

- **VITE_SUPABASE_URL** : URL de la passerelle Kong API de votre instance Supabase self-hosted (ex: `http://your-supabase-host:54321`).
- **VITE_SUPABASE_ANON_KEY** : cle "anon" publique de votre instance Supabase.

Note de developpement local : si `VITE_SUPABASE_URL` utilise `http://`, le serveur Vite de la PWA desactive automatiquement son HTTPS local pour eviter le blocage navigateur "mixed content" (`https` app -> `http` API).

## 1.b Instance active

L'instance Supabase active doit etre remplacee ici par vos propres informations d'infrastructure. Exemple de structure :

```text
/path/to/supabase-clean
```

Endpoints utiles :

- **API / Auth / Realtime Gateway** : `http://your-supabase-host:54321`
- **Studio** : `http://your-supabase-host:54323`

Note d'exploitation :

- Le port Postgres n'est pas expose directement a cette machine de dev.
- Les operations d'administration base de donnees se font soit via **Studio**, soit en **SSH** sur votre serveur, puis `docker exec` / `psql` dans la stack `supabase-clean`.

---

## 2. Procedure de Reset & Bootstrap Database

Pour reinitialiser completement l'environnement de base de donnees FaderZero sur votre instance self-hosted :

1. Ouvrez l'interface **Supabase Studio** a l'adresse de votre instance `http://your-supabase-host:54323`.
2. Accedez a l'editeur SQL (**SQL Editor**).
3. Executez dans l'ordre les scripts situes dans `pwa/supabase/sql/` :
   - **`00_reset_faderzero.sql`** : nettoie les tables, triggers et structures de donnees existantes.
   - **`01_schema.sql`** : cree les tables metier, la sequence globale de version (`global_server_version_seq`), les triggers de modification temporelle et le trigger de profil utilisateur automatique.
   - **`02_rls.sql`** : active la RLS sur toutes les tables, applique les `GRANT` necessaires a la Data API, et cree les policies par groupe/workspace.
   - **`03_storage.sql`** : cree le bucket de stockage audio prive `faderzero-audio` et configure ses regles de lecture/ecriture.
   - **`04_seed_minimal.sql`** : optionnel, ajoute des donnees de demonstration minimales rattachees a votre premier utilisateur.
   - **`05_fix_workspace_permissions.sql`** : correctif incremental pour les `GRANT` et la visibilite initiale du workspace createur.
   - **`06_song_assets_optional_song.sql`** : autorise l'import audio avant liaison definitive a un morceau.
   - **`07_sync_server_version_indexes.sql`** : ajoute les index necessaires aux pulls incrementaux.
   - **`08_setlists_schema_alignment.sql`** : aligne `setlists` et `setlist_songs` avec les colonnes attendues par la PWA.

Alternative SSH admin :

```bash
ssh your-user@your-host
cd /path/to/supabase-clean
docker exec -i supabase-db psql -U postgres -d postgres < faderzero-sql/01_schema.sql
```

---

## 3. Fonctionnement Technique du Moteur de Sync

Le moteur de synchronisation est concu pour etre **strictement local-first** et resilient hors ligne.

```text
+-------------+                    +------------------+
| Ecritures   | -- (immediat) -->  | Base Dexie locale|
| Application |                    +------------------+
+-------------+                             |
                                   (cree mutation)
                                            v
                                   +------------------+
                                   |    syncQueue     |
                                   +------------------+
                                            |
                                  pushPendingMutations()
                                            v
                                   +------------------+
                                   | Supabase Remote  |
                                   +------------------+
```

### A. Push (Local -> Supabase)

Toutes les modifications locales (creations, mises a jour, suppressions logiques) sont ecrites instantanement dans Dexie avec le statut `syncStatus = 'pending'`, puis enfilees dans `syncQueue`.

- **Fusion intelligente** : les mutations successives hors ligne sur un meme objet sont fusionnees en queue pour minimiser les echanges.
- **Detection des conflits** : lors de l'envoi d'une modification, le moteur compare la version de reference locale (`baseServerVersion`) avec celle du serveur (`server_version`). S'il y a divergence, la synchronisation passe en attente avec le statut `'conflict'`.

### B. Pull (Supabase -> Local)

Le pull interroge de maniere incrementale les tables distantes en demandant les lignes ayant une version superieure au dernier checkpoint local (`lastPulledVersion` de la table).

- **Regle Local-First (Non-ecrasement)** : si un enregistrement distant recu a un statut local `'pending'` ou `'conflict'`, le pull l'ignore et ne l'ecrase pas.

### C. Temps Reel & Evitement de boucles

Le client s'abonne a Supabase Realtime via WebSocket pour ecouter les modifications distantes.

- **Filtrage de l'auteur** : le client verifie le champ `last_modified_by` de la notification. Si c'est l'utilisateur connecte lui-meme qui a initie le changement, l'evenement est ignore.
- **Checkpoints dynamiques** : le checkpoint local n'avance que jusqu'a la derniere version distante appliquee sans collision locale, ce qui evite de perdre une ligne ignoree parce qu'elle est encore pending ou conflict localement.
- **Horodatage logique client** : chaque ecriture envoie aussi client_updated_at. Le serveur conserve cet horodatage pour resoudre le Last Write Wins selon l'heure fonctionnelle de la modification, pas seulement selon l'heure de reception par Supabase.

---

## 4. Gestion des Conflits

Lorsqu'un conflit est detecte, l'utilisateur a le choix dans l'ecran de synchronisation :

1. **Garder ma version (Local Wins)** : le client remet le statut local a `'pending'` et met a jour la mutation bloquee avec le numero de version actuel du serveur. Lors du prochain push, le serveur acceptera l'ecriture et ecrasera sa propre version.
2. **Garder la version du groupe (Remote Wins)** : le client ecrase l'enregistrement Dexie avec le snapshot distant recupere lors du conflit, et supprime la mutation locale bloquee.

---

## 5. Stockage des Audio Assets

- Les fichiers binaires volumineux ne sont jamais inseres dans la base Postgres. Ils sont verses sur Supabase Storage.
- Chemin standardise : `workspaces/{workspaceId}/songs/{songId}/{assetId}.{ext}`.
- La lecture s'effectue en streaming via des URL signees de courte duree (valables 1 heure) generees par la methode `getSongAssetPlaybackUrl`.
- Limite technique de la V1 : les fichiers audio ne sont pas mis en cache hors ligne pour le moment. Ils necessitent une connexion active pour etre lus.

---

## 6. Coexistence avec la Sync QR Code

- La synchronisation Cloud (Supabase) et la synchronisation locale par QR Code coexistent sur le meme ecran de maniere totalement isolee.
- La synchronisation QR code n'altere pas la configuration Supabase et importe les chansons et setlists directement dans IndexedDB en attribuant le workspace actif ou le workspace par defaut.

