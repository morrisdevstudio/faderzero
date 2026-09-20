## Problème

Un utilisateur qui ouvre FaderZero dans un navigateur ne sait pas toujours qu’il peut l’installer comme une véritable application sur son téléphone ou son ordinateur. Le parcours varie selon le système d’exploitation et le navigateur : certains proposent une fenêtre d’installation directe, tandis que d’autres imposent de passer par un menu de partage ou une commande spécifique.

Sans accompagnement adapté, l’utilisateur doit deviner la procédure ou chercher des instructions ailleurs. À l’inverse, lorsqu’il utilise déjà FaderZero en mode PWA/standalone, une invitation à l’installation serait inutile et confuse.

## Solution

Sur `app.faderzero.com`, FaderZero affiche un bouton **Installer** à côté du logo lorsqu’il est ouvert dans un navigateur. Ce bouton est disponible sur les écrans de connexion et d’inscription comme dans l’app connectée.

Au clic, FaderZero reconnaît le système d’exploitation et le navigateur afin d’afficher le parcours approprié. Lorsqu’une installation directe est disponible, l’utilisateur peut la lancer avec **Installer maintenant**. Sinon, il reçoit un tutoriel illustré et adapté à son environnement.

Une fois FaderZero ouvert en mode PWA/standalone ou installé pendant la session, le bouton disparaît complètement.

## Utilisateur cible

Un musicien ou membre de groupe utilisant `app.faderzero.com` depuis un téléphone, une tablette ou un ordinateur. Il peut être en train de découvrir FaderZero, de se connecter ou d’utiliser son espace de travail. Il souhaite accéder rapidement à l’application depuis son écran d’accueil, son Dock ou son bureau, sans devoir connaître les particularités de son navigateur.

## User Stories

US-1. En tant que visiteur sur l’écran de connexion ou d’inscription, je veux voir le bouton **Installer**, afin de pouvoir installer FaderZero avant de créer ou d’ouvrir mon compte.

US-2. En tant que membre connecté utilisant FaderZero dans un navigateur, je veux voir le bouton **Installer** près du logo, afin de découvrir facilement que l’app peut être installée.

US-3. En tant qu’utilisateur ayant ouvert FaderZero en mode PWA/standalone, je veux que le bouton **Installer** soit absent, afin de ne pas recevoir une action inutile.

US-4. En tant qu’utilisateur d’un navigateur permettant l’installation directe, je veux pouvoir choisir **Installer maintenant**, afin d’ouvrir la fenêtre d’installation de mon navigateur.

US-5. En tant qu’utilisateur ayant fermé ou refusé l’installation directe, je veux voir immédiatement les instructions manuelles adaptées, afin de pouvoir poursuivre l’installation autrement.

US-6. En tant qu’utilisateur pour lequel l’installation directe n’est pas proposée, je veux recevoir directement un tutoriel adapté à mon système et à mon navigateur, afin de ne pas être bloqué.

US-7. En tant qu’utilisateur d’un iPhone ou d’un iPad avec Safari, je veux voir comment utiliser **Partager**, puis **Ajouter à l’écran d’accueil**, afin d’installer FaderZero.

US-8. En tant qu’utilisateur d’un iPhone ou d’un iPad avec Chrome, je veux voir une illustration correspondant à l’emplacement de **Partager** dans Chrome, afin de suivre le bon parcours.

US-9. En tant qu’utilisateur de Safari sur macOS, je veux voir le parcours **Ajouter au Dock**, afin d’installer FaderZero comme application.

US-10. En tant qu’utilisateur de Firefox sur ordinateur, je veux être informé que l’installation directe n’est pas disponible et être orienté vers Chrome ou Edge, afin de connaître une solution compatible.

US-11. En tant qu’utilisateur d’un environnement non reconnu ou non compatible, je veux recevoir une explication générique et exploitable, afin de ne pas tomber sur un parcours vide.

US-12. En tant qu’utilisateur ayant installé FaderZero pendant la session, je veux que le bouton **Installer** disparaisse immédiatement, afin que l’interface reflète la réussite de l’installation.

