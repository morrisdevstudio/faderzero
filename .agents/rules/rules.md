# PWA Migration

Règles obligatoires pour faire coexister l'application Expo existante et la nouvelle PWA.

## When this applies

- Toute demande liée à  la migration web, la base locale, la sync ou l'import/export.

## Rules

- **ALWAYS**: Travaille par petites étapes testables.
- **ALWAYS**: Avant chaque modification importante, explique le plan.
- **ALWAYS**: Après modification, donne la liste des fichiers changés, les commandes à lancer et les risques restants.
- **ALWAYS**: Utilise TypeScript strict pour le code de la PWA.
- **ALWAYS**: Conçois l'interface en mobile-first.
- **ALWAYS**: Conçois la PWA en offline-first.
- **NEVER**: Introduis de grosses abstractions inutiles.