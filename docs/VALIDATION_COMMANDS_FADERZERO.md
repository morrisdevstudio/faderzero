# Commandes de validation — FaderZero

Ces commandes s’exécutent depuis la racine du dépôt. Elles ne doivent jamais afficher de secret.

## Application

```powershell
npm run typecheck
npm run lint
npm test
npm run build
```

Référence actuelle : 36 fichiers de tests et 147 tests. Une baisse inattendue du nombre de tests bloque la validation.

## Epic 9 — Durcissement avant production

```powershell
# Contrôle statique de la CSP et des en-têtes appliqués par Caddy
npm run security:headers
npm run security:secrets
npm audit --audit-level=high
npm run typecheck:worker
npm run test:worker
npx wrangler types --check --config .\cloudflare\audio-worker\wrangler.jsonc .\cloudflare\audio-worker\worker-configuration.d.ts

# Contrôles PostgreSQL et matrices RLS critiques
npx supabase@2.109.1 db lint --local --schema public,private --level warning --fail-on error
npx supabase@2.109.1 db advisors --local --type security --level warn --fail-on error
docker cp .\supabase\tests\epic-1-rls.sql supabase_db_pwa:/tmp/epic-1-rls.sql
docker exec supabase_db_pwa psql -U postgres -d postgres -X -v ON_ERROR_STOP=1 -f /tmp/epic-1-rls.sql
docker cp .\supabase\tests\epic-9-events-rls.sql supabase_db_pwa:/tmp/epic-9-events-rls.sql
docker exec supabase_db_pwa psql -U postgres -d postgres -X -v ON_ERROR_STOP=1 -f /tmp/epic-9-events-rls.sql
```

Tailscale Serve termine TLS et relaie vers Caddy en `https+insecure://localhost:8443`; Caddy ajoute `Strict-Transport-Security: max-age=31536000; includeSubDomains` à cette réponse HTTPS. La recette complète et les critères utilisateur sont consignés dans `docs/reports/PAUSE_9_VALIDATION_FADERZERO.md`.

## Epic 10 — Gate de retrait du legacy

```powershell
# Doit rester en échec tant que deux versions et trente jours ne sont pas prouvés
npm run epic10:gate

# Audit strictement en lecture seule
docker cp .\supabase\audit\epic-10-observation.sql supabase_db_pwa:/tmp/epic-10-observation.sql
docker exec supabase_db_pwa psql -U postgres -d postgres -X -v ON_ERROR_STOP=1 -f /tmp/epic-10-observation.sql

# RPC d’observation et protections d’accès
docker cp .\supabase\tests\epic-10-compatibility-observation.sql supabase_db_pwa:/tmp/epic-10-compatibility-observation.sql
docker exec supabase_db_pwa psql -U postgres -d postgres -X -v ON_ERROR_STOP=1 -f /tmp/epic-10-compatibility-observation.sql
```

Le retrait est interdit tant que `docs/reports/EPIC_10_OBSERVATION.json` ne fait pas passer le gate. Un échec du script est actuellement le résultat correct.

## Epic 2 — Invitations

```powershell
# Appliquer uniquement les migrations locales manquantes
supabase migration up --local

# Expansion/backfill et RPC atomiques
supabase db query --local --file .\supabase\tests\epic-2-1-invite-expansion.sql
supabase db query --local --file .\supabase\tests\epic-2-invite-rpcs.sql

# Deux consommations simultanées du même token
powershell -ExecutionPolicy Bypass -File .\scripts\test-epic-2-invite-concurrency.ps1

# Contrôles de schéma et de sécurité
supabase db lint --local --schema public,private --level warning --fail-on error
supabase db advisors --local --type security --level warn --fail-on error
```

Les tests SQL Epic 2 sont chacun une instruction atomique `DO` compatible avec `supabase db query`. Ils nettoient leurs lignes de test avant de réussir ; toute erreur annule automatiquement le bloc courant.

## Epic 1 — Autorisations

```powershell
# Matrice SQL transactionnelle (4 rôles, RPC et intégrité)
docker cp .\supabase\tests\epic-1-rls.sql supabase_db_pwa:/tmp/epic-1-rls.sql
docker exec supabase_db_pwa psql -U postgres -d postgres -X -v ON_ERROR_STOP=1 -f /tmp/epic-1-rls.sql

# Course réelle entre deux rétrogradations du dernier admin
powershell -ExecutionPolicy Bypass -File .\scripts\test-epic-1-last-admin-concurrency.ps1

# Contrôles Supabase
supabase db lint --local --level error
supabase db advisors --local
```

Les scripts SQL ouvrent une transaction et terminent par `ROLLBACK`. Le test concurrent utilise uniquement des UUID et comptes réservés au test, puis les supprime dans un bloc `finally`.

## Artefacts BMAD

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\validate-epic-0-artifacts.ps1
```

## Epic 5 — Audios, quotas et Worker R2

```powershell
npx --yes supabase migration up --local
docker cp .\supabase\tests\epic-5-1-audio-files.sql supabase_db_pwa:/tmp/epic-5-1-audio-files.sql
docker exec supabase_db_pwa psql -U postgres -d postgres -X -v ON_ERROR_STOP=1 -f /tmp/epic-5-1-audio-files.sql
docker cp .\supabase\tests\epic-5-2-audio-quotas.sql supabase_db_pwa:/tmp/epic-5-2-audio-quotas.sql
docker exec supabase_db_pwa psql -U postgres -d postgres -X -v ON_ERROR_STOP=1 -f /tmp/epic-5-2-audio-quotas.sql
powershell -ExecutionPolicy Bypass -File .\scripts\compare-epic-5-r2-manifest.ps1
npx tsc --noEmit -p .\cloudflare\audio-worker\tsconfig.json
npx --yes wrangler types --check --config .\cloudflare\audio-worker\wrangler.jsonc .\cloudflare\audio-worker\worker-configuration.d.ts
```

Le rapport manuel et les garde-fous de passage sont dans `docs/reports/PAUSE_5_VALIDATION_FADERZERO.md`.

## Inventaire SQL en lecture seule

Exécuter deux fois `supabase/audit/epic-0-inventory.sql` sur la même copie figée, exporter chaque résultat en CSV, puis comparer les SHA-256 :

```powershell
Get-FileHash .\artifacts\epic-0\inventory-run-1.csv -Algorithm SHA256
Get-FileHash .\artifacts\epic-0\inventory-run-2.csv -Algorithm SHA256
```

Le rôle utilisé ne doit disposer que de `CONNECT`, `USAGE` et `SELECT`. Le script refuse une transaction non `READ ONLY`.

## Garde-fous sauvegarde/restauration

- Ne jamais utiliser l’URL de production comme cible de restauration.
- La cible doit être une instance isolée explicitement nommée.
- Comparer tous les comptages avant/après et bloquer sur toute diminution.
- Comparer le manifeste R2 par clé, taille et ETag ; aucun objet manquant n’est toléré.
- Tester une authentification restaurée et un échantillon audio avant toute migration.

Les commandes `pg_dump`, `psql`, Supabase CLI et Wrangler ne sont pas installées automatiquement par le dépôt. Leur installation et les accès administrateur sont des prérequis contrôlés de Stories 0.3 et 0.4.
