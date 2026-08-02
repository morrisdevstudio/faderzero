---
name: push-cloudflare
description: Publie les changements locaux de FaderZero directement sur la branche main avec un commit nommé d'après le diff, puis un vrai git push qui déclenche le hook Cloudflare. Utiliser cette skill dès que l'utilisateur demande /push-cloudflare, veut publier sur main sans branche ni pull request, ou veut commit et push vers Cloudflare.
compatibility: Dépôt Git FaderZero sur main, remote origin configuré, Docker Desktop démarré pour le hook pre-push.
---

# Push Cloudflare

Publier le contenu courant du dépôt directement sur `origin/main`. Ce workflow ne crée ni branche, ni pull request, ni tag et ne contourne jamais le hook `pre-push`.

## Workflow

1. Vérifier le contexte avec `git status --short --branch`, `git branch --show-current` et `git remote get-url origin`.
2. Si la branche courante n'est pas exactement `main`, arrêter et signaler le blocage. Ne pas changer de branche et ne pas fusionner automatiquement.
3. Inspecter `git diff --stat`, `git diff`, `git diff --cached --stat` et les fichiers non suivis afin de comprendre tous les changements à publier.
4. Si un fichier sensible non ignoré est détecté (`.env`, clé privée, token ou secret), arrêter avant le staging et indiquer le fichier concerné sans afficher sa valeur.
5. Générer un message de commit anglais, précis et limité à 72 caractères, à partir du changement dominant :
   - `feat: ...` pour une capacité visible par l'utilisateur ;
   - `fix: ...` pour une correction de comportement ;
   - `test: ...` pour des tests uniquement ;
   - `docs: ...` pour de la documentation uniquement ;
   - `refactor: ...` pour une restructuration sans changement fonctionnel ;
   - `chore: ...` pour l'outillage, la CI ou la configuration.
6. Éviter les messages vagues comme `update`, `changes`, `misc` ou `fix stuff`. Résumer l'intention commune si plusieurs fichiers participent au même changement.
7. Ajouter l'ensemble du worktree avec `git add -A`, car l'appel explicite à cette skill signifie que l'utilisateur veut publier tous les changements courants.
8. Vérifier le contenu préparé avec `git diff --cached --stat` et `git diff --cached --check`.
9. S'il existe des changements préparés, créer le commit avec `git commit -m "<message généré>"`.
10. S'il n'existe aucun changement préparé, vérifier `git rev-list --count origin/main..main` :
    - si le résultat vaut `0`, terminer en indiquant qu'il n'y a rien à publier, sans lancer le hook coûteux ;
    - sinon, poursuivre avec le push des commits locaux existants.
11. Exécuter exclusivement `git push origin main`. Ne jamais utiliser `--no-verify`, l'interface graphique de push, une API GitHub ou un push forcé.
12. Laisser le hook `.githooks/pre-push` exécuter le contrôle Docker Cloudflare. S'il échoue, ne pas le contourner, ne pas recommencer inchangé et rapporter la première cause réelle.
13. Après réussite, vérifier `git status --short --branch` et `git rev-list --left-right --count origin/main...main`.

## Résultat attendu

Répondre uniquement avec :

- le hash court et le message du commit créé, ou l'indication qu'un commit existant a été utilisé ;
- la confirmation que le contrôle Cloudflare a réussi ;
- la confirmation que `main` et `origin/main` sont synchronisés ;
- les éventuels changements restés locaux.

Ne pas ouvrir de pull request et ne pas annoncer que Cloudflare a fini de déployer tant que seul le push Git est confirmé.
