# Plan : Retour selon le chemin

> PRD source : `docs/PRD.md`

## Décisions architecturales

Décisions durables qui s’appliquent à toutes les phases :

- **Routes** : inchangées. App connectée : `/`, `/home`, `/songs`, `/songs/:songId`, `/songs/:songId/write`, `/songs/:songId/structure`, `/songs/:songId/live`, `/setlists`, `/setlists/:setlistId`, `/prompter`, `/prompter/play`, `/booking`, `/booking/:bookingId`, `/calendar`, `/account`, `/account/epk`, `/metronome`. Hors app connectée : `/landing`, EPK public, pages légales — pas de filet Accueil.
- **Schema** : aucun changement de base locale ni distante.
- **Modèles clés** : aucun nouveau modèle métier. La pile de navigation est l’historique du navigateur de l’app connectée.
- **Écran vs micro-état** : un changement d’écran (chemin d’URL) empile une étape. Un changement de requête dans le même écran (ex. morceau suivant dans le prompteur) remplace l’étape courante. Les sous-pages Compte restent un Retour interne, hors de cette pile.
- **Filets sans chemin interne** : Accueil pour détail morceau, détail setlist, détail booking, session prompteur ; morceau pour paroles et structure ; liste Morceaux pour un nouveau brouillon de paroles sans morceau créé ; structure pour le Live ; Compte pour l’EPK ; calendrier pour un booking ouvert depuis le calendrier.
- **Onglets** : un changement d’onglet empile une étape, comme un lien. Pas de pile séparée par onglet.

---

## Phase 1 : Retour du morceau

**User stories** : US-1, US-2, US-5, US-6, US-7, US-8, US-9 (morceau), US-26 (flèche)

### Ce qu’on livre

Dans l’app connectée, la flèche du détail morceau rejoue le chemin réel : ouverte depuis l’Accueil elle ramène à l’Accueil ; ouverte depuis la liste Morceaux elle ramène à cette liste. Sans chemin interne, elle mène à l’Accueil. Les onglets empilent. Accueil, listes, métronome et Compte racine n’ont pas de flèche. Le geste téléphone rejoue la même pile ; à l’Accueil tout neuf, il quitte l’app. La flèche s’annonce « Retour ».

### Critères d’acceptation

- [ ] Depuis l’Accueil, ouvrir un morceau, taper la flèche : l’Accueil s’affiche.
- [ ] Depuis la liste Morceaux, ouvrir un morceau, taper la flèche : la liste Morceaux s’affiche.
- [ ] Détail morceau sans chemin interne, flèche : l’Accueil s’affiche.
- [ ] Un changement d’onglet puis un geste Retour ramène à l’écran d’avant l’onglet.
- [ ] Accueil, listes Morceaux/Setlists, métronome, Compte racine : aucune flèche.
- [ ] Flèche et geste téléphone mènent au même écran sur un même chemin.
- [ ] Geste téléphone à l’Accueil sans autre écran visité : l’app se quitte.
- [ ] Lecteur d’écran : la flèche s’annonce « Retour ».

## Bloquée par

Aucune — démarrable immédiatement.

---

## Phase 2 : Croix du prompteur

**User stories** : US-3, US-4, US-18, US-26 (croix)

### Ce qu’on livre

La croix du prompteur rejoue le chemin : ouvert depuis un détail morceau, elle y ramène ; ouvert depuis la bibliothèque, elle y ramène. Sans chemin interne, filet Accueil. Passer au morceau suivant dans le prompteur ne crée pas une étape : Fermer quitte vraiment le prompteur. La croix s’annonce « Quitter le prompteur » ou « Fermer ».

### Critères d’acceptation

- [ ] Prompteur ouvert depuis un détail morceau, croix : le même détail s’affiche.
- [ ] Prompteur ouvert depuis la bibliothèque, croix : la bibliothèque s’affiche.
- [ ] Prompteur sans chemin interne, croix : l’Accueil s’affiche.
- [ ] Morceau suivant dans le prompteur puis croix : on quitte le prompteur vers l’écran d’ouverture, on ne reste pas dans le prompteur.
- [ ] Lecteur d’écran : la croix s’annonce « Quitter le prompteur » ou « Fermer ».

## Bloquée par

- Phase 1

---

## Phase 3 : Détail setlist et booking

**User stories** : US-9 (setlist, booking)

### Ce qu’on livre

