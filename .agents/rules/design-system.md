# Design system FaderZero

Référence locale obligatoire pour maintenir une interface cohérente pendant la migration progressive du design system.

## When this applies

- Toute création, modification ou revue d’un composant ou d’un écran.
- Toute action d’ajout, en-tête, icône, statut ou contrôle tactile.

## Rules

- **ALWAYS** : rechercher un composant partagé dans `src/ui/components` et une icône dans `src/ui/icons` avant de créer une variante locale.
- **ALWAYS** : conserver les cibles tactiles essentielles à au moins `44 × 44 px`.
- **ALWAYS** : préserver le comportement mobile-first à partir de `320 px`.
- **NEVER** : redéfinir localement une icône, une couleur, un rayon ou un style déjà standardisé.
- **NEVER** : modifier visuellement un composant canonique depuis une page ; faire évoluer le composant partagé après validation du design.

## AddButton validé

- Rôle : action principale compacte d’ajout dans l’en-tête d’une page.
- Implémentation canonique : `src/ui/components/AddButton.tsx`.
- Utiliser uniquement `<AddButton aria-label="…" onClick={…} />`.
- Bouton strictement carré : `44 × 44 px`.
- Icône obligatoire : `FzIcon`, rôle `add`, taille `20 × 20 px`, épaisseur de trait `2`.
- Le `aria-label` est obligatoire et décrit l’objet ajouté dans le contexte courant.
- Les états survol, focus, pression et désactivation viennent exclusivement du composant partagé.
- **NEVER** : utiliser un caractère `+`, un SVG local, une autre taille ou une autre épaisseur pour cette action.
- **NEVER** : passer `className`, `style` ou des enfants pour créer une variante locale.

```tsx
<AddButton aria-label="Ajouter une chanson" onClick={openCreateSong} />
```

Les grands boutons textuels comme « Ajouter des chansons » ne sont pas des `AddButton` : ils conservent un libellé visible et suivent le pattern d’action textuelle de leur écran.

## PageHeader validé

- Rôle : en-tête des pages principales affichées dans `AppShell`.
- Implémentation canonique : `src/ui/components/PageHeader.tsx`.
- Première ligne : icône partagée `28 × 28 px` et titre à gauche, zéro à deux actions à droite.
- Deuxième ligne facultative : recherche flexible et action de tri ou de filtre immédiatement à droite.
- Le titre utilise un `h1`, reste sur une ligne et se tronque avant de réduire les actions.
- Les actions conservent leur taille tactile et leurs styles canoniques propres.
- Le composant ne contient ni sous-titre ni description.
- **NEVER** : reconstruire localement les lignes, espacements ou dimensions de cet en-tête.
- **NEVER** : passer `className` ou `style` pour créer une variante locale.

```tsx
<PageHeader
  icon={<FzIcon name="songs" usageId="page-header.songs" size="xl" />}
  title="Morceaux"
  actions={<AddButton aria-label="Créer un morceau" onClick={openCreateSong} />}
  search={{ value: search, onChange: setSearch, placeholder: 'Rechercher…' }}
  sortAction={<SortMenu value={sort} onChange={setSort} label="Trier" />}
/>
```

Routes migrées observées dans le dépôt : `/home`, `/songs`, `/setlists`, `/calendar`, `/metronome` et `/prompter`. `/booking` est une sous-page hors de ce périmètre.

## AppHeader validé

- Rôle : en-tête global fixe de l’application dans `AppShell`.
- Implémentation canonique : `src/ui/components/AppHeader.tsx`.
- Logo FaderZero complet à gauche ; sélecteur du groupe actif à droite.
- Le nom et le badge constituent une seule zone cliquable ouvrant le changement de groupe.
- Hauteur : `64 px` sur mobile et `72 px` à partir du breakpoint `sm`.
- Badge : `44 × 44 px` sur mobile et `48 × 48 px` à partir de `sm`.
- Le badge affiche `logoUrl` avec les initiales colorées comme fallback.
- Le nom se tronque avant de réduire le logo ou le badge.
- Le sélecteur ne possède aucun fond ni aucune bordure ; son focus reste clairement visible.
- Les comportements existants du logo — accueil au clic et simulation hors ligne par appui long — sont conservés dans `AppShell`.
- **NEVER** : reconstruire localement le sélecteur, séparer le nom du badge ou réduire les cibles fixes pour faire tenir un nom long.

