# Plan : Export, sauvegarde, restauration et import massif du répertoire

> PRD source : `docs/PRD.md`

## Décisions architecturales

Décisions durables qui s’appliquent à toutes les phases :

- **Routes** : tout passe par Compte → Groupe → **Données du groupe**, URL `/account?view=group-data&workspace=<id>`. Parent : vue Groupe. Pas d’export/import depuis la fiche morceau, la liste, ni une route `/songs/…`. L’export, la prévisualisation, la progression et le rapport sont des **étapes** de cette vue, pas des URLs séparées.
- **Autorisation** : `admin` du **groupe** uniquement (`canAdministerWorkspace`). Membre et invité ne voient pas l’entrée. L’espace personnel n’est pas concerné. Export et import **uniquement en ligne** ; hors ligne, les actions restent visibles mais indisponibles.
- **Format** : **Archive FaderZero v1**. Manifeste global + un dossier par morceau (infos du morceau, paroles texte, paroles mises en forme, fichiers audio relatifs). Jamais une copie brute de la base, des identifiants d’infrastructure ou des chemins de stockage internes. Le titre réel vit dans les infos du morceau ; le nom de dossier est uniquement lisible (caractères interdits remplacés, homonymes `Intro` / `Intro (2)`).
- **Schéma audio (song assets)** : `assetType` (`demo` | `rehearsal` | `mix` | `master` | `live` | `other`), `label`, `recordedAt`, `sortOrder`, `contentHash`. Les libellés UI : Démo, Répétition, Mix, Master, Live, Autre.
- **Modèles clés** : Archive FaderZero, Morceau d’import normalisé, Prévisualisation d’import, Rapport d’import, Politique de conflit (`mettre à jour` | `créer` | `ignorer`).
- **Import** : passe par les APIs métier existantes (création / mise à jour de morceau, envoi audio, réservation de quota **durée**). L’identifiant d’origine de l’archive sert à reconnaître un morceau **dans ce groupe**, jamais comme nouvel identifiant imposé.
- **Priorités d’analyse** : titre = infos archive → nom de dossier → nom de fichier isolé. Paroles = mises en forme FaderZero → texte → aucune. Type audio = infos archive → convention de nom → Autre.

---

## Phase 1 : Types audio des fichiers d’un morceau

**User stories** : prérequis de US-33

### Ce qu’on livre

Sur un morceau déjà dans le groupe, chaque fichier audio a un type (Démo, Répétition, Mix, Master, Live, Autre), un libellé optionnel, une date d’enregistrement optionnelle et un ordre. Ces infos survivent à un rechargement. Les fichiers existants sans type valent Autre. Sans ça, une archive ne peut pas restituer les types.

### Critères d’acceptation

- [ ] Un fichier audio d’un morceau peut recevoir un type parmi les six valeurs, un libellé et une date.
- [ ] Après rechargement, type, libellé, date et ordre sont inchangés.
- [ ] Un fichier créé avant cette phase s’affiche en Autre tant qu’on ne l’a pas changé.
- [ ] Les libellés écran sont en français ; les valeurs stockées restent stables.

## Bloquée par

- Aucune — démarrable immédiatement

---

## Phase 2 : Écran Données du groupe

**User stories** : US-21, US-22, US-28

### Ce qu’on livre

L’admin d’un groupe ouvre Données du groupe depuis Compte → Groupe. Il y voit les actions d’export et d’import. Un membre ou un invité ne voit pas cette entrée. Hors ligne, les actions sont visibles mais indisponibles, avec une phrase d’explication. S’il n’y a aucun morceau, un message l’indique et on ne lance pas d’export.

### Critères d’acceptation

- [ ] Un admin de groupe voit Données du groupe sous le groupe concerné, URL `/account?view=group-data&workspace=<id>`.
- [ ] Un membre ou un invité ne voit ni l’entrée ni les actions.
- [ ] Hors ligne, export et import restent visibles, indisponibles, avec une explication.
- [ ] Répertoire vide : message, pas de fichier téléchargé.

## Bloquée par

- Aucune — démarrable immédiatement (en parallèle de la phase 1)