US-13. En tant qu’utilisateur sur téléphone, je veux un bouton compact avec le libellé **Installer** et une icône, afin qu’il ne surcharge pas la barre supérieure.

US-14. En tant qu’utilisateur ayant quitté le parcours sans installer FaderZero, je veux pouvoir rouvrir le bouton **Installer**, afin de reprendre les instructions plus tard.

## Critères de succès

1. Sur `app.faderzero.com` ouvert dans un navigateur, le bouton **Installer** apparaît sur les écrans de connexion, d’inscription et dans l’app connectée.
2. En mode PWA/standalone, le bouton **Installer** n’apparaît sur aucun de ces écrans.
3. Sur un navigateur proposant l’installation directe, **Installer maintenant** ouvre la fenêtre d’installation du navigateur.
4. Lorsque l’utilisateur ferme ou refuse cette fenêtre, le parcours manuel adapté s’affiche immédiatement.
5. Sur iPhone ou iPad avec Safari, le parcours affiche les étapes **Partager**, **Ajouter à l’écran d’accueil**, puis **Ajouter**.
6. Sur iPhone ou iPad avec Chrome, le parcours utilise une illustration distincte correspondant à son interface.
7. Sur Safari macOS compatible, le parcours indique **Ajouter au Dock**.
8. Sur Firefox ordinateur, le parcours explique que l’installation directe n’est pas disponible et recommande Chrome ou Edge.
9. Lorsqu’aucun parcours précis ne peut être déterminé, une aide générique remplace le contenu spécifique.
10. Sur mobile, le parcours s’ouvre dans un panneau remontant du bas ; sur ordinateur, il s’ouvre dans une modale centrée.
11. Après une installation réussie pendant la session, le bouton disparaît immédiatement.
12. Si l’utilisateur ferme le parcours sans installer FaderZero, le bouton reste disponible.
13. Le bouton et tous les contrôles du parcours sont utilisables au clavier et disposent de libellés explicites pour les lecteurs d’écran.
14. Aucun bouton **Installer** n’est ajouté à la landing publique de `faderzero.com`.

## Hors périmètre

- La landing publique de `faderzero.com`.
- La détection d’une installation effectuée depuis un autre navigateur.
- L’installation automatique sans action explicite de l’utilisateur.
- Le suivi analytique des ouvertures, refus ou installations.
- De véritables captures d’écran des interfaces des navigateurs.
- Un parcours différent selon que l’utilisateur est connecté ou non.
- La promesse d’une installation directe lorsque le navigateur ne la propose pas.
- La modification des mécanismes d’installation appartenant au système ou au navigateur.
- La suppression définitive du bouton après un refus ou la fermeture du tutoriel.

## Décisions d’implémentation

- Le bouton **Installer** apparaît uniquement sur `app.faderzero.com`.
- Il est visible avant et après connexion lorsque FaderZero est ouvert dans un navigateur.
- Il se place à côté du logo dans l’en-tête.
- Sur mobile, il conserve uniquement une icône et le libellé **Installer** afin de limiter son encombrement.
- Le bouton disparaît lorsque FaderZero est actuellement ouvert en mode PWA/standalone.
- La présence d’une installation effectuée dans un autre navigateur n’est pas supposée.
- Lorsqu’une installation directe est disponible, le parcours présente le titre **Installer FaderZero**, un court bénéfice d’usage et l’action principale **Installer maintenant**.
- En l’absence d’installation directe, le tutoriel adapté est affiché sans étape intermédiaire inutile.
- Si l’installation directe est refusée ou fermée, le tutoriel manuel adapté apparaît immédiatement.
- Les parcours iOS utilisent des illustrations simplifiées distinctes pour Safari et Chrome.
- Le tutoriel apparaît dans un panneau remontant du bas sur mobile et dans une modale centrée sur ordinateur.
- Une installation réussie masque immédiatement le bouton.
- Une fermeture ou un refus conserve le bouton pour une prochaine tentative.
- Les environnements non reconnus disposent d’un message générique et ne produisent jamais de parcours vide.

## Notes complémentaires

Rien à signaler.
