# Plan global BMAD — FaderZero

Statut : approuvé pour exécution progressive  
Sources : [audit de sécurité](./AUDIT_SECURITE_FADERZERO.md) · [fonctionnalités](./FONCTIONNALITES_FADERZERO.md)  
Suivi : [sprint status](./SPRINT_STATUS_FADERZERO.yaml) · [fiches stories](./stories/)

## Méthode de suivi

Le chantier suit le cycle BMAD : planification globale, réalisation epic par epic et story par story, revue, tests, rétrospective, puis validation humaine. Les statuts sont :

`backlog → ready → in-progress → review → user-validation → done`

L’epic suivant ne commence jamais sans validation explicite de l’utilisateur. Une fiche détaillée est créée dans `docs/stories/` avant chaque story.

## Règles permanentes

- Conservation absolue des données ; aucun reset de production.
- Migrations `expand → backfill → bascule → contract`.
- Stories petites, testables et réversibles ; tests ciblés après chaque story.
- Suite complète, build et test manuel à la fin de chaque epic.
- Première exécution sur une copie de la base, puis staging, puis production.
- Anciennes colonnes, RPC et bases locales maintenues pendant deux versions et au moins trente jours.
- Toute diminution inattendue d’un comptage ou référence R2 manquante bloque le déploiement.
- Les périodes sensibles utilisent une fenêtre contrôlée : écritures cloud suspendues, lectures et mode hors ligne maintenus autant que possible.

## Epic 0 — Sécuriser le chantier de migration

Objectif : garantir qu’aucune évolution ultérieure ne peut provoquer de perte de données.

### Story 0.1 — Créer les artefacts BMAD

- Enregistrer le plan global et le sprint status.
- Définir le modèle des fiches story : objectif, contexte, critères d’acceptation, tâches, tests, rollback, fichiers modifiés et preuves.
- Documenter les commandes de validation communes.
- Tester la présence de chaque epic/story et les liens vers les deux documents sources.

### Story 0.2 — Inventorier toutes les données

- Compter chaque table Supabase, lignes actives et tombstones.
- Inventorier utilisateurs, workspaces, appartenances et invitations.
- Générer le manifeste R2 : clé, taille, ETag et métadonnées.
- Détecter doublons, relations inter-espace, références manquantes et objets orphelins.
- Documenter IndexedDB historique et `default-workspace`.
- Exécuter deux fois un rapport reproductible ; aucun script ne doit écrire.

### Story 0.3 — Sauvegarder et tester la restauration

- Produire un dump complet de Postgres, Auth et Storage.
- Copier R2 dans un stockage de sauvegarde séparé.
- Restaurer dans un environnement isolé.
- Comparer les comptages, tailles et ETag ; tester un compte restauré et la lecture audio.

### Story 0.4 — Installer les migrations versionnées

- Créer une baseline correspondant au schéma réellement déployé.
- Marquer la baseline appliquée sur l’instance existante seulement après sauvegarde validée.
- Créer un environnement Supabase de test reproductible.
- Ajouter les premiers tests de migration et de rollback.

Tests de fin d’epic : typecheck, lint, 59 tests existants, build, migration complète sur restauration de production et seconde restauration.

### PAUSE 0 — Validation utilisateur

Fournir inventaire, comptages, preuve de restauration et parcours manuel de lecture. Aucun changement fonctionnel avant accord.

## Epic 1 — Corriger les autorisations P0

Objectif : rendre les rôles contraignants côté serveur.

- **1.1 Étendre le modèle de rôles** — ajouter `admin`, `member`, `guest`, conserver temporairement `owner`, backfiller `owner → admin` avec journal, sans modifier les données métier.
- **1.2 Fonctions privées d’autorisation** — schéma privé, `has_workspace_role`, `search_path` fixé, révocation `PUBLIC`, `GRANT` explicites.
- **1.3 Refaire la matrice RLS** — admin complet ; membre contenus/événements en lecture-écriture ; invité lecture/écoute/cache ; non-membre aucun accès ; mêmes règles médias.
- **1.4 Sécuriser le cycle des membres** — RPC transactionnelles, dernier administrateur protégé, départ volontaire soumis aux mêmes contraintes.
- **1.5 Intégrité multi-espace** — contraintes composites `NOT VALID`, quarantaine sans suppression, réparations prouvables, validation puis `workspace_id` immuable.

Tests par story : SQL ciblé et comptages avant/après sans baisse. Fin d’epic : matrice quatre comptes, REST direct, concurrence dernier admin, suite complète et build.

### PAUSE 1 — Test multi-utilisateur

Validation en staging des quatre rôles, chansons, setlists, audios et sync.

