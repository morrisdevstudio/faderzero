# Issue reporter Worker

Le Worker reçoit les signalements de la PWA, valide la session Supabase, stocke la capture dans R2 et crée l’issue GitHub.

Avant le premier déploiement, créer un fine-grained personal access token GitHub avec les réglages suivants :

- `Resource owner` : `morrisdevstudio` ;
- `Repository access` : `Only select repositories`, puis `faderzero` ;
- `Repository permissions` : `Issues: Read and write` (`Metadata: Read` est ajouté automatiquement).

Un jeton créé pour un autre propriétaire, sans le dépôt sélectionné ou encore en attente d’approbation provoque un refus GitHub `403`. Saisir ensuite le jeton localement sans l’ajouter à un fichier ni à l’historique du terminal :

```powershell
npx wrangler@4.118.0 secret put GITHUB_TOKEN --config cloudflare/issue-reporter/wrangler.jsonc
```

Vérifier ensuite sa présence (la valeur n’est jamais affichée) :

```powershell
npx wrangler@4.118.0 secret list --config cloudflare/issue-reporter/wrangler.jsonc
```

Le workflow de déploiement s’arrête si ce secret n’existe pas dans Cloudflare.