```tsx
<AppHeader
  logo={<FaderHeaderLogo />}
  currentGroup={{ name, initials, avatarUrl, badgeColor }}
  onChangeGroup={openGroupPicker}
/>
```

## DetailHeader validé

- Rôle : en-tête uniforme des sous-pages et fiches de détail affichées dans `AppShell`.
- Implémentation canonique : `src/ui/components/DetailHeader.tsx`.
- Structure : bouton retour à gauche, titre et sous-titre facultatif au centre, actions par icônes à droite.
- Le titre utilise un `h1`, reste sur une ligne et se tronque avant les actions.
- Les boutons retour et actions sont sans fond, bordure ni ombre, avec une cible tactile de `44 × 44 px`.
- Les icônes utilisent exclusivement `FzIcon`, en taille `20 × 20 px` et avec une épaisseur de trait de `2`.
- Le sous-titre reste facultatif et se limite à une ligne tronquée.
- Sur `/booking`, le bouton d’ajout est l’icône `add` neutre du sous-header, jamais le `AddButton` rose des pages principales.
- Sur `/booking/:bookingId`, la modification utilise l’icône `edit`, comme sur `/setlists/:setlistId`.
- **NEVER** : reconstruire localement le bouton retour, l’alignement ou les dimensions des actions.
- **NEVER** : ajouter un fond, une bordure ou une ombre aux actions du sous-header.

```tsx
<DetailHeader
  title="Le Chabada"
  subtitle="Angers · 22 août 2026"
  onBack={() => navigate('/booking')}
  backLabel="Retour au booking"
  actions={<button aria-label="Modifier"><FzIcon name="edit" usageId="booking-detail.edit" /></button>}
/>
```

Routes migrées : `/songs/:songId`, `/setlists/:setlistId`, `/booking` et `/booking/:bookingId`.

## StatusPill validé

- Rôle : afficher un état métier compact et non interactif.
- Implémentation canonique : `src/ui/components/StatusPill.tsx`.
- Variantes autorisées : `default` pour l’état neutre, `accent` pour l’état actif et `success` pour l’état terminé.
- Le composant rend toujours un `span`, reste sur une ligne et sa largeur dépend uniquement de son contenu.
- Correspondance des chansons : `Idée` → `default`, `En cours` → `accent`, `Prêt` → `success`.
- Les libellés visibles conservent leurs accents même lorsque la valeur stockée n’en possède pas.
- **NEVER** : utiliser `StatusPill` comme bouton, filtre ou sélecteur.
- **NEVER** : passer `className`, `style`, une couleur locale ou créer une nouvelle variante depuis une page.
- **NEVER** : utiliser `StatusPill` pour le badge coloré d’un groupe ; ce badge représente une identité, pas un statut.

```tsx
<StatusPill label="En cours" tone="accent" />
```

Usages migrés : listes de morceaux, fiche morceau, bibliothèque du prompteur et page de synchronisation.

## Champs de formulaire validés

- Implémentations canoniques : `TextField.tsx`, `SearchField.tsx`, `PasswordField.tsx` et `TextArea.tsx` dans `src/ui/components`.
- Le titre visible d’un champ utilise `fz-field-label` : toujours en majuscules, graisse forte et espacement de lettres partagé.
- La casse ne s’applique qu’au titre du champ, jamais à la valeur, au placeholder, aux options ou au texte descriptif d’une case à cocher.
- Tous les champs partagent une hauteur minimale de `48 px`, un rayon de `16 px`, les mêmes couleurs et les mêmes états survol, focus, erreur et désactivation.
- Le texte saisi utilise `16 px` au minimum afin d’éviter le zoom automatique des navigateurs mobiles.
- Le placeholder conserve un contraste lisible et ne remplace jamais un label ou un `aria-label`.
- L’état invalide est signalé avec `aria-invalid="true"` ; le message d’erreur reste lié au champ par `aria-describedby` lorsque nécessaire.
- Les props natives sont conservées, mais `className` et `style` sont interdits pour empêcher les variantes locales.

### TextField

- Types autorisés : `text`, `email`, `tel` et `url`.
- Utiliser pour les valeurs courtes sur une seule ligne.

```tsx
<TextField type="email" aria-label="Adresse e-mail" autoComplete="email" />
```

### SearchField

- Rend toujours un `input` de type `search`.
- Utiliser dans `PageHeader` et les recherches intégrées aux parcours métier.

