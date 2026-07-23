# PAUSE 9 — Durcissement avant production

Statut : `done`

L’Epic 9 est implémenté, déployé et validé explicitement par l’utilisateur le 23 juillet 2026.

## Environnement validé

- PWA : `https://faderzero-server.tailfba668.ts.net/`
- API audio : `https://faderzero-audio-api.admin-morris-studio.workers.dev`
- Release déployée : `release-20260723-115326`
- Sauvegarde pré-migration : `/home/docker-yapi/appGroup/faderzero-pwa/.backups/pre-pause-9-20260723-113953.sql.gz`
- Sauvegarde vérifiée avec gzip et protégée en mode `600`.

## Intégrité des données serveur

Les migrations ont été appliquées transactionnellement après sauvegarde. Aucun compteur métier historique n’a diminué.

| Donnée | Avant | Après migration | Observation |
|---|---:|---:|---|
| Utilisateurs Auth | 4 | 4 | inchangé |
| Profils | 4 | 4 | inchangé |
| Workspaces | 5 | 9 | +4 espaces personnels attendus |
| Membres | 8 | 12 | +4 propriétaires attendus |
| Invitations | 32 | 32 | inchangé |
| Songs | 18 | 18 | inchangé |
| Setlists | 5 | 5 | inchangé |
| Associations setlist/song | 20 | 20 | inchangé |
| Références audio | 20 | 20 | inchangé |
| Objets Storage | 20 | 20 | inchangé |

Le compte créé pour la recette a ensuite été supprimé avec son espace personnel. Les compteurs finaux sont revenus à 4 utilisateurs, 9 workspaces et 12 membres.

## Validation automatique du 23/07/2026

- Typecheck application et Worker : réussis.
- Lint : réussi avec 10 avertissements non bloquants.
- Tests application : 34 fichiers, 142 tests réussis.
- Tests Worker : 1 fichier, 12 tests réussis.
- Build PWA : réussi.
- Types Wrangler : à jour.
- Validation des en-têtes : réussie.
- Scan de secrets : 326 fichiers, aucun secret détecté.
- Audit npm : 0 vulnérabilité.
- Supabase DB lint : aucune erreur.
- Supabase advisors sécurité : aucune alerte.
- Matrices RLS Epic 1 et Epic 9 : réussies localement et sur le serveur de test.

## Recette navigateur effectuée

- Connexion HTTPS et authentification : réussies.
- Home, calendrier et page de synchronisation : chargés.
- Fragment QR hostile : rejeté avec `Fragment QR invalide` sans import.
- Rechargement hors ligne : shell PWA disponible et état `Hors ligne` affiché.
- Retour en ligne : réussi.
- Nouveau bundle Realtime chargé ; aucune erreur `No subscription params`, `CHANNEL_ERROR` ou `TIMED_OUT`.
- Service worker réactivé après la recette.

## Critères de sortie à confirmer par l’utilisateur

- [ ] Ouvrir la PWA sur l’appareil cible via l’URL Tailscale et confirmer l’affichage attendu.
- [ ] Installer ou relancer la PWA, couper le réseau et confirmer que la navigation locale essentielle reste disponible.
- [ ] Effectuer un vrai transfert QR entre deux appareils et confirmer le résumé avant import.
- [ ] Confirmer explicitement la PAUSE 9 avant tout démarrage de l’Epic 10.

## Risques résiduels non bloquants

- Le lint conserve 10 avertissements : paramètres de `catch` inutilisés, dépendances de hooks et une regex de nettoyage PDF.
- Le build signale un chunk `storage` de 505,85 kB ; une optimisation par découpage reste possible.
- Caddy signale un formatage perfectible et l’horloge du serveur a présenté quelques secondes d’écart pendant le déploiement.
- Le workflow GitHub sera réellement observé après commit et push ; sa matrice a été rejouée localement.

## Décision

L’Epic 9 passe en `user-validation`. Aucun travail Epic 10 ne doit commencer avant l’accord explicite de l’utilisateur.