---

## Phase 3 : Export données uniquement

**User stories** : US-1, US-2, US-3, US-4, US-5, US-30, US-31, US-32

### Ce qu’on livre

L’admin crée une archive du répertoire **sans** les fichiers audio. Avant création : nombre de morceaux, nombre d’audios décrits, taille estimée. Avertissement visible : cette archive ne restaure pas les audios. Une fois téléchargée et ouverte hors FaderZero : un dossier par morceau, paroles lisibles, infos (titre réel conservé même si le dossier est simplifié), deux titres identiques dans deux dossiers distincts. Un morceau sans paroles ou sans audio est quand même exporté. Choix « données uniquement » / « avec audio » : seul « données uniquement » produit un fichier dans cette phase.

### Critères d’acceptation

- [ ] L’admin choisit données uniquement, voit le compteur et la taille, puis télécharge une archive.
- [ ] L’avertissement « les fichiers audio ne pourront pas être restaurés » est visible avant et dans le flux.
- [ ] Hors FaderZero : un dossier par morceau, fichier de paroles lisible, titre réel intact malgré un nom de dossier simplifié.
- [ ] Deux morceaux « Intro » donnent deux dossiers distincts lisibles.
- [ ] Un morceau sans paroles ou sans audio est présent dans l’archive.
- [ ] L’archive porte la version 1 du format et ne contient aucun chemin de stockage interne.

## Bloquée par

- Phase 1 : Types audio des fichiers d’un morceau
- Phase 2 : Écran Données du groupe

---

## Phase 4 : Export avec fichiers audio

**User stories** : US-1, US-5, US-20

### Ce qu’on livre

Même flux, option « inclure les fichiers audio ». L’archive contient les fichiers écoutables, nommés de façon lisible, types issus de la phase 1. Progression visible sur téléphone : analyse, préparation, finalisation, volume. La taille estimée avant création reflète le poids audio.

### Critères d’acceptation

- [ ] L’admin inclut les audios, voit une taille estimée cohérente, lance la création.
- [ ] Hors FaderZero, les fichiers audio s’ouvrent et correspondent aux morceaux.
- [ ] Les types audio de la phase 1 sont décrits dans l’archive (pas déduits du seul nom de fichier).
- [ ] Une barre de progression distingue au moins préparation et finalisation, utilisable sur téléphone.
- [ ] Hors ligne, l’action reste indisponible (phase 2).

## Bloquée par

- Phase 3 : Export données uniquement

---

## Phase 5 : Sélection du dépôt et refus immédiat

**User stories** : US-23, US-25, US-34, US-35

### Ce qu’on livre

L’admin choisit un fichier d’archive, ou un dossier si l’appareil le permet. L’analyse commence **avant** tout envoi. Une archive d’une version inconnue, dangereuse (chemins hors dossier) ou illisible est refusée tout de suite, avec un message, sans prévisualisation métier ni écriture dans le groupe.

### Critères d’acceptation

- [ ] Sur téléphone, l’admin peut choisir un fichier d’archive ; un dossier si l’appareil le permet.
- [ ] Aucun envoi vers le stockage ne démarre à cette étape.
- [ ] Version non prise en charge : refus, message du type « Cette archive utilise une version qui n’est pas encore prise en charge. »
- [ ] Archive dangereuse ou illisible : refus immédiat, rien n’est créé dans le groupe.

## Bloquée par

- Phase 3 : Export données uniquement

---

## Phase 6 : Prévisualisation sans écriture

**User stories** : US-8, US-10, US-11, US-24, US-29

### Ce qu’on livre

Après un dépôt acceptable, un écran liste morceaux détectés, paroles, audios, taille, avertissements (paroles absentes, BPM inconnu, type proposé) et erreurs individuelles (fichier manquant, format non supporté). Dépôt sans morceau exploitable : pas d’import possible. Archive incomplète : les morceaux encore valides sont distingués. Annuler ne change rien au groupe. Confirmer n’écrit pas encore (la confirmation réelle arrive en phase 8).

### Critères d’acceptation

