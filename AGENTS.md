# FaderZero

Migration progressive de FaderZero vers une PWA offline-first, sans casser l'application Expo existante.

## Infrastructure

- L'application est déployée sur Cloudflare Pages : `https://fader.pages.dev`.
- La base de données est hébergée en ligne sur Supabase.
- Les fichiers audio sont stockés dans un bucket Cloudflare R2.

## Rules

Les règles détaillées vivent dans `.agents/rules/`. Lire le fichier pertinent avant d'agir :


## Universal Rules

- **ALWAYS**: Utilise le skill `/apex` avec les arguments `-a` et `-e` pour toute demande, sauf si l'utilisateur demande explicitement de ne pas l'utiliser.
