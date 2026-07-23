# Pause 5 — Validation audio complète

Statut : `pending`

L’Epic 5 est implémenté et placé en `user-validation`. L’Epic 6 reste verrouillé jusqu’à validation explicite de cette pause.

## Garde-fous

- Ne jamais utiliser une URL de production pour les tests SQL.
- Ne déplacer, réécrire ou supprimer aucun objet R2 historique.
- Le cron Worker consigne les orphelins en quarantaine ; il ne les supprime pas.
- Rejouer la comparaison du manifeste sur une copie figée de production avant déploiement.
- Configurer `URL_SIGNING_SECRET` et `SUPABASE_SECRET_KEY` avec `wrangler secret put`, jamais dans un fichier versionné.

## Validation automatique

Résultats locaux du 22/07/2026 :

- Typecheck application et Worker : réussis.
- Lint : réussi avec deux avertissements préexistants hors Epic 5.
- Tests : 29 fichiers et 126 tests réussis.
- Build PWA : réussi.
- Types Wrangler : à jour.
- Tests SQL 5.1 et 5.2 : réussis (`DO`, puis `ROLLBACK` pour 5.2).
- Supabase DB lint : aucune erreur.
- Supabase advisors sécurité : aucune alerte.
- Comparaison R2 locale : 24 divergences consignées, aucune écriture ni suppression R2.

```powershell
npm run typecheck
npm run lint
npm test
npm run build
npx tsc --noEmit -p .\cloudflare\audio-worker\tsconfig.json
npx --yes wrangler types --check --config .\cloudflare\audio-worker\wrangler.jsonc .\cloudflare\audio-worker\worker-configuration.d.ts
npx --yes supabase db lint --local --schema public,private --level warning --fail-on error
npx --yes supabase db advisors --local --type security --level warn --fail-on error
```

Tests SQL locaux :

```powershell
docker cp .\supabase\tests\epic-5-1-audio-files.sql supabase_db_pwa:/tmp/epic-5-1-audio-files.sql
docker exec supabase_db_pwa psql -U postgres -d postgres -X -v ON_ERROR_STOP=1 -f /tmp/epic-5-1-audio-files.sql
docker cp .\supabase\tests\epic-5-2-audio-quotas.sql supabase_db_pwa:/tmp/epic-5-2-audio-quotas.sql
docker exec supabase_db_pwa psql -U postgres -d postgres -X -v ON_ERROR_STOP=1 -f /tmp/epic-5-2-audio-quotas.sql
powershell -ExecutionPolicy Bypass -File .\scripts\compare-epic-5-r2-manifest.ps1
```

## Parcours manuels à valider

### Mon espace

- [ ] Importer un WAV, un M4A, un FLAC puis un MP3 et constater une conversion MP3 192 kb/s avant upload.
- [ ] Vérifier que l’usage est exprimé en durée, que le restant est visible et que l’alerte apparaît à 80 %.
- [ ] Vérifier qu’un import dépassant une heure cumulée est refusé sans objet R2 partiel.
- [ ] Lire un audio historique et un nouvel audio, puis tester avance/reprise via une réponse `206`.
- [ ] Mettre un audio en cache, passer hors ligne et vérifier la lecture.

### Groupe

- [ ] Répéter import, lecture et cache avec un administrateur puis un membre.
- [ ] Vérifier qu’un invité peut lire mais ne peut pas uploader et ne voit pas le quota.
- [ ] Vérifier que le quota est exprimé en taille avec une limite de 5 Gio et une alerte à 80 %.
- [ ] Lancer trois imports en parallèle avec le même compte : le troisième doit attendre ou échouer en `429`.
- [ ] Interrompre un upload et vérifier qu’un nouvel essai n’est pas bloqué par une réservation fantôme.

### Cycle de vie et sécurité

- [ ] Supprimer localement un audio non nécessaire et vérifier qu’il disparaît des listes actives sans suppression physique R2 immédiate.
- [ ] Vérifier qu’une URL signée expire après cinq minutes et qu’une signature modifiée échoue.
- [ ] Retirer un membre, actualiser ses appartenances et vérifier qu’il ne peut plus créer de nouvelle URL.
- [ ] Contrôler les logs Worker : aucune query string de signature et aucune clé secrète.
- [ ] Contrôler la quarantaine après le cron : aucune suppression automatique.

## Critère de sortie

La Pause 5 passe à `done` uniquement après validation explicite des parcours ci-dessus. Ensuite seulement, l’Epic 6 peut être déverrouillé.