- [ ] La prévisualisation affiche comptes, taille, valides, avertissements et erreurs par morceau.
- [ ] Un fichier invalide est signalé sur ce morceau ; les autres restent listés comme importables.
- [ ] Dépôt vide / inexploitable : import impossible, message clair.
- [ ] Archive incomplète : morceaux valides vs endommagés distingués avant tout envoi.
- [ ] Annuler : le groupe est intact.

## Bloquée par

- Phase 5 : Sélection du dépôt et refus immédiat

---

## Phase 7 : Contrôle d’intégrité avant import

**User stories** : US-12

### Ce qu’on livre

Si l’archive déclare une empreinte pour un fichier et que le fichier ne correspond pas, la prévisualisation le signale **avant** import. L’admin peut quand même importer les éléments valides. Aucun envoi de ce fichier altéré n’est présenté comme sain.

### Critères d’acceptation

- [ ] Un fichier dont l’empreinte ne correspond pas à l’archive est marqué altéré dans la prévisualisation, avant tout envoi.
- [ ] Les autres fichiers valides restent importables.
- [ ] Une archive sans empreinte (dossier maison, phase 12) n’est pas refusée pour autant.

## Bloquée par

- Phase 4 : Export avec fichiers audio
- Phase 6 : Prévisualisation sans écriture

---

## Phase 8 : Import création — morceaux et paroles

**User stories** : US-6, US-9, US-30, US-33

### Ce qu’on livre

L’admin confirme l’import des éléments valides. Les morceaux et paroles (texte et mise en forme FaderZero si présentes) sont créés dans le groupe via les gestes métier habituels. Un morceau sans paroles ou sans audio peut être créé. Les fichiers audio ne sont pas encore envoyés. Round-trip données : export données uniquement → suppression → import → titre, artiste, BPM, tonalité, notes, paroles équivalents.

### Critères d’acceptation

- [ ] Rien n’est créé tant que l’admin n’a pas confirmé.
- [ ] Après confirmation, les morceaux valides existent dans le répertoire avec leurs infos et paroles.
- [ ] Les paroles mises en forme FaderZero sont restaurées quand elles étaient dans l’archive ; sinon le texte brut.
- [ ] Un morceau sans paroles ou sans audio est créé s’il était importable.
- [ ] Export données → suppression → import : les champs métier du morceau (hors audio) correspondent.

## Bloquée par

- Phase 6 : Prévisualisation sans écriture

---

## Phase 9 : Import des fichiers audio et progression

**User stories** : US-6, US-20, US-33

### Ce qu’on livre

Sur la même confirmation, les audios des morceaux importés sont envoyés, rattachés, avec leur type. Progression téléphone : analyse déjà faite, envoi, finalisation, morceau en cours, compteurs. Round-trip complet : export avec audio → suppression → import → audios et types équivalents.

### Critères d’acceptation

- [ ] Les fichiers audio des morceaux confirmés sont écoutables dans FaderZero après import.
- [ ] Les types (Démo, Master, etc.) correspondent à l’archive, pas au seul nom de fichier.
- [ ] Progression visible : envoi vs finalisation, morceau en cours, volume.
- [ ] Export avec audio → suppression → import : morceau équivalent y compris audios et types.
- [ ] Hors ligne : indisponible (phase 2).

## Bloquée par

- Phase 4 : Export avec fichiers audio
- Phase 8 : Import création — morceaux et paroles

---

## Phase 10 : Rapport, échec partiel, archive incomplète

**User stories** : US-18, US-19, US-24

### Ce qu’on livre

À la fin d’un import : rapport (analysés, créés, mis à jour, ignorés, audios envoyés, déjà présents, erreurs) et accès aux détails. Si un fichier échoue en cours d’envoi, ce qui a réussi reste ; l’échec est dans le rapport. Pour une archive incomplète déjà distinguée en prévisualisation, seuls les morceaux valides confirmés sont importés.

### Critères d’acceptation

- [ ] Un rapport s’affiche en fin d’import, avec totaux et lien vers les détails.
- [ ] Un audio en échec : le morceau et les audios déjà OK restent ; l’échec est listé.
- [ ] Archive incomplète : les morceaux valides confirmés sont dans le répertoire ; les endommagés ne le sont pas (sauf pièces valides déjà gardées).

