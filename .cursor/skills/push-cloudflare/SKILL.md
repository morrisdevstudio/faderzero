---
name: push-cloudflare
description: Publie FaderZero sur main après gates locale, live Cloudflare et GitHub. Utiliser pour /push-cloudflare, publier sur main sans PR, ou commit et push vers Cloudflare.
---

# Push Cloudflare

Publier `origin/main` uniquement via le script. Pas de branche, PR, tag, `--no-verify`, force push, ni rejeu manuel de git/wrangler.

## Workflow

1. `git status --short` et `git diff --stat` seulement.
2. Si dirty, message anglais conventional ≤72c : `feat|fix|test|docs|refactor|chore: ...`
3. Une commande :

```powershell
powershell -ExecutionPolicy Bypass -File scripts/ai/push-cloudflare.ps1 -CommitMessage "<message>"
```

Si le scoreboard dit `CRITICAL prod-ahead-of-git`, relancer avec `-GitPushOnly` uniquement.

## Réponse

Coller le scoreboard stdout. Succès = `LOCAL PASS` + `LIVE PASS` + `GIT ... synced`. Ne pas lire le fichier de log. En échec, coller la porte et les 20 lignes déjà affichées ; ne pas relancer inchangé.
