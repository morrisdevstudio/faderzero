# Audit de sécurité — FaderZero

Date de l'audit : 20 juillet 2026  
Dépôt audité : <https://github.com/morrisdevstudio/faderzero>  
Révision auditée : `7a5257a0716993841b394db70db7f1c0a51ba836` (`main`)  
Document fonctionnel comparé : `FONCTIONNALITES_FADERZERO.md`

## Résumé exécutif

Le dépôt possède de bonnes fondations : RLS activée sur les tables exposées, bucket audio privé, clé `service_role` absente du client, validation des JWT par Supabase dans le Worker, URLs audio signées avec HMAC, comparaison de signature en temps constant, verrouillage des versions de `@supabase/supabase-js` et lockfile présent.

L'application ne devrait toutefois pas être ouverte à des utilisateurs non fiables avant correction des points P0. Le principal problème est que l'autorisation serveur vérifie généralement seulement « membre du groupe », sans appliquer le rôle. Un membre peut donc appeler directement l'API Supabase pour modifier ou supprimer un groupe, gérer les appartenances et les invitations. Les invitations dites à usage unique sont également réutilisables.

| Priorité | Nombre | Interprétation |
|---|---:|---|
| P0 — critique | 2 | À corriger avant toute bêta multi-utilisateur |
| P1 — élevée | 5 | À corriger avant une mise en production publique |
| P2 — moyenne | 5 | Durcissement requis à court terme |
| P3 — faible | 2 | Hygiène et défense en profondeur |

## P0 — points critiques

### 1. Les rôles ne sont pas appliqués par les politiques RLS

**Constat**

- Le schéma ne connaît que `owner` et `member`, alors que le document fonctionnel prévoit `administrateur`, `membre` et `invité`.
- Tout membre peut modifier ou supprimer le workspace.
- Tout membre peut modifier ou supprimer n'importe quelle appartenance, y compris celle du propriétaire.
- Tout membre peut créer, modifier ou supprimer les invitations.
- Les règles Storage autorisent également lecture, ajout, modification et suppression à tout membre, sans distinction de rôle.

**Preuves**

