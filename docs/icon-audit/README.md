# Audit des icônes

## Algorithme d’empreinte SVG

`npm run icons:audit` parcourt les fichiers TypeScript avec l’AST TypeScript, sans expression régulière globale pour analyser le TS/TSX. Chaque SVG est réduit à une sérialisation de forme : la racine conserve `viewBox`; les formes conservent `path[d]`, `rect[x,y,width,height,rx,ry]`, `circle[cx,cy,r]`, `line[x1,y1,x2,y2]`, `polyline[points]` et `polygon[points]`. Les valeurs gardent leur géométrie avec les espaces compressés; les attributs retenus sont écrits dans un ordre fixe. `class`, `className`, `aria-label`, `title`, `width`, `height` et les attributs de présentation sont ignorés. L’ordre des éléments est conservé car il peut modifier les superpositions. Un SHA-256 de cette sérialisation est l’empreinte stable : un changement de formatage ou d’ordre des attributs non significatif ne la modifie pas.

Ce dossier prépare l'audit des icônes de FaderZero. Cette phase ne modifie ni les icônes affichées, ni le CSS, ni la mise en page : elle établit seulement les emplacements de travail, les registres et les commandes qui seront implémentés ultérieurement.

## Règle d'inventaire

**Une occurrence visible = une ligne.** Une même forme SVG utilisée à deux endroits visibles doit donc produire deux entrées distinctes dans `icon-inventory.json`. L'inventaire décrira l'emplacement rendu, la route ou l'état concerné et le contexte d'utilisation, plutôt que de dédupliquer uniquement par dessin.

## Formats détectés actuellement

- SVG inline en JSX (`<svg>`) pour les icônes d'interface.
- Ressources SVG statiques, notamment le favicon et `public/icons.svg`.
- Ressources PNG statiques pour les icônes PWA et Apple touch (`public/pwa-192x192.png`, `public/pwa-512x512.png`, `public/maskable-icon-512x512.png`, `public/apple-touch-icon.png`).
- Images dynamiques affichées par `<img>`, dont le QR code en data URL et les avatars distants : elles devront être distinguées des icônes d'interface pendant l'audit.

Aucune bibliothèque d'icônes n'est référencée à ce stade. L'audit ne constitue pas un remplacement.

## Routes et pages à couvrir

Les routes applicatives actuellement déclarées sont :

- `/` et `/home` — accueil (`HomePage`).
- `/calendar` — calendrier (`CalendarPage`).
- `/booking` — réservation (`BookingPage`).
- `/songs` — bibliothèque/imports (`ImportsPage`).
- `/songs/:songId` — détail d'un morceau (`SongDetailPage`).
- `/songs/:songId/write` — écriture d'un morceau (`SongWriterPage`).
- `/setlists` — setlists (`SetlistsPage`).
- `/setlists/:setlistId` — détail d'une setlist (`SetlistDetailPage`).
- `/prompter` — bibliothèque du prompteur (`PrompterLibraryPage`).
- `/prompter/play` — lecture du prompteur (`PrompterPage`).
- `/sync` — synchronisation (`SyncPage`).
- `/metronome` — métronome (`MetronomePage`).
- `/account` — compte (`AccountPage`).
- `/imports` et `/musiques` — redirections vers `/songs`.

Les écrans conditionnels hors route à couvrir sont : démarrage (`SplashScreen`), connexion (`LoginPage`), sélection d'espace (`WorkspaceSelectionPage`) et invitation d'espace (`WorkspaceInvitePage`). Les modales et composants transverses visibles devront être couverts dans le contexte de la page où ils apparaissent.

## Statuts

- `discovered` : occurrence repérée, pas encore examinée.
- `review` : occurrence en cours d'examen.
- `proposed` : proposition de traitement formulée, sans décision.
- `approved` : traitement approuvé pour une phase ultérieure.
- `rejected` : proposition refusée ; l'occurrence reste inchangée.
- `migrated` : remplacement réalisé dans une phase dédiée.
- `verified` : rendu et comportement du remplacement vérifiés.
- `custom-kept` : icône personnalisée conservée volontairement.

## Registre central prévu

Une phase ultérieure introduira un registre central dans `src/ui/icons`. Il concentrera les exports d'icônes approuvées et leur contrat de taille, couleur et accessibilité. Les composants consommateurs ne basculeront vers ce registre qu'après l'inventaire, la décision de migration et la validation visuelle ; ce dossier ne le crée pas encore.

## Registres et captures

- `icon-inventory.json` : occurrences visibles inventoriées.
- `icon-migration.json` : décisions et suivi de migration.
- `icon-allowlist.json` : exceptions explicitement autorisées.
- `screenshots/pages` : captures de référence par page.
- `screenshots/icons` : captures centrées sur les icônes ou leurs états.

Les commandes `icons:audit`, `icons:capture`, `icons:export` et `icons:validate` sont réservées dans `package.json`. Seule `icons:audit` est implémentée dans cette phase ; les trois autres restent réservées pour les phases suivantes.

`icons:audit` est maintenant implémentée dans `scripts/audit-icons.mjs`. Elle analyse également les références PWA d’`index.html` et de `public/manifest.webmanifest` afin d’inventorier les images réellement déclarées comme icônes.

## Socle Playwright

Installez Chromium avec `npm run e2e:install`. Les tests s’exécutent avec `npm run e2e`, ou en interface avec `npm run e2e:ui`; `npm run e2e:headed` affiche le navigateur. Playwright démarre lui-même Vite au moyen de `webServer` dans `playwright.config.ts`; aucun serveur ni script de démarrage séparé n’est nécessaire.

Le smoke test `e2e/smoke.spec.ts` vérifie l’écran de connexion réellement rendu sans session. Il précède les futurs scénarios de navigation et de capture visuelle des icônes.

Les scénarios authentifiés utilisent exclusivement `E2E_EMAIL`, `E2E_PASSWORD` et, si nécessaire, `E2E_WORKSPACE_NAME`. Copiez `.env.e2e.example` dans un fichier local ignoré ou définissez ces variables dans votre environnement ; aucun identifiant ne doit être ajouté au dépôt. Le projet Playwright `setup` crée `playwright/.auth/user.json`, également ignoré, avant les scénarios Chromium. La matrice initiale est versionnée dans `playwright-scenarios.json`; elle ne réalise aucune mutation métier.

`npm run icons:capture` lance les scénarios statiques prêts via Playwright et son `webServer` Vite. Chaque SVG visible reçoit uniquement dans le DOM de test `data-icon-audit-instance=<scenarioId>-<ordinal>` : cette convention est déterministe par scénario, n’est ni compilée ni envoyée en production, et distingue les instances d’un même composant. Le runner rapproche ensuite l’empreinte de forme avec l’inventaire et écrit `capture-report.json` ainsi que les captures sous `screenshots/`. Ces résultats générés restent locaux et sont ignorés par Git.
