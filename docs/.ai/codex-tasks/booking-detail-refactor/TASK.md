# Refonte UI de la fiche booking FaderZero

## Mission

Implémenter la refonte de l’écran **détail d’une salle / prospection booking** de FaderZero à partir de la référence visuelle fournie, tout en conservant strictement l’identité visuelle, les composants, les comportements et l’architecture du reste de l’application.

Ne t’arrête pas à un plan : inspecte le projet, implémente la refonte, exécute les validations et rends un compte-rendu final.

## Référence visuelle

- Prototype interactif : `.ai/codex-tasks/booking-detail-refactor/references/booking-ui-reference.html`
- Carte contact validée : `.ai/codex-tasks/booking-detail-refactor/references/contact-card-reference.png`
- Capture de contexte mobile : `.ai/codex-tasks/booking-detail-refactor/references/booking-screen-context.jpg`

Le prototype HTML est la référence principale pour la hiérarchie actuelle. La petite capture `contact-card-reference.png` est la référence la plus précise pour la tuile de contact. La capture de contexte aide uniquement à comprendre l’intégration mobile. Elle ne doit pas être copiée comme une nouvelle charte graphique.

Ne pas intégrer dans l’application :

- la barre supérieure du canvas ;
- les panneaux explicatifs autour du téléphone ;
- le sélecteur clair/sombre du canvas ;
- le faux châssis de téléphone ;
- les données de démonstration telles quelles.

## Contexte technique à lire avant modification

Lire d’abord :

1. `AGENTS.md` ;
2. les éventuels `AGENTS.md` imbriqués concernant `src/` ou `src/features/booking/` ;
3. les éventuelles skills UI du dépôt applicables à FaderZero ;
4. `src/features/booking/BookingPage.tsx` ;
5. `src/components/FormDialog.tsx` ;
6. `src/components/AppShell.tsx` ;
7. `src/app/styles.css` ;
8. `src/db/schema.ts` ;
9. `src/db/repositories/bookingRepository.ts`.

## Portée

Refondre principalement la vue affichée lorsqu’un lead booking est sélectionné dans `BookingPage`.

La liste des salles et ses onglets ne doivent pas être redessinés, sauf ajustement minime nécessaire à l’extraction de composants ou à la cohérence technique.

Il est permis de créer de petits composants dans `src/features/booking/` pour éviter de conserver un fichier `BookingPage.tsx` trop volumineux.

Ne pas modifier le modèle de données ni créer de migration : les champs nécessaires existent déjà, notamment `BookingLeadRecord.summary`, `targetDate`, `nextAction` et `nextActionAt`.

## Hiérarchie cible de la fiche

### 1. En-tête de la salle

Conserver :

- retour à la liste ;
- nom de la salle ou de l’organisateur ;
- ville ;
- date cible/prévue lorsqu’elle existe ;
- menu de modification `•••` ;
- respect des permissions `canWrite`.

La ligne secondaire doit afficher la ville et la date prévue de manière compacte, par exemple :

`Angers · 22 août 2026`

Prévoir un libellé correct pour une période cible ou une date absente.

### 2. Statut de la prospection

Afficher un sélecteur/progress-stepper compact sous l’en-tête, cohérent avec les surfaces et tokens FaderZero.

Conserver tous les statuts métier existants :

- `to_contact` — À contacter ;
- `contacted` — Contacté ;
- `in_discussion` — En échange ;
- `option` — Option ;
- `confirmed` — Confirmé.

Le statut `closed` reste géré dans l’édition et ne doit pas être présenté comme une étape normale du pipeline actif.

Contraintes :

- aucune grande tuile « Prochaine action » ;
- aucune section ou tuile « Négociation » séparée ;
- le statut doit rester lisible sans dominer tout l’écran ;
- ne pas perdre l’action « Ajouter au calendrier » lorsqu’un lead confirmé n’a pas encore d’événement ;
- conserver l’indication « Au calendrier » lorsque `eventId` est présent.

