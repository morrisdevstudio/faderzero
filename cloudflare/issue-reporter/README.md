# Issue reporter Worker

Le Worker reçoit les signalements de la PWA, valide la session Supabase, stocke la capture dans R2 et crée l’issue GitHub.

Avant le premier déploiement, créer un fine-grained personal access token GitHub limité au dépôt `morrisdevstudio/faderzero`, avec la permission `Issues: Read and write`, puis le saisir localement sans l’ajouter à un fichier ni à l’historique du terminal :

```powershell
npx wrangler@4.118.0 secret put GITHUB_TOKEN --config cloudflare/issue-reporter/wrangler.jsonc
```

Vérifier ensuite sa présence (la valeur n’est jamais affichée) :

```powershell
npx wrangler@4.118.0 secret list --config cloudflare/issue-reporter/wrangler.jsonc
```

Le workflow de déploiement s’arrête si ce secret n’existe pas dans Cloudflare.