## Epic 2 — Sécuriser les invitations

Objectif : invitations atomiques, limitées et à usage unique.

- **2.1 Étendre sans casser les liens** — empreinte, rôle, consommation, révocation ; hachage des tokens existants ; colonne historique temporaire ; acceptées marquées consommées ; expiration restante plafonnée à 24 h.
- **2.2 RPC atomiques** — token serveur, consommation atomique, rôle enregistré, cinq liens actifs par rôle, aucun historique supprimé.
- **2.3 Administration** — liste active, rôle, temps restant, copie, confirmation de révocation, message neutre.
- **2.4 Parcours sans compte** — contexte temporaire, e-mail confirmé, lien revalidé à l’adhésion, token retiré immédiatement de l’URL.

Tests : réutilisation refusée, concurrence (un seul succès), expiré/révoqué refusé, limite par rôle, parcours avec/sans compte.

### PAUSE 2 — Test des invitations

Validation des rôles, copie, expiration, révocation et usage unique.

## Epic 3 — Comptes et espace personnel

Objectif : introduire Mon espace sans déplacer les groupes existants.

- **3.1 Profils** — pseudo obligatoire 2–30 caractères, valeurs existantes préservées, seules absences backfillées, e-mail privé, photo/avatar préparés.
- **3.2 Mon espace** — type `personal | group`, existants classés groupes, un espace personnel créé par compte, aucun contenu déplacé.
- **3.3 Inscription/Auth** — pseudo, e-mail, mot de passe confirmé ; huit caractères, majuscule, minuscule, chiffre ; e-mail confirmé ; récupération neutre.
- **3.4 Paramètres** — double confirmation e-mail, mot de passe courant, reset une heure, révocation globale des sessions.
- **3.5 Suppression du compte** — protection du dernier admin, lien unique, contributions de groupe préservées, espace personnel supprimé après confirmation finale.

Tests : comptages inchangés, exactement un espace personnel par compte, aucun contenu déplacé, Auth complet, e-mail confidentiel.

### PAUSE 3 — Test comptes et Mon espace

Validation d’un ancien et d’un nouveau compte, groupes, mots de passe et profil.

## Epic 4 — Migrer les données locales sans perte

Objectif : isoler chaque utilisateur en conservant IndexedDB, files de sync et caches.

- **4.1 Dexie par utilisateur** — nouveau schéma, journal reprenable, copie table par table sans suppression de l’ancienne base, comparaison IDs/comptages.
- **4.2 Données non attribuables** — preuve d’appartenance serveur, `default-workspace` et ambiguïtés en récupération, rattachement manuel à Mon espace.
- **4.3 Caches audio** — partition utilisateur/workspace, vérification asset/taille/blob, ancien cache conservé.
- **4.4 Sync/révocation/déconnexion** — appartenances actualisées, groupe révoqué purgé avant push, mutations/conflits annulés, sync avant déconnexion, blocage ou export si non sauvegardable.

Tests : interruption/reprise, deux comptes sur un appareil, ancien hors-ligne lisible, aucune mutation perdue, retrait puis reconnexion.

### PAUSE 4 — Test offline et migration locale

Installation par-dessus l’ancienne version, hors connexion, changement de compte et caches.

## Epic 5 — Audios, quotas et sécurité R2

Objectif : préserver tous les fichiers et sécuriser les nouveaux uploads.

- **5.1 Fichier physique/référence logique** — `audio_files`, références historiques, clés R2 inchangées, tailles/ETag vérifiés, orphelins en quarantaine.
- **5.2 Quotas transactionnels** — personnel 3 600 s, groupe 5 Gio, alerte 80 %, réservation/finalisation atomiques, réservation échouée libérée.
- **5.3 Worker** — upload admin/membre, invité lecture seule, limites user/IP, 2 uploads/user et 4/groupe, validation MP3/durée, nettoyage planifié.
- **5.4 Lecture** — URL signée 5 min, query strings hors logs, `nosniff`, en-têtes médias, appartenance contrôlée.
- **5.5 Conversion locale** — MP3 192 kb/s uniforme, import ESM statique dans Web Worker, noms visibles dissociés des clés.

Tests : audios historiques, faux MIME/troncature/dépassement, quota concurrent, upload interrompu, cache offline.

### PAUSE 5 — Test audio complet

Import, écoute, cache, suppression et restauration en personnel et groupe.

## Epic 6 — Administration et corbeille

Objectif : compléter le cycle de vie des groupes et contenus.

