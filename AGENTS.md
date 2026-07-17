# FaderZero

Migration progressive de FaderZero vers une PWA offline-first, sans casser l'application Expo existante.

## Rules

Les règles détaillées vivent dans `.agents/rules/`. Lire le fichier pertinent avant d'agir :

- **PWA Migration** - [.agents/rules/pwa-migration.md](.agents/rules/pwa-migration.md) - Contraintes obligatoires pour la coexistence `expo/` et `pwa/`.

## Universal Rules

- **ALWAYS**: Utilise le skill `/apex` avec les arguments `-a` et `-e` pour toute demande, sauf si l'utilisateur demande explicitement de ne pas l'utiliser.
- **CRITICAL**: Ne casse jamais l'application Expo existante dans `expo/`.
- **CRITICAL**: Ne modifie pas les fichiers Expo sauf demande explicite de l'utilisateur.
- **CRITICAL**: Toute nouvelle implémentation web doit vivre dans `pwa/` et rester offline-first.
- **ALWAYS**: Après chaque modification, lance `npm run deploy:test` (depuis le dossier `pwa/`) pour déployer l'application sur Tailscale.