### 3. Contacts — au-dessus des notes et de la timeline

Reproduire l’esprit de la carte de la référence :

- carte horizontale compacte ;
- avatar rond avec initiales ;
- nom en gras ;
- seconde ligne de type `Programmation · contact principal` ;
- boutons téléphone et e-mail carrés à droite ;
- fond, bordure, rayon et contraste compatibles avec les cartes FaderZero existantes ;
- cibles tactiles accessibles d’environ 40 à 44 px ;
- icônes SVG simples, sans ajouter de bibliothèque d’icônes.

Comportements à préserver :

- appel via `tel:` seulement si un téléphone existe ;
- e-mail via `mailto:` seulement si un e-mail existe ;
- état désactivé explicite si une coordonnée manque ;
- accès à la modification du contact ;
- possibilité de retirer le contact du lead ;
- ajout d’un nouveau contact ;
- liaison d’un contact existant.

Pour garder la carte principale propre, placer l’édition et le retrait dans une interaction secondaire cohérente avec FaderZero : toucher la carte pour modifier, petit menu contextuel, ou action dans la bottom sheet d’édition. Ne pas supprimer ces fonctionnalités.

Il n’existe pas de champ persistant « contact principal ». Sans migration, considérer uniquement le premier contact lié comme principal dans l’affichage. Les autres contacts utilisent la même carte sans ce suffixe.

### 4. Notes globales — au-dessus de la timeline

Afficher `selected.summary` dans une carte sobre intitulée **Notes globales**.

Ajouter la modification de cette valeur dans la bottom sheet « Détails de la salle » avec un champ textarea approprié.

Règles :

- ne pas confondre `BookingLeadRecord.summary` avec les notes datées de la timeline ;
- afficher un état vide discret lorsque le résumé global est absent ;
- permettre l’édition uniquement lorsque `canWrite` est vrai ;
- réutiliser `bookingRepository.updateLead` ; aucune migration n’est nécessaire.

### 5. Timeline

Placer la timeline après les contacts et les notes globales.

Dans l’en-tête de section, afficher uniquement un bouton compact **Ajouter une note** à droite.

Contraintes :

- aucun champ ou composer sticky en bas de la timeline ;
- le bouton ouvre la bottom sheet d’échange existante ;
- les événements historiques utilisent les données `notes` existantes ;
- conserver le type d’échange, le résumé et l’horodatage ;
- conserver l’ordre antéchronologique déjà fourni par le repository ;
- afficher la prochaine action dans la timeline sous forme d’élément à venir/à faire, mais pas dans une grande carte séparée ;
- signaler sobrement une échéance en retard ;
- ne pas dupliquer la prochaine action si elle est déjà représentée ailleurs ;
- conserver un état vide propre si aucune note n’existe.

### 6. Bottom sheets et formulaires

Conserver `FormDialog` et l’apparence des bottom sheets de l’application.

Le formulaire « Consigner un échange » conserve :

- type d’échange ;
- résumé ;
- prochaine action ;
- date et heure de la prochaine action ;
- validations actuelles ;
- mise à jour atomique de la note et de la prochaine action via le repository.

Le bouton de section peut être nommé « Ajouter une note », mais la bottom sheet reste capable de consigner tous les types d’échange.

La bottom sheet « Détails de la salle » doit conserver :

- salle/organisateur ;
- ville ;
- date cible ;
- statut ;
- suppression avec confirmation ;
- et ajouter le champ `summary` pour les notes globales.

## Fonctionnalités à ne pas casser

Préserver intégralement :

- lecture réactive Dexie via `useLiveQuery` ;
- permissions en lecture/écriture ;
- création, édition, liaison et retrait de contacts ;
- ajout d’échanges ;
- prochaine action obligatoire pour une prospection active ;
- archivage/suppression du lead ;
- confirmation et création de concert dans le calendrier ;
- messages d’erreur ;
- comportement local-first et synchronisation existante ;
- navigation retour et restauration du scroll gérées par l’AppShell.