```tsx
<SearchField aria-label="Rechercher un morceau" value={query} onChange={handleChange} />
```

### PasswordField

- Intègre exclusivement les icônes `show-password` et `hide-password` via `FzIcon`.
- Le bouton afficher/masquer possède sa propre cible tactile et conserve la valeur du champ.
- Le bouton est automatiquement désactivé avec le champ.

```tsx
<PasswordField aria-label="Mot de passe" autoComplete="current-password" />
```

### TextArea

- Utiliser pour les notes, descriptions et paroles.
- La hauteur initiale se règle avec `rows` ; seules les valeurs `none` et `vertical` sont autorisées pour `resize`.

```tsx
<TextArea aria-label="Notes" rows={4} resize="vertical" />
```

- **NEVER** : utiliser ces composants pour un fichier, une case à cocher, un curseur, une date, une heure ou une liste déroulante.
- **NEVER** : réutiliser la classe historique `fz-input` pour un nouveau champ texte.
- La classe historique `fz-input` ne doit plus être utilisée pour un champ de formulaire migré.
- Exceptions actuelles : titre compact de l’éditeur de paroles, champs en lecture seule du détail calendrier et outil interne des icônes.

Écrans migrés : authentification, sélection de groupe, compte, recherches des pages principales, morceaux, setlists, formulaires d’événements, booking et enregistreur vocal.

## Champs de date et d’heure validés

- Implémentations canoniques : `DateField.tsx`, `TimeField.tsx` et `DateTimeField.tsx` dans `src/ui/components`.
- `DateField` rend toujours un champ natif `date`, `TimeField` un champ natif `time` et `DateTimeField` un champ natif `datetime-local`.
- Les sélecteurs natifs du navigateur et du téléphone sont conservés : ne pas construire de calendrier ou d’horloge personnalisés.
- Les trois composants reprennent exactement les dimensions et les états des champs texte : hauteur minimale de `48 px`, texte de `16 px`, focus, erreur et désactivation partagés.
- Le rendu natif utilise le thème sombre de l’application.
- Les contraintes natives `min`, `max`, `step` et `required` sont transmises au champ.
- Les valeurs de formulaire restent dans leur format natif ISO local (`YYYY-MM-DD`, `HH:mm` ou `YYYY-MM-DDTHH:mm`) ; ne pas les reformater dans le composant.
- `className`, `style`, `type` et `size` sont interdits afin d’éviter les variantes locales.
- Chaque champ doit avoir un label associé ou un `aria-label` explicite.

```tsx
<DateField aria-label="Date cible" min="2026-08-17" />
<TimeField aria-label="Heure du concert" step={900} />
<DateTimeField aria-label="Date et heure de la prochaine relance" />
```

Écrans migrés : formulaires booking, création et modification d’événement, détail d’une setlist.

## Sélecteurs validés

- Implémentation canonique : `src/ui/components/SelectField.tsx`.
- Le composant conserve le `select` natif, sa flèche et le menu du navigateur ou du téléphone.
- Il reprend exactement les dimensions et les états des autres champs : hauteur minimale de `48 px`, texte de `16 px`, rayon de `16 px`, focus, erreur et désactivation partagés.
- Les props natives comme `required`, `disabled`, `value`, `defaultValue` et `name` sont conservées.
- `className`, `style` et `size` sont interdits pour empêcher les variantes locales.
- La largeur particulière d’un sélecteur placé dans une ligne se règle uniquement sur son conteneur parent.
- Chaque sélecteur doit avoir un label associé ou un `aria-label` explicite.
- **NEVER** : remplacer le menu natif par une liste déroulante personnalisée sans besoin métier validé.

```tsx
<SelectField aria-label="Type d’événement" value={eventType} onChange={handleChange}>
  <option value="rehearsal">Répétition</option>
  <option value="concert">Concert</option>
</SelectField>
```

Écrans migrés : compte, booking, événements, calendrier en lecture seule, imports et morceaux. L’outil interne de conception des icônes reste une exception locale.

## Dialogues validés

