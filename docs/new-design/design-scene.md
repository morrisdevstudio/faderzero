# Direction « Scène » — spécification design pour implémentation

> **Document de passation.** Cette spec résume les décisions UI/UX validées avec le
> propriétaire du produit. Elle est destinée à un agent de code qui implémente la
> direction « Scène » dans la PWA FaderZero.
>
> **Référence visuelle** : `docs/design-scene.canvas.tsx` (copie du canvas validé,
> maquettes React des 13 pages — à ouvrir comme canvas Cursor ou à lire comme code).
> Canvas source : `canvases/palette-proposals.canvas.tsx` (hors repo).
>
> **Règles du repo à respecter** : `AGENTS.md`, `.agents/rules/design-system.md`
> (obligatoire pour toute modification d'interface), cibles tactiles ≥ 44 × 44 px,
> TypeScript strict, mobile-first / offline-first, pas de nouvelle dépendance sans
> nécessité démontrée. Validation : `powershell -File scripts/ai/verify-pwa.ps1`.

---

## 1. Le principe

**Noir absolu, monochrome au repos, rose réservé au vivant.**

- Fond noir pur `#000000`, surfaces plates, séparateurs en hairlines.
- Tout est blanc/gris au repos. Le rose `#ff3a63` (existant, `--fz-accent`) est
  réservé aux états **vivants** : lecture en cours, enregistrement (REC), onglet
  actif, sélection active dans un picker, prochaine setlist, relance booking due.
- Un seul halo rose très doux (≤ 6 % d'opacité) en haut de l'accueil et des fiches,
  comme un follow de scène. Ailleurs : rien.
- Fini le glassmorphism, les ombres portées, les dégradés de fond, l'arc-en-ciel
  de couleurs thématiques par feature.

## 2. Tokens

Remplacement direct des variables `--fz-*` dans `src/app/styles.css` :

| Token Scène | Valeur | Variable cible |
|---|---|---|
| Fond | `#000000` | `--fz-bg` |
| Surface | `#111111` | `--fz-bg-elevated` |
| Tuile | `rgba(255,255,255,0.03)` | `--fz-panel` (aplatir, sans blur) |
| Hairline | `rgba(255,255,255,0.10)` | `--fz-border` |
| Texte | `#ffffff` | `--fz-text` |
| Atténué | `#9c9c9c` | `--fz-text-muted` |
| Accent | `#ff3a63` | `--fz-accent` (inchangé) |

Contraste texte atténué sur noir : **≈ 12:1**, très au-dessus de WCAG AA (4.5:1).

## 3. Chantiers structurels

### 3.1 Typographie
- `Trebuchet MS` (`styles.css:5`) → **Space Grotesk** pour les titres, **Inter**
  pour le corps (fontes libres, à charger via `index.html`).
- Graisses autorisées : **400 / 600 / 700** — fin du `font-black` omniprésent.
- Labels en capitales : tracking `0.16em` → `0.08em`.
- Chiffres techniques (BPM, durées, numéros de setlist) : **IBM Plex Mono** ou
  équivalent mono.

### 3.2 Fond
- Supprimer les 3 `radial-gradient` + `linear-gradient` + la grille `body::before`
  (`styles.css:7-13` et `80-117`). Noir pur + halo rose unique décrit plus haut.

### 3.3 Surfaces
- Fin du glassmorphism : `.fz-card` (gradient + `blur(22px)` + ombre), hero
  `shadow-xl`, ombre de la nav `0 -16px 40px`.
- Tout devient plat : fond `white/3%`, hairlines `white/10`, **radius 12 px**
  partout (fin des `rounded-[1.8rem]` / `rounded-[2.5rem]`).
- Bouton primaire : **plat `#ff3a63`**, sans dégradé ni ombre (remplacer le
  `linear-gradient` de `.fz-button-primary`).

### 3.4 Couleurs thématiques
Les 8 teintes par feature (rose/ambre/sky/émeraude/indigo/fuchsia/teal/orange,
ex. tuiles de `HomePage.tsx`) **quittent les tuiles et les en-têtes** : tout est
monochrome au repos. **Point à trancher avec le produit** : elles peuvent survivre
à un seul endroit — l'icône de l'onglet actif de la barre de navigation — ou
disparaître complètement au profit du seul rose.

### 3.5 Micro-effets
- Retirer `animate-pulse` (badge booking, indicateurs) et les glows
  (`shadow-[0_0_16px_…]`).
- Un seul retour tactile partagé : `active:scale-[0.98]`, 120 ms.

## 4. Inventaire des routes et décisions par page

| Route | Page | Décision Scène |
|---|---|---|
| `/home` | Accueil | Maquette validée (voir §5) |
| `/songs` | Morceaux | Maquette validée (voir §5) |
| `/setlists` | Setlists | Maquette validée (voir §5) |
| `/songs/:id` | Fiche morceau | Maquette validée (voir §5 + §6 UX d'édition) |
| `/setlists/:id` | Détail setlist | Tuiles numérotées (mono), enchaînements en texte discret, date dans le sous-titre, CTA « Lire » rose unique |
| `/calendar` | Calendrier | Grille plate, aujourd'hui en rose plein, point rose sous les jours d'événement, liste du jour avec filet rose à gauche |
| `/booking`, `/booking/:id` | Booking | Onglets soulignés rose (plus de pastille blanche), relances dues en rose, statuts en texte monochrome |
| `/metronome` | Métronome | BPM géant grotesk, temps actifs en points roses, TAP en outline, play rose plein |
| `/prompter`, `/prompter/play` | Prompteur | Biblio = listes standard ; lecture = noir plein, ligne courante blanche agrandie, filet de progression rose, navigation sobre |
| `/songs/:id/write` | Éditeur de paroles | Labels de section en mono rose, texte confortable, toolbar minimale en bas |
| `/sync` | Synchronisation | Statut cloud en tuile plate, QR code sur bloc blanc, éléments hors ligne en lignes à filets |
| `/account` | Paramètres | Groupe actif en tuile avec pastille rose, sections en lignes à filets, déconnexion en outline rose |
| connexion / choix d'espace | Auth | Logo grotesk, Google en blanc plein, champs plats, CTA rose, onglets soulignés |
| `/landing`, `/account/epk` | Vitrine publique | **Hors périmètre** |

## 5. Diagnostics des 4 écrans principaux (validés)

### Accueil — `src/features/home/HomePage.tsx`
Structure réelle à conserver : en-tête « Accueil » + pastille groupe → carte hero
« dernière modification » → grille 4×2 « Fonctions & Outils » → « Prochaines
Dates » → « Activité Répertoire ».
- Hero : tuile noire plate à filet (fini `rounded-[1.8rem]` + dégradé + blur),
  gros play rose, titre grotesk, meta mono `128 BPM · Dm · 3:24`, statut en texte.
- Grille d'outils : tuiles noires à filets, icônes **monochromes** — seul
  **Enregistrer (REC)** est rose ; le badge relances de Booking reste rose.
- Dates et activité : lignes à filets, type d'événement en caps (CONCERT, RÉPÈTE),
  liens « Calendrier → » / « Tout voir → » en rose.

### Morceaux — `src/features/songs/SongsPage.tsx`
Ce qui cloche :
- Placeholders `BPM -- · Ton -- · --:--` sur chaque ligne (`SongsPage.tsx:1024-1029`).
- Double ligne de méta : pill + `✓ Paroles · 0 audios · 0 setlists` (`:1030-1043`).
- Compteurs affichés même à zéro ; titres `font-black` + méta caps trackées.
- Trois couleurs de pill (gris/rose/vert) en concurrence.

Ce que Scène change :
- N'afficher que les **données réelles** ; une seule ligne de méta.
- Statut en texte discret, rose uniquement pour « En cours ».
- Bouton lecture monochrome au repos, rose pendant la lecture.
- Recherche en pilule plate, titre de page en Space Grotesk.

### Setlists — `src/features/setlists/SetlistsPage.tsx`
Ce qui cloche :
- La date du concert existe en base mais n'apparaît pas (`SetlistsPage.tsx:146-149`).
- Aucune distinction de la prochaine setlist — l'info la plus utile de l'écran.

Ce que Scène change :
- Date du concert affichée dans chaque ligne (champ existant).
- Prochaine setlist signalée par `· prochaine` en rose.
- Nom en 600 à 13 px, méta discrète, séparateurs `white/8`.

### Fiche morceau — `src/features/songs/SongDetailPage.tsx`
Ce qui cloche :
- Quatre boîtes grises empilées (audio, stats, notes, paroles) : mur de cartes.
- Actions d'en-tête en trois couleurs (sky/amber/rose, `:686-714`), contraire à
  la règle `DetailHeader` du design-system.
- Stats en micro-labels `0.58rem` avec `--` quand la donnée manque.
- Player sans progression ni timecode.
- Paroles enfermées dans une boîte grise.

Ce que Scène change :
- Actions d'en-tête neutres ; le danger est porté par l'icône, pas une couleur.
- Player hero : grand bouton rose + barre de progression + timecodes.
- Meta en une ligne `Dm · 128 BPM · 3:24 · Prêt` — plus de grille en boîte.
- Paroles directement sur le noir, interligne généreux.

## 6. UX d'édition (fiche morceau) — décision validée

**Problème** : l'appui long est le seul déclencheur d'édition — invisible et
indécouvrable. Le mode édition global (formulaire + autosave 280 ms,
`SongDetailPage.tsx:139`) est du **code mort** : `setIsEditMode(true)` n'est
appelé nulle part. Les pickers de quick-edit (roue BPM, roue durée, tonalités,
statut) existent déjà et sont bons : il ne manque que des déclencheurs à la
bonne taille.

**Solution retenue** (cibles ≥ 44 px, règle design-system) :
- La méta en ligne devient une **rangée de cellules plates de 52 px de haut**,
  entièrement cliquables, séparées par des hairlines. Un **pointillé sous la
  valeur** signale l'éditabilité.
- Paroles : tap sur le bloc ou sur « Éditer → » (32-44 px) → éditeur `/write`.
- Bouton « Modifier » dans l'en-tête → **reconnecter le mode édition global**
  existant (autosave).

| Déclencheur | Dialogue existant réutilisé |
|---|---|
| Tap cellule TEMPO (52 px) | Roue BPM — `PickerDialog` + `WheelColumn` |
| Tap cellule DURÉE | Double roue min/sec |
| Tap cellule TON | Grille de tonalités |
| Tap cellule STATUT | Choix de statut |
| Tap bloc paroles / « Éditer → » | Éditeur `/write` plein écran |
| Tap « Modifier » (en-tête) | Mode édition global + autosave (code à reconnecter) |

Patterns écartés : appui long (reste comme raccourci mais détrôné), tap sur
valeur inline ~10 px (hors normes, abandonné).

## 7. Popups & dialogues — règles communes validées

Variante retenue : **sheet noire + page floutée/éclaircie**.

- **Panneau** : noir pur `#000` + hairline `white/18`. La page en dessous est
  floutée `blur(6px)` et éclaircie par un voile `white/7` — la page devient
  laiteuse, la popup tranche net. Jamais de gris neutre, **zéro ombre**
  (fin de `.fz-card` pour les dialogues).
- **Sélection = rose plat `#ff3a63` partout** (statut, tonalité, pickers,
  options) — fini l'indigo (`SongDetailPage.tsx:1265`) et l'émeraude (`:1300`).
- Options au repos : `white/6`, texte 600 à 12-13 px — fin du `font-black`.
- Roues (BPM, durée) : la ligne sélectionnée est marquée par **deux hairlines**,
  pas par un rectangle gris.
- Formulaires : champ plat `white/4`, focus = hairline rose ; primaire « Créer »
  en rose plat, secondaire en `white/6`, casse phrase et graisse 600 — fin de
  l'uppercase `font-black`.
- Danger (suppressions) : contour rose/rouge plat, jamais de fond saturé — seule
  exception chromatique avec la sélection.
- `ConfirmDialog`, `FormDialog`, `PickerDialog` partagent ces règles — **aucune
  variante locale**.

## 8. Priorisation validée

| # | Chantier | Impact | Effort | Fichiers principaux |
|---|---|---|---|---|
| 1 | UX d'édition (cellules + reconnexion mode édition) | Fort (quotidien) | Faible | `SongDetailPage.tsx` |
| 2 | Typographie | Fort | Faible | `styles.css` + `index.html` |
| 3 | Fond noir pur | Fort | Faible | `styles.css` (body, `body::before`) |
| 4 | Surfaces plates + nav allégée | Fort | Moyen | `styles.css`, `HomePage.tsx`, `AppShell.tsx` |
| 5 | Listes Morceaux / Setlists (données réelles, dates) | Moyen | Faible | `SongsPage.tsx`, `SetlistsPage.tsx` |
| 6 | Pickers & dialogues (sélection rose, panneaux plats) | Moyen | Faible | `SongDetailPage.tsx`, `PickerDialog`, `FormDialog`, `.fz-card` |
| 7 | Couleurs thématiques + micro-effets | Moyen | Faible | `HomePage.tsx`, `AppShell.tsx` |

**Par où commencer** : le chantier 1 (UX d'édition) — usage quotidien, réutilise
des dialogues existants, ne dépend d'aucun choix graphique. Ensuite 2 + 3 + 4,
qui installent Scène partout en quelques tokens.

## 9. Points ouverts

1. Couleurs thématiques : survivent uniquement sur l'icône de l'onglet actif de
   la nav, ou disparaissent totalement ? (§3.4 — à trancher avec le produit)
2. `/landing` et `/account/epk` (vitrine publique) : hors périmètre pour l'instant.