## Cohérence visuelle FaderZero

La page doit sembler native au reste de FaderZero, pas être un mini-projet indépendant.

À respecter :

- variables existantes `--fz-*` ;
- classes réutilisables comme `fz-card`, `fz-input`, `fz-button-*` lorsque pertinentes ;
- largeur mobile `max-w-md` de l’AppShell ;
- fond sombre, accent rose et texte ivoire existants ;
- rayons, bordures et densité proches des autres pages ;
- safe areas et navigation basse existante ;
- typographie du projet ;
- états focus visibles ;
- boutons accessibles au clavier et lecteurs d’écran ;
- pas de dépendance UI supplémentaire ;
- pas de styles globaux risquant de modifier les autres fonctionnalités.

Préférer des classes Tailwind locales ou quelques classes `fz-*` réellement génériques. Ne pas ajouter une grande quantité de CSS global spécifique au booking dans `styles.css` si des composants locaux suffisent.

## Architecture recommandée

Tu peux conserver toute la logique dans `BookingPage.tsx`, mais une extraction limitée est préférable si elle améliore la lisibilité, par exemple :

- `BookingLeadDetail.tsx` ;
- `BookingContactCard.tsx` ;
- `BookingTimeline.tsx`.

Ne pas sur-abstraire. Garder les handlers de données près de `BookingPage` si cela évite des props complexes.

## Tests attendus

Ajouter ou adapter des tests ciblés pour couvrir au minimum :

1. affichage du nom, de la ville et de la date prévue ;
2. affichage de tous les statuts actifs ;
3. absence de grande tuile « Prochaine action » et de section « Négociation » ;
4. carte contact compacte et états téléphone/e-mail ;
5. notes globales alimentées par `selected.summary` ;
6. bouton « Ajouter une note » en haut de la timeline ;
7. affichage de la prochaine action dans la timeline ;
8. ouverture des formulaires existants ;
9. comportement en lecture seule lorsque `canWrite` est faux.

Utiliser les conventions de test déjà présentes dans le dépôt. Ne pas introduire un nouveau framework.

## Validation obligatoire

Exécuter depuis la racine du dépôt :

```bash
npm run typecheck
npm run lint
npm run test
npm run build
```

Si un test global préexistant échoue sans lien avec la modification, l’indiquer précisément, mais corriger tout échec introduit par cette refonte.

Effectuer aussi une vérification manuelle en vue mobile proche de `390 × 844` et vérifier :

- aucun débordement horizontal ;
- cartes contact lisibles ;
- boutons tactiles utilisables ;
- bottom sheets utilisables avec clavier virtuel ;
- timeline lisible avec plusieurs notes ;
- cas sans contact, sans note globale et sans historique.

## Critères d’acceptation

La tâche est terminée lorsque :

- la fiche détail booking suit la référence visuelle sans copier le canvas extérieur ;
- il n’y a ni tuile « Prochaine action » ni section « Négociation » ;
- le statut est affiché de manière compacte ;
- les contacts sont au-dessus des notes et de la timeline ;
- la carte contact correspond à la référence compacte ;
- les notes globales utilisent `BookingLeadRecord.summary` ;
- le bouton « Ajouter une note » est placé en haut de la timeline ;
- la prochaine action est représentée dans la timeline ;
- toutes les fonctionnalités précédentes restent accessibles ;
- l’UI est cohérente avec le reste de FaderZero ;
- les validations demandées passent.

## Compte-rendu final

À la fin, fournir :

- résumé des changements ;
- liste des fichiers modifiés/créés ;
- choix UI importants ;
- commandes exécutées et résultats ;
- tests ajoutés ;
- écarts éventuels par rapport à la référence et justification ;
- points restant à vérifier manuellement.
