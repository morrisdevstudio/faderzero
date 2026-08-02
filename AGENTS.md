# FaderZero

Migration progressive de FaderZero vers une PWA mobile-first et offline-first, sans casser l'application Expo existante.

## Infrastructure

- Déploiement : Cloudflare Pages (`https://fader.pages.dev`).
- Base distante : Supabase.
- Fichiers audio : Cloudflare R2.

## Routage des tâches

- **Annonce obligatoire** : avant toute analyse, commande ou modification, afficher exactement une ligne `Routage : <Lite|Standard|Strict|APEX|Antigravity> — <justification brève>`.
- **Lite** : traiter directement la documentation, le CSS, un petit composant, un test ciblé ou une correction isolée. Ne pas lancer APEX ni de sous-agent.
- **Standard** : traiter directement une fonctionnalité ou un bug cohérent touchant plusieurs fichiers. Utiliser au maximum un `pwa_explorer` en lecture seule uniquement si l'exploration isolée apporte une valeur réelle, puis exécuter `verify:fast`.
- **Strict** : produire un plan détaillé pour Service Worker, IndexedDB, synchronisation, authentification, sécurité, migration ou release. Si nécessaire, utiliser un seul `pwa_explorer`, attendre son résultat, implémenter, puis utiliser `pwa_reviewer` pour relire le diff et exécuter `verify:full`.
- Ne jamais lancer APEX automatiquement. Utiliser APEX uniquement lorsque l'utilisateur le demande explicitement.
- Utiliser Antigravity uniquement pour une tâche longue, bornée, vérifiable et explicitement déléguée par l'utilisateur.

## Méthode

- Commencer par `git status --short`, `git diff --stat` et les fichiers explicitement concernés.
- Utiliser `rg` pour les recherches ciblées et préserver les changements utilisateur sans rapport.
- Travailler par petites étapes testables, sans abstraction générale inutile.
- Utiliser TypeScript strict et conserver les contraintes mobile-first et offline-first.
- Ne pas ajouter de dépendance sans nécessité démontrée.
- Lire `.agents/rules/rules.md` uniquement pour une tâche liée à la migration web, la base locale, la synchronisation ou l'import/export.
- Lire la documentation spécialisée uniquement lorsqu'elle concerne directement la tâche.

## Validation

- Utiliser `powershell -File scripts/ai/verify-pwa.ps1` après une modification de code.
- Utiliser l'option `-Full` avant une livraison, un commit, une release ou à la demande explicite.
- Une tâche est terminée lorsque le comportement demandé fonctionne, les contrôles ciblés passent et aucun fichier sans rapport n'a été modifié.
- Le rapport final doit indiquer les fichiers modifiés, les validations exécutées et les risques restants.
