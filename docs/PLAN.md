# Plan : Parcours d’installation de la webapp

> PRD source : `docs/PRD.md`

## Décisions architecturales

Décisions durables qui s’appliquent à toutes les phases :

- **Routes et domaine** : le parcours ne crée aucune route dédiée et n’est proposé que dans l’application servie sur `app.faderzero.com`. La landing publique reste inchangée.
- **Persistance** : aucune donnée d’installation n’est enregistrée en base. L’état du parcours et l’éventuelle capacité d’installation directe restent limités à la session du navigateur.
- **Modèle clé** : un environnement d’installation commun expose le système d’exploitation, le navigateur, le mode navigateur ou standalone et la disponibilité éventuelle d’une installation directe.
- **Authentification** : le parcours est indépendant de l’état de connexion et utilise le même comportement sur les écrans de connexion, d’inscription et dans l’app connectée.
- **Frontière navigateur** : l’installation directe repose exclusivement sur la capacité offerte par le navigateur après une action explicite de l’utilisateur. Une aide manuelle adaptée reste toujours disponible en secours.
- **État installé** : FaderZero masque le point d’entrée lorsqu’il est ouvert en mode standalone ou lorsqu’une installation réussit pendant la session. Il ne tente pas de détecter une installation réalisée depuis un autre navigateur.
- **Présentation** : le parcours utilise un panneau remontant du bas sur mobile et une modale centrée sur ordinateur. Les tutoriels emploient des illustrations simplifiées plutôt que des captures d’écran.
- **Accessibilité** : le bouton, la modale, le panneau et toutes les actions restent utilisables au clavier, annonçables par un lecteur d’écran et refermables sans installer l’application.

---

## Phase 1 : Point d’entrée et parcours générique

**User stories** : US-1, US-2, US-3, US-6, US-11, US-13, US-14

### Ce qu’on livre

Un premier parcours complet permet d’ouvrir l’aide à l’installation depuis les écrans de connexion, d’inscription et depuis l’app connectée. FaderZero reconnaît l’environnement courant, masque le bouton en mode standalone et affiche une aide générique exploitable lorsqu’aucun parcours plus précis n’est disponible. L’interface adopte dès cette tranche son format mobile ou ordinateur définitif.

### Critères d’acceptation

- [ ] Sur `app.faderzero.com` dans un navigateur, le bouton **Installer** est visible près du logo avant et après connexion.
- [ ] Sur mobile, le bouton conserve une icône et le libellé **Installer** sans empêcher l’utilisation des autres contrôles de l’en-tête.
- [ ] Lorsque FaderZero est ouvert en mode standalone, le bouton est absent.
- [ ] Le clic ouvre un panneau remontant du bas sur mobile et une modale centrée sur ordinateur.
- [ ] Un environnement non reconnu reçoit une aide générique et ne produit jamais un contenu vide.
- [ ] Fermer le parcours sans installer conserve le bouton et permet de le rouvrir.
- [ ] Le bouton et le parcours sont utilisables au clavier et correctement annoncés par un lecteur d’écran.
- [ ] Aucun bouton **Installer** n’apparaît sur la landing publique.

## Bloquée par

Aucune — démarrable immédiatement.

---

## Phase 2 : Installation native

**User stories** : US-4, US-5, US-12, US-14

### Ce qu’on livre

Lorsqu’un navigateur compatible propose l’installation directe, le parcours présente **Installer maintenant** et ouvre la fenêtre native après confirmation de l’utilisateur. Une réussite masque immédiatement le bouton. Une fermeture, un refus ou l’indisponibilité ultérieure de l’installation directe bascule immédiatement vers l’aide manuelle adaptée, sans bloquer une nouvelle consultation du parcours.

### Critères d’acceptation

- [ ] Lorsque l’installation directe est disponible, le parcours affiche **Installer maintenant**.
- [ ] Un clic sur **Installer maintenant** ouvre la fenêtre d’installation du navigateur.
- [ ] Après une installation réussie, le bouton **Installer** disparaît immédiatement pour le reste de la session.
- [ ] Après un refus ou la fermeture de la fenêtre native, l’aide manuelle adaptée apparaît immédiatement.
- [ ] Après un refus, le point d’entrée reste disponible et le parcours peut être rouvert.
- [ ] Si la capacité d’installation directe n’est plus disponible, l’utilisateur voit le parcours manuel plutôt qu’une action inopérante.
- [ ] Les comportements de réussite, refus, fermeture et absence de capacité directe sont couverts par des tests automatisés.

## Bloquée par

- Phase 1 : Point d’entrée et parcours générique.

---

## Phase 3 : Parcours iPhone et iPad

**User stories** : US-6, US-7, US-8

### Ce qu’on livre

Sur iPhone et iPad, le parcours explique l’installation manuelle avec des illustrations simplifiées. Safari et Chrome disposent chacun d’une variante correspondant à l’emplacement de leur commande **Partager**, puis convergent vers **Ajouter à l’écran d’accueil** et **Ajouter**.

### Critères d’acceptation

- [ ] Sur Safari iPhone ou iPad, le parcours montre successivement **Partager**, **Ajouter à l’écran d’accueil** et **Ajouter**.
- [ ] Sur Chrome iPhone ou iPad, le parcours montre les mêmes actions avec une illustration propre à l’interface de Chrome.
- [ ] Les illustrations de Safari et Chrome sont visuellement distinctes et restent compréhensibles sans capture d’écran réelle.
- [ ] Un autre navigateur sur iPhone ou iPad reçoit une aide manuelle cohérente utilisant le menu de partage.
- [ ] Les illustrations sont ignorées par le lecteur d’écran lorsque leur information est déjà donnée par le texte.
- [ ] Les variantes Safari, Chrome et navigateur iOS inconnu sont couvertes par des tests automatisés.

## Bloquée par

- Phase 1 : Point d’entrée et parcours générique.

---

## Phase 4 : Parcours ordinateur sans installation native

**User stories** : US-6, US-9, US-10, US-11

### Ce qu’on livre

Les utilisateurs sur ordinateur qui ne disposent pas de l’installation directe reçoivent une réponse adaptée. Safari sur macOS présente le parcours **Ajouter au Dock**. Firefox explique que l’installation directe n’est pas disponible et recommande d’ouvrir FaderZero avec Chrome ou Edge. Les autres environnements retombent sur l’aide générique.

### Critères d’acceptation

- [ ] Sur Safari macOS compatible, le parcours indique clairement **Ajouter au Dock**.
- [ ] Sur Safari macOS sans parcours spécifique disponible, l’utilisateur reçoit une aide manuelle exploitable plutôt qu’une action d’installation directe inopérante.
- [ ] Sur Firefox ordinateur, le parcours explique l’indisponibilité de l’installation directe et recommande Chrome ou Edge.
- [ ] Sur un navigateur ou un système non reconnu, l’aide générique s’affiche.
- [ ] Aucun de ces parcours ne prétend détecter une installation réalisée depuis un autre navigateur.
- [ ] Les variantes Safari macOS, Firefox ordinateur et environnement inconnu sont couvertes par des tests automatisés.

## Bloquée par

- Phase 1 : Point d’entrée et parcours générique.