- [`workspace_members.role`](https://github.com/morrisdevstudio/faderzero/blob/7a5257a0716993841b394db70db7f1c0a51ba836/supabase/sql/01_schema.sql#L35-L42)
- [Policies du workspace et des membres](https://github.com/morrisdevstudio/faderzero/blob/7a5257a0716993841b394db70db7f1c0a51ba836/supabase/sql/02_rls.sql#L79-L128)
- [Policies des invitations](https://github.com/morrisdevstudio/faderzero/blob/7a5257a0716993841b394db70db7f1c0a51ba836/supabase/sql/02_rls.sql#L131-L152)
- [Policies des fichiers audio](https://github.com/morrisdevstudio/faderzero/blob/7a5257a0716993841b394db70db7f1c0a51ba836/supabase/sql/03_storage.sql#L30-L74)

**Impact**

Un utilisateur légitime mais malveillant peut contourner l'interface en envoyant des requêtes REST directes avec son JWT. Il peut supprimer le groupe et ses contenus, changer des rôles, exclure des membres ou générer des invitations. C'est un défaut d'autorisation de type BOLA/IDOR.

**Correction recommandée**

1. Introduire les rôles `admin`, `member`, `guest` et une fonction serveur `has_workspace_role(workspace_id, allowed_roles[])` placée dans un schéma privé non exposé.
2. Autoriser la gestion du groupe, des rôles, des membres et des invitations uniquement aux administrateurs.
3. Autoriser les membres à gérer les contenus métier, et les invités uniquement à les lire/écouter.
4. Interdire toute opération laissant un groupe sans administrateur via une fonction transactionnelle serveur, pas seulement dans l'interface.
5. Tester chaque table avec au moins quatre identités : non-membre, invité, membre, administrateur.

### 2. Les liens d'invitation « à usage unique » sont réutilisables

**Constat**

La fonction accepte explicitement une invitation au statut `pending` **ou `accepted`**. Après la première utilisation, le token reste donc valable et peut ajouter d'autres comptes jusqu'à son expiration. Deux acceptations concurrentes peuvent également réussir. Le lien dure 30 jours dans le client, contre 24 heures dans le document fonctionnel.

**Preuves**

- [Acceptation de `pending` ou `accepted`](https://github.com/morrisdevstudio/faderzero/blob/7a5257a0716993841b394db70db7f1c0a51ba836/supabase/sql/09_workspace_invite_links.sql#L53-L81)
- [Expiration client à 30 jours](https://github.com/morrisdevstudio/faderzero/blob/7a5257a0716993841b394db70db7f1c0a51ba836/src/services/supabase/workspace.ts#L167-L185)

**Impact**

Toute personne qui récupère un ancien lien peut rejoindre le groupe. Un lien transmis à un destinataire peut être partagé et utilisé par un nombre indéterminé de comptes.

**Correction recommandée**

- Générer le token côté serveur avec au moins 256 bits aléatoires et ne stocker que son empreinte.
- Consommer le token atomiquement : `UPDATE ... WHERE status = 'pending' AND expires_at > now() RETURNING ...` ; échouer si aucune ligne n'est retournée.
- Enregistrer `consumed_at` et `consumed_by`.
- Fixer l'expiration côté serveur à 24 heures et ne jamais faire confiance à une date fournie par le client.
- Ajouter des tests de concurrence et de seconde utilisation.

## P1 — points élevés

### 3. Absence de quotas et de limitation de débit sur l'upload R2

Le Worker limite chaque objet à 50 Mo, mais ne limite ni le nombre d'objets, ni le volume cumulé, ni le débit par utilisateur/groupe. Tout membre peut envoyer directement des objets sans créer de métadonnée correspondante. Le type est validé uniquement avec l'en-tête `Content-Type`, donc un contenu arbitraire peut être déclaré `audio/mpeg`.

**Impact :** abus de stockage, hausse des coûts, saturation des quotas et accumulation d'objets orphelins.

**Preuves :** [upload du Worker](https://github.com/morrisdevstudio/faderzero/blob/7a5257a0716993841b394db70db7f1c0a51ba836/cloudflare/audio-worker/src/index.ts#L76-L125) et [contrôle d'appartenance sans rôle](https://github.com/morrisdevstudio/faderzero/blob/7a5257a0716993841b394db70db7f1c0a51ba836/cloudflare/audio-worker/src/index.ts#L227-L250).

**À faire :** réservation transactionnelle du quota côté serveur avant upload, limitation de débit Cloudflare par utilisateur et IP, contrôle de rôle, validation du format réel, finalisation atomique métadonnée/objet, tâche de nettoyage des orphelins et limites strictes sur le nombre d'uploads simultanés.

### 4. Configuration Auth moins stricte que les exigences produit

La configuration versionnée indique :

- longueur minimale serveur de 6 caractères ;
- aucune exigence majuscule/minuscule/chiffre ;
- confirmation d'e-mail désactivée ;
- changement de mot de passe sécurisé désactivé.

Le client impose seulement 8 caractères. Le changement de mot de passe ne demande pas le mot de passe courant, ne réauthentifie pas l'utilisateur et ne révoque pas toutes les sessions après succès.

**Preuves :** [`supabase/config.toml`](https://github.com/morrisdevstudio/faderzero/blob/7a5257a0716993841b394db70db7f1c0a51ba836/supabase/config.toml#L155-L185), [configuration e-mail](https://github.com/morrisdevstudio/faderzero/blob/7a5257a0716993841b394db70db7f1c0a51ba836/supabase/config.toml#L219-L234), [mise à jour du mot de passe](https://github.com/morrisdevstudio/faderzero/blob/7a5257a0716993841b394db70db7f1c0a51ba836/src/services/supabase/auth.ts#L70-L76).

**À faire :** vérifier aussi la configuration réelle du Dashboard Supabase ; imposer au serveur au minimum 8 caractères et `lower_upper_letters_digits`, activer la confirmation e-mail et la réauthentification/changement sécurisé, demander le mot de passe courant et révoquer toutes les sessions selon le parcours fonctionnel.

### 5. Les données locales ne sont pas purgées à la déconnexion ou après révocation

La déconnexion efface la session et quelques clés `localStorage`, mais pas la base IndexedDB globale `faderzero`, la file de synchronisation, les conflits ou le cache audio. Le cache peut être vidé manuellement, mais ce n'est pas automatique.

**Impact :** sur un appareil partagé ou perdu, un autre utilisateur peut retrouver des paroles, notes, setlists et fichiers audio hors ligne. Des mutations en attente peuvent rester présentes après la perte d'accès.

**Preuves :** [déconnexion du store](https://github.com/morrisdevstudio/faderzero/blob/7a5257a0716993841b394db70db7f1c0a51ba836/src/stores/authStore.ts#L191-L200) et [cache audio persistant](https://github.com/morrisdevstudio/faderzero/blob/7a5257a0716993841b394db70db7f1c0a51ba836/src/features/audio/audioCacheStore.ts#L21-L35).

**À faire :** séparer les bases/caches par utilisateur, purger automatiquement les données d'un groupe dès que le serveur confirme la perte d'appartenance, annuler sa file de mutations, purger toutes les données à la déconnexion et proposer une stratégie explicite de chiffrement local si le mode hors ligne contient des données sensibles.

### 6. Une URL audio signée reste valable après le retrait du groupe

Une fois créée, l'URL donne accès à l'objet pendant une heure sans nouvelle vérification de l'appartenance. Retirer l'utilisateur du groupe ou révoquer sa session n'annule donc pas l'URL déjà émise.

**Preuve :** [TTL et validation HMAC](https://github.com/morrisdevstudio/faderzero/blob/7a5257a0716993841b394db70db7f1c0a51ba836/cloudflare/audio-worker/src/index.ts#L128-L177).

**À faire :** réduire fortement le TTL (par exemple quelques minutes) ou vérifier l'appartenance à chaque lecture pour les contenus sensibles. Ne jamais journaliser les query strings signées. Documenter clairement qu'une URL signée est un jeton d'accès temporaire.

### 7. Intégrité multi-espace insuffisamment contrainte par la base

`setlist_songs` et `song_assets` possèdent leur propre `workspace_id`, mais leurs clés étrangères ne garantissent pas que la setlist, la chanson et l'asset appartiennent au même espace. Les policies contrôlent seulement le `workspace_id` porté par la ligne.

**Impact :** un client hostile ou défectueux peut créer des relations incohérentes entre espaces, déplacer des lignes entre deux espaces dont il est membre ou perturber les suppressions en cascade.

**Preuve :** [schéma des relations](https://github.com/morrisdevstudio/faderzero/blob/7a5257a0716993841b394db70db7f1c0a51ba836/supabase/sql/01_schema.sql#L101-L137).

**À faire :** utiliser des contraintes composites incluant `workspace_id`, rendre `workspace_id` immuable après création et vérifier que `storage_path` commence exactement par `workspaces/{workspace_id}/`.

## P2 — points moyens

### 8. Fonctions `SECURITY DEFINER` dans le schéma exposé `public`

Les droits d'exécution sont explicitement révoqués puis accordés, ce qui est positif. Néanmoins, `check_is_workspace_member` et les fonctions d'invitation restent dans le schéma exposé `public`. La première ne fixe pas son `search_path`.

**À faire :** déplacer les fonctions privilégiées dans un schéma privé non exposé, fixer un `search_path` minimal, qualifier tous les objets, retirer `EXECUTE` à `PUBLIC`, puis accorder uniquement les fonctions réellement nécessaires. Voir la [documentation RLS Supabase](https://supabase.com/docs/guides/database/postgres/row-level-security).

### 9. Absence d'en-têtes de sécurité web et usage de code dynamique

Le Caddyfile ne définit pas CSP, `frame-ancestors`, `X-Content-Type-Options`, `Referrer-Policy` ou `Permissions-Policy`. Il sert lui-même en HTTP avec `auto_https off` ; cela peut être acceptable uniquement si un proxy TLS fiable est garanti en amont. De plus, l'encodeur MP3 est chargé avec `new Function`, ce qui bloque l'adoption d'une CSP stricte sans `unsafe-eval`.

**Preuves :** [Caddyfile](https://github.com/morrisdevstudio/faderzero/blob/7a5257a0716993841b394db70db7f1c0a51ba836/deploy/Caddyfile) et [`new Function`](https://github.com/morrisdevstudio/faderzero/blob/7a5257a0716993841b394db70db7f1c0a51ba836/src/features/songs/audioCompression.ts#L183-L194).

**À faire :** garantir HTTPS de bout en bout, ajouter les en-têtes, supprimer l'évaluation dynamique au profit d'un module compatible, puis déployer une CSP sans `unsafe-eval` et sans `unsafe-inline`.

### 10. Import QR non authentifié et insuffisamment borné

Le SHA-256 vérifie l'intégrité du contenu reçu, pas l'identité de son auteur : un attaquant peut fabriquer lui-même le payload et son hash. Les fragments et objets JSON ne sont pas validés par un schéma strict et aucune limite globale explicite ne protège contre un nombre de fragments, une décompression ou des champs excessifs. Les IDs existants peuvent être remplacés si le timestamp importé est plus récent.

**Preuve :** [reconstruction et import QR](https://github.com/morrisdevstudio/faderzero/blob/7a5257a0716993841b394db70db7f1c0a51ba836/src/features/sync/qrTransfer.ts#L254-L395).

**À faire :** limiter taille compressée/décompressée, fragments, enregistrements et longueur de chaque champ ; valider le JSON avec un schéma ; présenter clairement les écrasements ; générer de nouveaux IDs par défaut ; ajouter une signature ou un code de confirmation si l'identité de la source doit être garantie.

### 11. Le token d'invitation est placé dans l'URL

Le token apparaît dans la query string `?invite=...`. Il peut donc rester dans l'historique, les captures, la télémétrie, les journaux d'un proxy et certains en-têtes de navigation.

**À faire :** échanger immédiatement le token contre un état temporaire, puis retirer la query string avec `history.replaceState`; définir `Referrer-Policy: no-referrer`; masquer les query strings dans logs et outils analytics.

### 12. Validation audio fondée sur le MIME déclaré

Le Worker accepte le fichier selon `Content-Type` sans inspecter les octets. La conversion locale n'est pas une barrière de sécurité, car un attaquant peut appeler le Worker directement.

**À faire :** contrôler la signature du fichier et, idéalement, le décoder/transcoder dans un traitement isolé avant de le considérer valide. Servir les objets avec `nosniff` et téléchargement forcé lorsque le rendu inline n'est pas nécessaire.

## P3 — défense en profondeur

### 13. Repli non cryptographique de `createId`

`crypto.randomUUID()` est utilisé normalement, mais le repli utilise `Math.random()`. Ce repli ne doit jamais produire un secret ou token d'invitation.

**Preuve :** [`createId`](https://github.com/morrisdevstudio/faderzero/blob/7a5257a0716993841b394db70db7f1c0a51ba836/src/lib/createId.ts).

**À faire :** échouer explicitement si Web Crypto est indisponible pour les usages de sécurité. Les tokens d'invitation doivent de toute façon être créés côté serveur.

### 14. Fichiers de travail et captures publiés dans le dépôt

Le dépôt public contient `.codex-remote-attachments` et plusieurs captures d'écran, dont au moins une adresse IP privée. Ce n'est pas un secret exploitable depuis Internet, mais ces artefacts peuvent révéler des informations d'environnement ou, à l'avenir, des données personnelles.

**À faire :** exclure ce dossier via `.gitignore`, supprimer les artefacts inutiles du dépôt et contrôler chaque image avant publication. Si une donnée réellement sensible a été commitée, nettoyer aussi l'historique Git et faire tourner les secrets concernés.

## Contrôles positifs observés

- RLS activée sur toutes les tables applicatives exposées.
- Pas de clé `service_role`, clé privée ou secret de signature trouvé dans la révision courante ou l'historique Git analysé.
- La clé Supabase versionnée est une clé **publishable**, prévue pour être publique ; elle ne doit pas être confondue avec une clé secrète.
- Bucket Supabase déclaré privé et limite de 50 Mo par objet.
- Worker : JWT vérifié auprès de Supabase, chemin d'objet strict, écrasement interdit avec `if-none-match: *`, HMAC SHA-256 et comparaison constante.
- CORS limité à une liste d'origines ; il ne remplace toutefois pas l'autorisation.
- Aucun usage de `dangerouslySetInnerHTML` détecté dans le code React.
- Audit `pnpm audit` du 20 juillet 2026 : **0 vulnérabilité connue** sur 573 dépendances analysées (0 critique, élevée, moyenne ou faible). Deux sous-dépendances sont dépréciées : `glob@11.1.0` et `source-map@0.8.0-beta.0`.

## Plan de remédiation conseillé

### Avant toute bêta multi-utilisateur

1. Refaire le modèle de rôles et toutes les policies RLS/Storage.
2. Remplacer l'acceptation d'invitation par une fonction atomique réellement à usage unique.
3. Ajouter une matrice automatisée de tests d'autorisation contre une base Supabase locale.

### Avant production publique

4. Aligner Auth avec les parcours fonctionnels : confirmation e-mail, changement sécurisé, sessions et récupération.
5. Mettre quotas, rate limiting et validation réelle sur l'audio.
6. Implémenter la purge locale à la révocation/déconnexion.
7. Ajouter les contraintes d'intégrité multi-espace.
8. Réduire ou revalider les URLs signées.

### Durcissement

9. Déplacer les fonctions privilégiées hors de `public` et exécuter les advisors Supabase.
10. Déployer HTTPS et les en-têtes de sécurité, puis supprimer `new Function` pour permettre une CSP stricte.
11. Borner et valider strictement l'import QR.
12. Mettre en place Dependabot/Renovate, secret scanning, tests RLS et audit de dépendances dans la CI.

## Tests de sécurité minimaux à automatiser

- Un invité ne peut ni créer/modifier/supprimer un contenu, ni uploader/supprimer un audio.
- Un membre peut gérer le contenu mais pas le groupe, les rôles, les membres ou les invitations.
- Seul un administrateur peut gérer membres et invitations.
- Aucun administrateur ne peut retirer le dernier administrateur.
- Un non-membre ne peut lire aucune ligne ou aucun objet du groupe.
- Un token d'invitation échoue à sa seconde utilisation et lors de deux acceptations concurrentes.
- Un token expiré/révoqué échoue toujours, y compris après inscription et confirmation d'e-mail.
- Une relation `setlist_songs` ou `song_assets` entre deux workspaces est rejetée par la base.
- Un utilisateur retiré ne peut plus créer d'URL audio ; les données locales et mutations du groupe sont purgées à la synchronisation suivante.
- Le quota résiste à plusieurs uploads parallèles et ne peut pas devenir négatif ou dépasser la limite.

## Limites de l'audit

Il s'agit d'une analyse statique du dépôt et de son historique public. Aucun accès n'a été fourni au Dashboard Supabase, à la base de production, à Cloudflare, aux journaux, aux secrets déployés ou aux paramètres DNS/TLS réels. Certaines valeurs de `supabase/config.toml` peuvent donc différer de la production. Aucun test d'intrusion sur le service déployé n'a été effectué.

Le document fonctionnel date du 20 juillet 2026 alors que la dernière révision du dépôt auditée date du 18 juillet 2026. Plusieurs écarts décrivent probablement des fonctions encore à développer ; ils deviennent néanmoins des exigences de sécurité bloquantes avant activation auprès d'utilisateurs réels.

## Références officielles

- [Supabase — Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase — Sécuriser la Data API](https://supabase.com/docs/guides/api/securing-your-api)
- [Supabase — Sécurité des mots de passe](https://supabase.com/docs/guides/auth/password-security)
- [Supabase — Contrôle d'accès Storage](https://supabase.com/docs/guides/storage/security/access-control)
- [Cloudflare — Workers Best Practices](https://developers.cloudflare.com/workers/best-practices/workers-best-practices/)