Les flèches du détail setlist et du détail booking rejouent le chemin, avec le même filet Accueil que le morceau.

### Critères d’acceptation

- [ ] Setlist ouverte depuis sa liste, flèche : la liste Setlists s’affiche.
- [ ] Setlist ouverte depuis un autre écran (ex. Accueil ou onglet), flèche : cet écran s’affiche.
- [ ] Détail setlist sans chemin interne, flèche : l’Accueil s’affiche.
- [ ] Même comportement pour le détail booking (`/booking/:bookingId`), filet Accueil.

## Bloquée par

- Phase 1

---

## Phase 4 : Paroles, structure, Live

**User stories** : US-10 (paroles/structure), US-11, US-12, US-13, US-14, US-15, US-23

### Ce qu’on livre

Retour depuis les paroles, la structure et le Live rejoue le chemin. Sans chemin interne : morceau pour paroles et structure ; liste Morceaux pour un nouveau brouillon de paroles sans morceau créé ; structure pour le Live. Un brouillon de paroles vide se ferme tout de suite, sans dialogue.

### Critères d’acceptation

- [ ] Paroles ouvertes depuis un morceau, flèche : le morceau s’affiche.
- [ ] Paroles sans chemin interne, flèche : le morceau s’affiche.
- [ ] Nouveau brouillon de paroles sans morceau créé, sans chemin interne : la liste Morceaux s’affiche.
- [ ] Brouillon de paroles vide : sortie immédiate, pas de dialogue.
- [ ] Structure sans chemin interne, flèche : le morceau s’affiche.
- [ ] Live lancé depuis le morceau, croix : le morceau s’affiche.
- [ ] Live sans chemin interne, croix : la structure s’affiche.

## Bloquée par

- Phase 1

---

## Phase 5 : EPK et booking depuis le calendrier

**User stories** : US-10 (EPK), US-16, US-17

### Ce qu’on livre

Retour depuis l’EPK et depuis un booking ouvert au calendrier rejoue le chemin. Sans chemin interne : Compte pour l’EPK, calendrier pour ce booking.

### Critères d’acceptation

- [ ] EPK ouvert depuis le Compte, Retour : le Compte s’affiche.
- [ ] EPK sans chemin interne, Retour : le Compte s’affiche.
- [ ] Booking ouvert depuis le calendrier, flèche : le calendrier s’affiche.
- [ ] Booking ouvert depuis le calendrier, sans chemin interne, flèche : le calendrier s’affiche.

## Bloquée par

- Phase 1

---

## Phase 6 : Couche du dessus, puis écran

**User stories** : US-20, US-21, US-22

### Ce qu’on livre

Un premier Retour (flèche, croix ou geste téléphone) ferme le dialogue, le picker ou le panneau ouvert ; l’écran en dessous ne change pas. Un second Retour quitte l’écran selon le chemin. Les dialogues de sortie des éditeurs paroles et EPK s’appliquent aussi au geste téléphone.

### Critères d’acceptation

- [ ] Dialogue ou panneau ouvert + Retour : seule la couche se ferme, l’écran reste.
- [ ] Second Retour, plus rien d’ouvert : l’écran quitte selon le chemin.
- [ ] Éditeur paroles avec travail en cours : le geste téléphone affiche le même dialogue que la flèche.
- [ ] Éditeur EPK avec travail en cours : le geste téléphone affiche le même dialogue que la croix / flèche.

## Bloquée par

- Phase 1
- Phase 4 (garde paroles)
- Phase 5 (garde EPK)

---

## Phase 7 : Sortie sans fantôme + hors-périmètre tenu

**User stories** : US-19, US-24, US-25

### Ce qu’on livre

Supprimer un morceau retire cet écran du chemin : on retombe où on l’avait ouvert, un Retour suivant ne le rouvre pas. Les sous-pages Compte gardent leur Retour interne. Landing, EPK public et pages légales restent le Retour habituel du navigateur.

### Critères d’acceptation

- [ ] Morceau ouvert depuis l’Accueil, suppression : l’Accueil s’affiche ; un Retour suivant n’ouvre pas le morceau supprimé.
- [ ] Sous-pages Compte : Retour interne groupe / sécurité / paramètres, sans quitter le Compte.
- [ ] Sur la landing, un EPK public ou une page légale, Retour ne force pas l’entrée dans l’app connectée.

## Bloquée par

- Phase 1