## Bloquée par

- Phase 8 : Import création — morceaux et paroles
- Phase 9 : Import des fichiers audio et progression

---

## Phase 11 : Conflits et mise à jour

**User stories** : US-15, US-16, US-17

### Ce qu’on livre

Réimporter une archive alors que des morceaux existent : pour chaque correspondance exacte (identifiant d’origine dans ce groupe, sinon titre + artiste, sinon titre), proposition par défaut **Mettre à jour**, sinon créer un nouveau morceau, sinon ignorer. Case « appliquer à tous les conflits similaires » et politiques globales (toujours copier / toujours mettre à jour la correspondance exacte / toujours ignorer). Mettre à jour = infos et paroles de l’archive remplacent ; audios de l’archive ajoutés s’ils n’y sont pas ; aucun audio déjà dans FaderZero n’est supprimé. Pas de fusion automatique « à peu près ».

### Critères d’acceptation

- [ ] Réimport de la même archive : conflit proposé, défaut = mettre à jour.
- [ ] Appliquer à tous les conflits similaires évite de répondre morceau par morceau.
- [ ] Mettre à jour ne supprime aucun audio déjà présent ; ajoute les audios manquants ; remplace infos et paroles.
- [ ] Créer un nouveau morceau laisse l’existant intact et ajoute une copie.
- [ ] Ignorer ne modifie pas le morceau existant.
- [ ] Une correspondance seulement approximative ne fusionne pas toute seule.

## Bloquée par

- Phase 8 : Import création — morceaux et paroles

---

## Phase 12 : Import d’un dossier maison

**User stories** : US-7, US-26, US-27

### Ce qu’on livre

L’admin dépose un dossier (ou une archive de dossier) sans fichier technique FaderZero : un sous-dossier par morceau, fichier de paroles reconnu, préfixes DEMO / MASTER / etc. pour le type. Même prévisualisation et même moteur d’import que les phases 6–8. Nom ambigu : type proposé (pas un refus). L’admin n’écrit pas de manifeste.

### Critères d’acceptation

- [ ] Un dossier « un sous-dossier = un morceau » + paroles texte + audios produit une prévisualisation puis des morceaux après confirmation.
- [ ] Le titre vient du nom de dossier (sauf infos archive si présentes).
- [ ] `DEMO__…` / `MASTER__…` (date et description optionnelles) donnent Démo / Master.
- [ ] Un nom ambigu propose un type au lieu de refuser le fichier.
- [ ] Aucun fichier technique n’est exigé.

## Bloquée par

- Phase 6 : Prévisualisation sans écriture
- Phase 8 : Import création — morceaux et paroles

---

## Phase 13 : Quota avant envoi

**User stories** : US-13

### Ce qu’on livre

Avant tout envoi audio, FaderZero compare la **durée** des nouveaux audios au quota du groupe (comme aujourd’hui) et affiche aussi la **taille** à envoyer (Mo / Go). Si la durée ne passe pas : blocage, durée manquante + taille, pas d’envoi.

### Critères d’acceptation

- [ ] La prévisualisation affiche la taille à envoyer et l’impact durée sur le quota.
- [ ] Quota durée insuffisant : import bloqué avant envoi, durée manquante visible.
- [ ] Quota suffisant : l’envoi peut démarrer (phases 9+).

## Bloquée par

- Phase 9 : Import des fichiers audio et progression

---

## Phase 14 : Déduplication

**User stories** : US-14

### Ce qu’on livre

Deux fichiers au même contenu ne sont pas renvoyés ni recomptés dans le quota. L’import les rattache au fichier déjà présent. Le rapport indique les audios « déjà présents ».

### Critères d’acceptation

- [ ] Réimport d’un audio identique : pas de second envoi, pas de double comptage durée.
- [ ] Le morceau (nouveau ou mis à jour) peut quand même jouer ce fichier.
- [ ] Le rapport distingue audios envoyés vs déjà présents.

## Bloquée par

- Phase 9 : Import des fichiers audio et progression
