# Plan de standardisation UI — état croisé dépôt et Notion

> **État au 17 août 2026**
> **Références** : [règle locale du design system](../.agents/rules/design-system.md), [catalogue UI Notion](https://app.notion.com/p/3b397be39ba781fa8686fd2b91574062), [direction graphique Notion](https://app.notion.com/p/3b197be39ba7812b80c9d72fde08becd), [chantier d’icônes Notion](https://app.notion.com/p/3b497be39ba7815c8b3af61fcba3ee08)
> **But** : terminer la convergence de l’interface sans refaire ce qui est déjà livré ni régresser les corrections validées dans Notion.

## 1. Sources d’autorité et statuts

L’ordre d’autorité est le suivant :

1. le dépôt pour l’existence, le comportement et l’API réelle des composants ;
2. le catalogue Notion pour les décisions UI validées par l’humain ;
3. la direction graphique Notion pour les fondations et les principes visuels ;
4. le chantier d’icônes Notion pour le choix et la migration des icônes.

Ce document utilise quatre statuts :

- **Livré** : présent et utilisable dans le dépôt ;
- **Validé, migration incomplète** : référence approuvée, mais encore contournée par certains écrans ;
- **Draft** : proposition à documenter et valider avant toute migration générale ;
- **Dette confirmée** : écart observé dans le dépôt et non déjà couvert par une livraison validée.

## 2. Photographie croisée

| Sujet | Statut réel | Acquis à préserver | Travail restant |
| --- | --- | --- | --- |
| Tokens et thème sombre dans [`styles.css`](../src/app/styles.css) | **Livré** | Fonds, panneaux, bordures, textes, accent, succès et danger existants | Évaluer les besoins `warning`, `info` et `selected` avant de créer de nouveaux tokens |
| [`AddButton`](../src/ui/components/AddButton.tsx) | **Livré et validé** | API sans variante locale, cible 44 × 44 px, rôle `add` | Remplacer uniquement les ajouts locaux encore présents |
| [`PageHeader`](../src/ui/components/PageHeader.tsx) | **Validé, migration prioritaire terminée** | Structure responsive, recherche et tri partagés ; `SongsPage` migré avec titre, permissions et états conservés | Poursuivre uniquement sur les pages principales encore identifiées hors standard |
| [`DetailHeader`](../src/ui/components/DetailHeader.tsx) | **Livré, validé et migration prioritaire terminée** | Retour et actions neutres, cibles 44 × 44 px, titres tronqués ; détails morceau et setlist alignés | Conserver les couleurs métier dans le contenu, jamais sur les actions du sous-header |
| [`AppHeader`](../src/ui/components/AppHeader.tsx) | **Livré et validé** | Logo, sélecteur de groupe et badge d’identité unifiés | Aucun redesign général |
| [`StatusPill`](../src/ui/components/StatusPill.tsx) | **Livré et validé** | États courts non interactifs, API réelle `label` + `tone` | Ne pas l’utiliser pour un type d’entité ou un badge d’identité |
| Champs texte, recherche, mot de passe, date, heure et sélection | **Livré et validé** | APIs natives contraintes, styles partagés et labels `.fz-field-label` généralisés | Aucun nouveau champ ad hoc ; maintenir les composants canoniques |
| [`FormDialog`](../src/components/FormDialog.tsx) et [`PickerDialog`](../src/components/PickerDialog.tsx) | **Validated — canoniques, migrations prioritaires terminées** | Portail, backdrop, Échap, focus confiné et restauré, scroll verrouillé, fermeture verrouillable pendant une action, titres/descriptions associés, fermeture via `FzIcon`, safe areas, hauteur dynamique défilable, réduction de mouvement, tests ciblés, contrôles navigateur et approbation humaine | `TrashModal`, `CopySongModal` et `EventFormModal` sont migrés ; traiter les autres modales locales uniquement lors de leurs chantiers respectifs |
| [`ContentRow`](../src/ui/components/ContentRow.tsx) | **Livré et validé (composant canonique)** | Structure dense, 3 modes discriminés (`link`, `button`, `controls`), `leading`, `trailing`, `status`, sans carte flottante | Migrer progressivement les 3 usages pilotes (`SongsPage`, `CalendarPage`, `ImportsPage`) |
| Tuile ordonnée de setlist | **Référence visuelle approuvée à préserver** | Surface arrondie, numéro, métadonnées, transitions et actions monter/descendre | Ne pas la fusionner avec `ContentRow`; n’extraire un éventuel `SetlistEntry` qu’à rendu et comportement strictement identiques |
| [`Button`](../src/ui/components/Button.tsx) | **Livré et validé (composant canonique)** | 4 variantes (`primary`, `secondary`, `danger`, `ghost`), 3 tailles, min-height $\ge 44\text{ px}$, loading et icônes | Migrer progressivement les boutons ad hoc lors des révisions d'écrans |
| [`FieldLabel`](../src/ui/components/FieldLabel.tsx) | **Livré et validé (composant canonique)** | Typographie `.fz-field-label`, support `required`, `optional`, `htmlFor` et flexibilité de mise en page | Utiliser dans les formulaires existants et futurs |
| Registre [`FzIcon`](../src/ui/icons/FzIcon.tsx) | **Livré, migration incomplète** | Rôles sémantiques, tailles partagées, manifeste publié | Ne migrer que les occurrences approuvées dans le catalogue |
| Audit des icônes | **Infrastructure livrée** | 158 occurrences inventoriées, Playwright, captures et catalogue local | Les 158 décisions restent `discovered`; le manifeste de migration est vide |
| Modales locales, labels et boutons ad hoc | **Dette résiduelle ciblée** | Comportements métier existants | Traiter les modales et boutons restants lors de la phase 3 |
| Couleurs locales Zinc, Orange, Ambre et Indigo | **À qualifier par leur sens** | Codes d’état ou de contexte utiles | Remplacer les surfaces neutres par les tokens existants; conserver ou normaliser les couleurs sémantiques après décision explicite |

### 2.1 `ContentRow` et tuile de setlist

**Décision humaine du 17 août 2026 :** les morceaux, les événements et les fichiers audio doivent converger vers un seul composant visuel `ContentRow`. La tuile ordonnée de [`SetlistDetailPage`](../src/features/setlists/SetlistDetailPage.tsx) est considérée comme réussie et reste un motif séparé à préserver.

`ContentRow` partage la structure, la densité, les séparateurs, la typographie et les états visuels, mais conserve trois modes d’interaction explicites :

| Usage pilote | Mode | Composition |
| --- | --- | --- |
| Morceau dans [`SongsPage`](../src/features/songs/SongsPage.tsx) | `link` | Ligne entière navigable, titre et métadonnées, `StatusPill` non interactif à droite |
| Événement dans [`CalendarPage`](../src/features/events/CalendarPage.tsx) | `button` | Ligne entière ouvrant le détail, identité de calendrier et badge non interactif |
| Fichier audio dans [`ImportsPage`](../src/features/imports/ImportsPage.tsx) | `controls` | Lecture/arrêt à gauche, nom et durée au centre, état hors ligne et menu à droite ; la ligne elle-même n’est pas activable |

API envisagée, à maintenir au statut **Draft** jusqu’à validation :

```typescript
type ContentRowProps = {
  title: ReactNode;
  metadata?: ReactNode;
  leading?: ReactNode;
  trailing?: ReactNode;
  state?: 'default' | 'selected' | 'disabled';
} & (
  | { mode: 'link'; href: string; onActivate?: never }
  | { mode: 'button'; onActivate: () => void; href?: never }
  | { mode: 'controls'; href?: never; onActivate?: never }
);
```

Contraintes de `ContentRow` :

- utiliser une ligne pleine largeur, dense et séparée, sans effet de carte flottante ;
- interdire les contrôles interactifs imbriqués dans les modes `link` et `button` ;
- autoriser les contrôles `leading` et `trailing` dans le mode `controls` ;
- donner aux actions lecture/arrêt, téléchargement et menu audio un nom accessible, un état visible et une cible de 44 × 44 px ;
- tronquer titre et métadonnées sans masquer le statut, l’identité ou les actions ;
- réserver les couleurs, badges et pastilles à une sémantique explicite ;
- couvrir les états normal, survol, focus, actif, sélectionné, désactivé et lecture seule ;
- vérifier les listes longues à 320 px et avec zoom texte.

La tuile de setlist conserve sa surface arrondie, son numéro, ses métadonnées, ses transitions et ses actions de réordonnancement. Elle ne doit subir aucune harmonisation visuelle avec `ContentRow`. Un éventuel composant `SetlistEntry` ne pourra être qu’une extraction technique sans changement de DOM, de dimensions, de couleurs ou de comportement.

`FeatureCard` reste réservé aux états vides, chargements, erreurs et contenus réellement autonomes ; il est hors du périmètre de `ContentRow`.

## 3. Contraintes de non-régression issues des tâches Notion « Fait »

Les onze tâches de la base Todo sont terminées. Les migrations UI doivent préserver au minimum :

- l’identification immédiate du tri, du filtre et de leurs valeurs sélectionnées dans `SortMenu` ;
- le maintien du header et de la barre d’action de l’éditeur lorsque le clavier mobile est ouvert ;
- la confirmation avant suppression d’un événement ;
- les badges de groupe avec fond d’identité et lettres blanches, distincts d’un statut métier ;
- les sous-headers harmonisés et les titres de sous-pages alignés à gauche ;
- les logos de page blancs ;
- les interactions par appui long déjà livrées dans les écrans de morceau ;
- le nettoyage des titres et sous-titres de la page de synchronisation.

Une standardisation visuelle n’autorise pas à modifier ces comportements, ni l’ordre du DOM, les actions, la cible tactile ou la gestion du clavier sans test de non-régression correspondant.

## 4. Feuille de route révisée

### Phase 1 — Accessibilité et robustesse des dialogues

**Avancement au 17 août 2026 : socle technique implémenté, validation technique terminée et validation canonique approuvée humainement.**

Réalisé :

- fermeture par Échap sur les deux composants, limitée au dialogue modal situé au premier plan ;
- focus initial cohérent, avec priorité conservée pour les champs `autoFocus`, confinement du focus et restauration à la fermeture ;
- verrouillage du défilement sous-jacent, y compris lorsque plusieurs dialogues partagés sont empilés ;
- titre relié avec `aria-labelledby` et description de `PickerDialog` avec `aria-describedby` lorsqu’elle existe ;
- remplacement de `&times;` par le rôle `close` de `FzIcon`, sans réduire la cible tactile de 44 × 44 px ;
- tests ciblés de `FormDialog` et `PickerDialog`, plus test de non-régression du focus dans `SongWriterPage` ;
- tests explicites de fermeture par backdrop, sans fermeture lors d’un clic dans le panneau ;
- contrôle dans un navigateur réel à 320 × 700 px : panneaux de 288 px contenus dans le viewport, aucune barre horizontale, scroll arrière verrouillé et boutons fermer de 44 × 44 px ;
- alignement en haut du bouton fermer de `FormDialog` corrigé pour les titres multilignes, puis revérifié à 320 px ;
- prise en compte des safe areas sur les quatre bords et hauteur maximale calculée avec `100dvh`, avec défilement interne sur les deux dialogues ;
- simulation d’ouverture du clavier virtuel par réduction dynamique du viewport de 320 × 700 à 320 × 480 px : `FormDialog` reste entre 64 et 460 px, conserve le champ focalisé visible et devient défilable ; `PickerDialog` reste entre 64 et 464 px et devient défilable ; aucun débordement horizontal observé ;
- absence d’animation d’entrée sur les panneaux et transition du bouton fermer désactivée sous `prefers-reduced-motion: reduce` ;
- approbation humaine du comportement et du rendu enregistrée le 17 août 2026 ; `FormDialog` et `PickerDialog` sont désormais canoniques ;
- option `closeDisabled` ajoutée à `FormDialog` pour bloquer bouton, Échap et backdrop pendant une opération critique ;
- `TrashModal` migré vers `FormDialog` en conservant le chargement, la restauration, le rechargement de la liste, les erreurs et la simulation de purge ; les retours sont annoncés, les actions atteignent 44 px et la ligne s’adapte aux petits écrans ;
- tests ciblés de `TrashModal` ajoutés pour le chargement, la restauration et le dry-run ;
- `CopySongModal` migré vers `FormDialog` en conservant le chargement des espaces, l’option audio, les callbacks et le verrouillage de fermeture pendant la copie ;
- `EventFormModal` migré vers `FormDialog` avec champs empilés à 320 px, labels partagés, erreurs annoncées et actions de 44 px ; la confirmation de suppression reste distincte et obligatoire ;
- `ConfirmDialog` raccordé à la même gestion de pile, de focus, d’Échap, de scroll et de safe areas ; lorsqu’il est ouvert, le formulaire sous-jacent ne se ferme pas et le focus revient à l’action de suppression après annulation ;
- tests ciblés ajoutés pour la copie avec audio, les callbacks, la validation du formulaire d’événement et la suppression confirmée ;
- validation `verify:fast` réussie après l’implémentation.

Clôture :

1. les trois migrations prioritaires sont terminées sans suppression de comportement métier ;
2. toute autre modale locale sera migrée séparément avec ses propres tests de non-régression ;
3. la prochaine étape active de la feuille de route est la phase 2.

**Validation mesurable** : clavier physique et virtuel simulé, Échap, backdrop, focus, restauration, verrouillage du scroll, safe areas, réduction de mouvement, rendu à 320 px et approbation humaine sont couverts. Les six fichiers de tests ciblés totalisent 20 tests réussis, dont les parcours métier de `TrashModal`, `CopySongModal` et `EventFormModal` ; `verify:fast` passe.

### Phase 2 — Migrations ciblées des références validées

**Avancement au 17 août 2026 : Phase 2 terminée. Tous les sous-chantiers ciblés (PageHeader, DetailHeader, FaderLogo, labels `.fz-field-label` et suppressions Setlists) sont livrés, vérifiés et validés visuellement.**

1. **Terminé** — `SongsPage` utilise `PageHeader` avec le rôle partagé `songs`, le titre « Répertoire », l’autorisation d’ajout, la recherche conditionnelle et `SortMenu`. Les états vide, chargement et aucun résultat ainsi que la liste existante restent inchangés ; neuf tests ciblés et `verify:fast` passent.
2. **Terminé** — les actions de `DetailHeader` sur les détails de morceau et de setlist héritent désormais du traitement neutre partagé. Suppression, copie, prompteur, export PDF et modification conservent leurs actions, libellés, icônes et états désactivés ; les couleurs sémantiques du contenu restent intactes. Quatre tests ciblés et `verify:fast` passent.
3. **Terminé** — la connexion réutilise `FaderLogo` en blanc dans sa boîte historique de `147 × 54 px`, avec un nom accessible « FaderZero ». Le SVG et le lettrage locaux ont été retirés ; six tests ciblés, `verify:fast` et la validation visuelle utilisateur passent.
4. **Terminé et validé visuellement — standardisation des labels avec `.fz-field-label`** : l’audit exhaustif confirme que tous les vrais titres de champs de l’application (authentification, sélection de groupe, page Compte, détail Calendrier, formulaires Setlists, parcours Morceaux, Enregistreur vocal, Booking et dialogues Imports) utilisent exclusivement `.fz-field-label`. Les exclusions (libellés de cases à cocher, textes descriptifs, titres de sections, légende de groupe, titre compact de l’éditeur de paroles et outil interne des icônes) sont confirmées et préservées. 46 tests ciblés et `verify:fast` passent.
5. **Terminé et validé visuellement — suppressions Setlists** : « Modifier la setlist » expose une action textuelle pour supprimer la setlist ; chaque ligne de transition expose une action de `44 × 44 px` pour retirer uniquement l’occurrence du morceau. Les deux parcours utilisent `ConfirmDialog`, les soft-deletes existants et la file de synchronisation. Les morceaux restent dans le répertoire, la tuile ordonnée reste inchangée et les erreurs ferment la confirmation pour devenir visibles. Huit tests ciblés couvrent l’interface et les repositories ; les deux parcours ont été approuvés visuellement par l’utilisateur le 17 août 2026.
6. Ne pas remplacer les badges de groupe ou les types d’entités par `StatusPill`.

**Validation mesurable** : captures comparatives à 320, 390/430 px et desktop; titres longs; navigation clavier; contrôles de 44 × 44 px; parcours de tri et de retour inchangés. Tout le socle de la phase 2 est validé.

### Phase 3 — Primitives et motifs standardisés

1. **Terminé** — `Button` canonique livré dans [`src/ui/components/Button.tsx`](../src/ui/components/Button.tsx) avec les 4 variantes (`primary`, `secondary`, `danger`, `ghost`), 3 tailles (`sm`, `md`, `lg`), cible tactile $\ge 44\text{ px}$ garantie, support de `leadingIcon`/`trailingIcon`, état `loading` avec spinner accessible et 8 tests unitaires passants.
2. **Terminé** — `FieldLabel` canonique livré dans [`src/ui/components/FieldLabel.tsx`](../src/ui/components/FieldLabel.tsx) avec typographie stricte `.fz-field-label`, prop `as="label" | "span"`, gestion de `htmlFor`, indicateurs `required` et `optional`, support de `className` et 4 tests unitaires passants.
3. **Terminé** — `ContentRow` canonique livré dans [`src/ui/components/ContentRow.tsx`](../src/ui/components/ContentRow.tsx) avec les 3 modes discriminés (`link`, `button`, `controls`), support de `to` pour étendre la zone cliquable sur `controls`, support des zones `leading`, `trailing`, `status`, gestion des styles dynamiques et tests unitaires complets.
4. **Terminé** — Préservation sanctuarisée de la tuile ordonnée de setlist (`SetlistDetailPage`) comme référence séparée exclue de `ContentRow`.
5. **Terminé** — Migration complète de l'ensemble des candidats prioritaires et secondaires :
   - Usages pilotes : `SongsPage` (`mode="link"`), `CalendarPage` (`mode="button"`), `ImportsPage` (`mode="controls"` avec lien englobant).
   - Candidats primaires : `SetlistsPage` (`mode="link"`), `PrompterLibraryPage` (`mode="link"` pour setlists et morceaux), `HomePage` (`mode="link"` pour créations et événements), `BookingPage` (`mode="link"` pour les propositions de concerts).
   - Candidats secondaires : `TrashModal` (`mode="controls"` avec trailing de restauration) et `SongDetailPage` (`mode="controls"` pour les pistes audio associées).

**Validation mesurable** : fiches Notion complètes, 95 fichiers / 451 tests Vitest passants (100%), `PASS verify:fast`, absence de contrôles imbriqués invalides et tuile de setlist visuellement préservée.

### Phase 4 — Migration contrôlée des icônes

**Avancement au 17 août 2026 : Phase 4 terminée. Infrastructure de scripts restaurée/créée et migrations d’icônes d'actions/navigation achevées vers `FzIcon`.**

Réalisé :

1. **Scripts d’outillage créés et validés** :
   - `scripts/icons/export.mjs` (`npm run icons:export`) : génère `docs/icon-audit/icon-migration.json` en catégorisant les occurrences (`migrated`, `approved`, `discovered`).
   - `scripts/icons/validate.mjs` (`npm run icons:validate`) : analyse statique JSX validant la conformité des rôles `FzIcon` et la présence de `usageId`.
2. **Migrations d'icônes vers `FzIcon` (`src/ui/icons`)** :
   - `PrompterLibraryPage` : en-têtes de sections (rôles `setlists` et `songs`).
   - `SortMenu` : icônes de sélection `check` (options de tri & filtres) et fermeture `close`.
   - `SongDetailPage` : actions audio (play, stop, menu dots, audio upload, record, link, delete).
   - `ImportsPage` : actions complètes (fermeture de barre de progression, suppressions d'envois en attente, bouton importer, play/stop sur listes et dialogues, download/cached/disabled-cache, menu dots, association, suppression).
   - `PrompterPage` : icônes de header (fermer, plein écran, réglages) et stop de défilement.
   - `MetronomePage` : header vue live (fermer, plein écran) et contrôle central play/pause.
   - `VoiceMemoPlayer` : contrôles de lecture/pause de la prise enregistrée.
   - `AudioMiniPlayer` : contrôles de lecture/pause et stop.
   - `UndoToast` : bouton de fermeture toast.
3. **Validation & Non-régression** :
   - 92 instances `FzIcon` validées sans erreur sur 24 rôles canoniques via `npm run icons:validate`.
   - Manifeste `icon-migration.json` synchronisé (88 occurrences migrées avec succès).
   - Validation technique Vitest (95 fichiers / 451 tests unitaires passants à 100%) et `verify:fast` validé.

Les SVG métier (ex: figures de métrique musicale `SubdivisionIcon`), logos de marque ou icônes de sections spécifiques non répertoriées dans les 24 rôles sont sanctuarisés.

**Validation mesurable** : `npm run icons:validate` (PASS), `npm run icons:audit`, `npm run icons:export`, `PASS verify:fast`, suite Vitest 100% passante.

### Phase 5 — Couleurs sémantiques et finitions par écran

1. Distinguer les surfaces neutres des couleurs porteuses d’un état ou d’un contexte.
2. Remplacer Zinc et les surfaces ad hoc par les tokens de panneau, bordure et texte existants lorsqu’ils ne portent aucune sémantique.
3. Évaluer les besoins transversaux `warning`, `info` et `selected`; ne créer un token qu’après validation et avec plusieurs usages identifiés.
4. Traiter `UndoToast`, les écrans de sélection/invitation d’espace, `HomePage`, les détails de setlist et les outils live par lots indépendants.
5. Conserver une seule action primaire rose visible par écran et réserver le succès au vert existant.

**Validation mesurable** : contraste WCAG AA, couleur jamais seule porteuse de sens, états normal/focus/actif/désactivé, safe areas, absence de chevauchement avec la navigation basse.

## 5. Validation et définition de terminé

Pour chaque lot de code futur :

- exécuter `powershell -File scripts/ai/verify-pwa.ps1` ;
- exécuter `-Full` avant livraison, commit ou release ;
- vérifier les viewports 320 px, 390/430 px et desktop ;
- couvrir clavier, focus visible, zoom texte, titres longs et safe areas ;
- tester les états vide, chargement, erreur, désactivation et hors ligne pertinents ;
- préserver les tâches Notion « Fait » listées ci-dessus ;
- mettre à jour dans la même tâche le catalogue Notion et la règle locale lorsqu’un composant passe de **Draft** à **Validated**.

Le chantier est terminé lorsque les migrations prévues sont vérifiées, qu’aucune occurrence d’icône non approuvée n’a été modifiée, qu’aucun comportement livré n’a régressé et que le dépôt, ce plan et les pages Notion décrivent le même état.