- Implémentations canoniques : `src/components/FormDialog.tsx`, `src/components/PickerDialog.tsx` et `src/components/ConfirmDialog.tsx`.
- `FormDialog` contient les formulaires et contenus modaux généraux ; `PickerDialog` contient les sélecteurs à roue ; `ConfirmDialog` est réservé aux confirmations explicites.
- Les dialogues sont rendus dans `document.body` par portail et partagent la gestion d’Échap, du backdrop, du focus initial, du confinement et de la restauration du focus.
- L’ouverture verrouille le scroll sous-jacent, y compris lorsque plusieurs dialogues sont empilés.
- Le titre est relié par `aria-labelledby` ; toute description disponible est reliée par `aria-describedby`.
- Le panneau respecte les quatre safe areas, utilise `100dvh`, devient défilable lorsque le viewport rétrécit et reste utilisable à `320 px` avec le clavier virtuel.
- Le bouton fermer de `FormDialog` et `PickerDialog` utilise `FzIcon`, rôle `close`, dans une cible de `44 × 44 px`.
- `FormDialog.closeDisabled` bloque ensemble le bouton fermer, Échap et le backdrop pendant une opération critique. Les autres actions du contenu doivent être désactivées explicitement par leur écran.
- `ConfirmDialog` rejoint la même pile de focus : il est seul à répondre à Échap lorsqu’il se trouve au premier plan et restaure le focus à l’annulation.
- `placement="bottom"` est réservé aux bottom sheets ; la position centrée reste la valeur par défaut.
- Les animations non essentielles sont absentes ou neutralisées sous `prefers-reduced-motion: reduce`.
- **NEVER** : reconstruire localement un backdrop, un piège de focus, une écoute Échap, un bouton fermer ou un verrouillage du scroll.
- **NEVER** : fermer un dialogue pendant une sauvegarde, une copie ou une suppression si cette fermeture peut produire un état ambigu.

```tsx
<FormDialog
  title="Copier vers un autre espace"
  closeDisabled={isCopying}
  onClose={closeCopy}
>
  {formContent}
</FormDialog>
```

Migrations prioritaires terminées : `TrashModal`, `CopySongModal` et `EventFormModal`. La confirmation de suppression d’événement reste distincte et obligatoire.

## `ContentRow` — Draft

- **Statut : Draft.** La direction visuelle est approuvée, mais aucune implémentation canonique ni migration générale n’est autorisée avant validation humaine de l’API finale.
- Rôle envisagé : unifier la structure dense des morceaux, événements et fichiers audio sans créer une tuile universelle.
- Anatomie commune : zone gauche facultative, titre, métadonnées et zone droite facultative.
- Modes envisagés : `link` pour une ligne entièrement navigable, `button` pour une ligne entièrement activable et `controls` pour une ligne contenant des actions indépendantes.
- Les modes `link` et `button` interdisent les contrôles interactifs imbriqués.
- Le mode `controls` autorise lecture, arrêt, téléchargement et menu, chacun avec un nom accessible et une cible de `44 × 44 px`.
- La ligne reste pleine largeur, dense et séparée par un trait fin ; elle ne devient pas une carte flottante répétée.
- Les titres et métadonnées se tronquent avant de masquer un statut, une identité ou une action.
- Les états normal, survol, focus, actif, sélectionné, désactivé et lecture seule doivent être définis avant validation.
- **NEVER** : utiliser `StatusPill` pour un type d’entité, un calendrier ou l’identité d’un groupe.
- **NEVER** : extraire ou migrer `ContentRow` sur un seul écran avant validation comparative des trois usages à `320 px` et `430 px`.

### Exception : tuile ordonnée de setlist

- La tuile de `SetlistDetailPage` reste une référence séparée à préserver.
- Sa surface arrondie, son numéro, ses métadonnées, ses transitions et ses actions monter/descendre ne doivent pas être harmonisés avec `ContentRow`.
- Un éventuel `SetlistEntry` ne peut être qu’une extraction technique à DOM, dimensions, couleurs et comportement identiques.
- **NEVER** : créer un composant universel `Tile` regroupant cette tuile avec les morceaux, événements ou fichiers audio.

## Composants validés et migrations

- `AddButton`, `PageHeader`, `DetailHeader`, `AppHeader`, `StatusPill`, `FormDialog` et `PickerDialog` sont les noms canoniques validés.
- `ConfirmDialog` est le composant partagé obligatoire pour une confirmation explicite.
- Leur déploiement sur les écrans reste progressif ; le statut réel observé dans le dépôt prime sur une ancienne liste de routes.
- `Button`, `FieldLabel` / `FormField` et `ContentRow` restent **Draft** et ne doivent pas être présentés comme canoniques.
- Catalogue humain de référence : `FaderZero — Catalogue de l’UI existante` dans Notion.