- **6.1 Groupe** — nom normalisé unique, historiques conservés, doublons signalés, logo WebP, proposition unique d’inviter.
- **6.2 Administration** — membres triés admin/membre/invité, avatar/pseudo/rôle, changement/retrait/départ, quota visible admin/membre.
- **6.3 Corbeille contenus** — chansons/audios/événements 7 jours, Annuler 5 s, restauration avec quota, tombstones historiques prolongés 7 jours.
- **6.4 Corbeille groupes** — mise en corbeille/restauration admin, nom réservé 7 jours, purge d’abord dry-run.

Tests : visibilité des actions, restaurations avec/sans quota, groupe masqué mais restaurable, dry-run sans suppression.

### PAUSE 6 — Test administration et corbeille

Validation avec trois rôles et autorisation explicite avant purges.

## Epic 7 — Copies entre espaces

Objectif : copier sans dupliquer les fichiers physiques ni créer d’état partiel.

- **7.1 Modèle/historique** — provenance, historique 30 jours, auteur/date d’origine visibles.
- **7.2 RPC transactionnelle** — droits source/destination, sortie de groupe réservée admin, chanson/paroles/notes/réglages, setlists exclues, quota/noms contrôlés avant création.
- **7.3 Audios partagés** — nouvelle référence d’espace sans transfert R2, quota logique par espace, suppression physique après dernière référence.
- **7.4 Interface** — audios décochés, total taille/durée, `(copie N)`, aucun Annuler après lancement.

Tests : toutes directions, refus rôle/quota atomique, indépendance, aucune setlist.

### PAUSE 7 — Test des copies

Validation des parcours, indépendance, noms, quotas et historique.

## Epic 8 — Événements, calendrier et home globale

Objectif : livrer la nouvelle accueil offline-first.

- **8.1 Événements** — schéma serveur/local, repository, mappers, syncQueue, pull, Realtime et permissions.
- **8.2 Calendrier global** — agenda/semaine/mois, filtre espace, création autorisée, navigation vers fiche.
- **8.3 Nouveautés artistiques** — arrivée immuable, créations/copies incluses, modifications/setlists exclues, audio lié/indépendant distingué.
- **8.4 Home Mon espace** — 3 événements, 3 créations, groupes par activité, 3 nouveautés/groupe, états vides sans création rapide.
- **8.5 Navigation** — bascule d’espace, retour avec position, routes lazy-loadées.

Tests : multi-espaces, offline, ordre stable, navigation/retour, vide/chargement/erreur.

### PAUSE 8 — Recette fonctionnelle globale

Validation mobile/ordinateur, en ligne puis hors connexion.

## Epic 9 — Durcissement avant production

Objectif : traiter P2/P3 et installer les contrôles continus.

- **9.1 En-têtes/CSP** — HTTPS, CSP sans `unsafe-eval`/inline, HSTS après TLS, `frame-ancestors`, `nosniff`, `no-referrer`, Permissions Policy.
- **9.2 QR** — schéma strict, limites fragments/tailles/enregistrements/décompression, IDs régénérés, résumé des écrasements.
- **9.3 Dépôt** — Web Crypto obligatoire pour usages sécurité, exclusion `.codex-remote-attachments`, captures archivées/retirées, aucun secret.
- **9.4 CI/surveillance** — typecheck, lint, Vitest, build, RLS, Worker, dépendances, secrets, advisors et alertes.

Tests : CSP, QR hostile, dépendances, pipeline complet, recette sécurité P0–P3.

### PAUSE 9 — Autorisation de production

Matrice sécurité, recette et risques résiduels ; aucun déploiement public sans validation.

## Epic 10 — Retrait contrôlé de la compatibilité

Objectif : nettoyer le legacy uniquement après preuve durable.

- **10.1 Observer** — deux versions et 30 jours, aucun ancien client, migrations locales terminées, récupération/quarantaine contrôlées.
- **10.2 Dernière sauvegarde** — dump, manifeste R2, restauration isolée et comparaison post-migration.
- **10.3 Retirer le legacy** — ancien `owner`, tokens clairs, anciennes RPC/colonnes non utilisées, migration Dexie retirée avec export de récupération, purges définitives activées.

Tests : migration depuis dernière ancienne version, installation neuve, mise à jour historique, restauration, suite complète et recette finale.

### PAUSE 10 — Clôture

Validation de conservation, stabilité et purges ; rétrospective des décisions, incidents et améliorations.

## Livraison à chaque pause

- stories et statuts ; fichiers modifiés ; migrations appliquées ; données avant/après ;
- commandes et résultats de tests ; procédure de test manuel ; checklist utilisateur ;
- rollback disponible et risques restants.

La reprise exige une confirmation explicite de l’utilisateur.
