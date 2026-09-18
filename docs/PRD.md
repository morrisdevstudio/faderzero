## Problème

Le musicien ouvre souvent un morceau, une setlist ou le prompteur depuis un raccourci (Accueil, autre onglet, détail déjà ouvert), pas depuis la liste officielle de la section. La flèche en haut à gauche et la croix ne le ramènent pas là où il était : elles sautent vers la page parent de la section (liste des morceaux, bibliothèque prompteur, etc.). Il a l’impression que Retour est cassé, surtout sur téléphone, entre la prépa et la scène, où chaque geste de trop compte.

## Solution

Dans l’app connectée, Retour (flèche, croix, geste téléphone) rejoue le chemin : Accueil → morceau → Retour = Accueil ; morceau → prompteur → croix = morceau. Changer d’onglet compte comme une étape. S’il n’y a rien derrière dans l’app : Accueil pour un détail ou une session (prompteur…) ; l’objet parent pour un éditeur (paroles → morceau, structure → morceau, Live → structure, EPK → Compte). À l’Accueil tout neuf, le geste téléphone quitte l’app. Une fenêtre ou un panneau ouvert se ferme avant de changer d’écran. Les listes et l’Accueil n’ont pas de flèche ; la flèche dit « Retour », la croix dit « Fermer » ou « Quitter… ». Un éditeur avec du travail en cours demande confirmation, y compris sur le geste téléphone.

## Utilisateur cible

Un membre de groupe qui utilise FaderZero sur téléphone, connecté, au quotidien : Accueil, morceaux, setlists, prompteur. Il enchaîne les écrans vite (prépa d’un set, paroles, parfois scène). Il a une flèche ou une croix sous le pouce, et sur Android un geste Retour ; sur iPhone, souvent le swipe depuis le bord. Il n’administre pas l’app : il veut revenir en arrière sans réfléchir.

## User Stories

US-1. En tant que membre de groupe, je veux que la flèche depuis le détail d’un morceau ouvert à l’Accueil me ramène à l’Accueil, afin de retrouver le raccourci que je viens d’utiliser.

US-2. En tant que membre de groupe, je veux que la flèche depuis un morceau ouvert depuis la liste Morceaux me ramène à cette liste, afin de continuer à parcourir le répertoire.

US-3. En tant que membre de groupe, je veux que la croix du prompteur ouvert depuis le détail d’un morceau me ramène à ce détail, afin de ne pas atterrir dans la bibliothèque prompteur.

US-4. En tant que membre de groupe, je veux que la croix du prompteur ouvert depuis la bibliothèque prompteur me ramène à cette bibliothèque, afin de choisir un autre titre ou une setlist.

US-5. En tant que membre de groupe, je veux qu’un changement d’onglet compte comme une étape précédente, afin que le geste Retour puisse me ramener à l’écran d’avant l’onglet.

US-6. En tant que membre de groupe, je veux qu’Accueil, listes Morceaux et Setlists, métronome et Compte racine n’affichent pas de flèche, afin que la barre du bas reste le moyen de changer de section.

US-7. En tant que membre de groupe, je veux que le geste Retour du téléphone (Android ou swipe iPhone) mène au même écran que la flèche ou la croix, afin de ne pas apprendre deux comportements.

US-8. En tant que membre de groupe, je veux que le geste téléphone à l’Accueil, quand je n’ai visité aucun autre écran de l’app, quitte FaderZero, afin de retrouver le comportement habituel du téléphone.

US-9. En tant que membre de groupe, je veux que la flèche d’un détail morceau, setlist, booking ou d’une session prompteur, sans chemin interne, mène à l’Accueil, afin de rester dans l’app au lieu de sortir vers une autre application.

US-10. En tant que membre de groupe, je veux que Retour depuis les paroles, la structure ou l’EPK, s’il y a un chemin, rejoue ce chemin, afin de ne pas être recalé sur un parent fixe.

US-11. En tant que membre de groupe, je veux que Retour depuis les paroles sans chemin interne mène au morceau, afin de ne pas perdre le morceau en cours d’édition.

US-12. En tant que membre de groupe, je veux que Retour depuis un nouveau brouillon de paroles sans morceau encore créé, sans chemin interne, mène à la liste Morceaux, afin de retrouver le répertoire.

US-13. En tant que membre de groupe, je veux que Retour depuis la structure sans chemin interne mène au morceau, afin de rester dans le morceau.

US-14. En tant que membre de groupe, je veux que la croix du Live, si je l’ai lancé depuis le morceau, me ramène au morceau, afin de ne pas être forcé dans l’éditeur structure.

US-15. En tant que membre de groupe, je veux que la croix du Live sans chemin interne mène à la structure, afin de retomber sur l’éditeur de cet objet.

US-16. En tant que membre de groupe, je veux que Retour depuis l’EPK sans chemin interne mène au Compte, afin de retrouver les paramètres.

US-17. En tant que membre de groupe, je veux que Retour depuis un booking ouvert au calendrier, sans chemin interne, mène au calendrier, afin de retrouver le jour en cours.

US-18. En tant que membre de groupe, je veux que passer au morceau suivant dans le prompteur ne crée pas une étape à rejouer avec la croix, afin que Fermer quitte vraiment le prompteur.

US-19. En tant que membre de groupe, je veux que les sous-pages Compte gardent leur Retour interne actuel, afin de remonter groupe / sécurité / paramètres sans quitter le Compte.

US-20. En tant que membre de groupe, je veux qu’un premier Retour ferme le dialogue, le picker ou le panneau ouvert, afin de ne pas quitter l’écran par accident.

US-21. En tant que membre de groupe, je veux qu’un second Retour, plus rien d’ouvert par-dessus, quitte l’écran selon le chemin, afin de continuer à reculer.

US-22. En tant que membre de groupe, je veux qu’un éditeur paroles ou EPK avec du travail en cours affiche le même dialogue de confirmation sur la flèche et sur le geste téléphone, afin de ne pas perdre le travail.

US-23. En tant que membre de groupe, je veux qu’un brouillon de paroles vide se ferme tout de suite, sans dialogue, afin de ne pas confirmer une page blanche.

US-24. En tant que membre de groupe, je veux qu’après suppression d’un morceau je retrouve l’écran d’où je l’avais ouvert, et qu’un Retour suivant n’ouvre pas ce morceau, afin de ne pas tomber sur une page morte.

US-25. En tant que visiteur, je veux que Retour sur la landing, un EPK public ou une page légale reste le Retour habituel du navigateur, afin de ne pas être envoyé dans l’app connectée.

US-26. En tant que membre de groupe, je veux que la flèche s’appelle « Retour » et que la croix du prompteur s’appelle « Quitter le prompteur » (ou « Fermer »), afin que le lecteur d’écran n’annonce pas une mauvaise destination.

## Critères de succès

1. Depuis l’Accueil, ouvrir un morceau récemment modifié, taper la flèche : l’Accueil s’affiche, pas la liste Morceaux.
2. Depuis le détail d’un morceau, ouvrir le prompteur, taper la croix : le même détail morceau s’affiche, pas la bibliothèque prompteur.
3. Depuis la liste Morceaux, ouvrir un morceau, taper la flèche : la liste Morceaux s’affiche.
4. Dans le prompteur, passer au morceau suivant puis croix : on quitte le prompteur vers l’écran d’où on l’avait ouvert, on ne reste pas dans le prompteur.
5. Flèche/croix et geste téléphone (Android ou swipe) mènent au même écran, sur un même chemin.
6. Dialogue ou panneau ouvert + Retour : seul le dialogue/panneau se ferme ; l’écran en dessous ne change pas. Un second Retour quitte l’écran.
7. Accueil, listes Morceaux/Setlists, métronome, Compte (racine) : aucune flèche Retour.
8. Après suppression d’un morceau ouvert depuis l’Accueil : on est à l’Accueil ; un Retour suivant n’ouvre pas le morceau supprimé.
9. Flèche lue par le lecteur d’écran : « Retour ». Croix prompteur : « Quitter le prompteur » (ou « Fermer »).
10. Sur la landing / un EPK public, Retour ne force pas l’entrée dans l’app connectée.

## Hors périmètre

- Landing, EPK public, pages légales : on n’y impose pas le filet Accueil ni les règles de l’app connectée.
- Pas de flèche Retour sur Accueil, listes, métronome, Compte racine.
- Pas de libellé du type « Retour à l’accueil » / « Retour aux morceaux » selon la page précédente.
- Les sous-pages Compte (groupe, sécurité, sync…) gardent leur Retour interne actuel ; ce n’est pas le même fil que morceau → prompteur.
- Changer de morceau dans le prompteur, ouvrir les réglages du prompteur, changer un filtre d’URL : ça ne crée pas une étape « page précédente » à rejouer avec la croix.
- On ne construit pas une pile séparée par onglet (revenir à l’onglet Morceaux pile où on l’avait laissé, comme sur iPhone natif).
- On ne corrige pas seulement le détail morceau et le prompteur en laissant setlist, booking, Live, etc. en parent fixe.
- On n’ajoute pas de nouveau bandeau, fil d’Ariane, ou bouton Accueil à côté de la flèche.
- On ne change pas le contenu des écrans (prompteur, paroles, structure), seulement où Retour/Fermer emmène.
- On ne retire pas les dialogues « quitter sans enregistrer » (paroles, EPK).
- Le geste téléphone à l’Accueil tout neuf peut quitter l’app : on n’essaie pas de bloquer la sortie du téléphone.

## Décisions d’implémentation

- Flèche, croix et geste téléphone rejouent le chemin réel, pas la page parent de la section.
- Un changement d’onglet est une étape du chemin, comme un lien.
- Sans chemin interne : Accueil pour détail morceau, détail setlist, détail booking, session prompteur ; morceau pour paroles et structure ; liste Morceaux pour un nouveau brouillon de paroles sans morceau créé ; structure pour le Live ; Compte pour l’EPK ; calendrier pour un booking ouvert depuis le calendrier.
- Seul un changement d’écran crée une étape. Un changement de morceau dans le prompteur, un panneau de réglages, une sous-page Compte n’en crée pas.
- Une action qui quitte un écran (supprimer un morceau, etc.) retire cet écran du chemin : on retombe sur le vrai précédent, sans pouvoir y revenir.
- Pas de flèche sur les racines d’onglet. Flèche et croix seulement sur détails, éditeurs et sessions (prompteur, Live).
- Libellé flèche : « Retour ». Libellé croix d’overlay : « Fermer » ou « Quitter le prompteur » / « Quitter le mode Live ».
- Tant qu’un dialogue, picker ou panneau est ouvert, Retour le ferme ; l’écran ne change qu’au Retour suivant.
- Les dialogues de sortie des éditeurs paroles et EPK s’appliquent aussi au geste téléphone. Un brouillon de paroles vide sort tout de suite.
- Ces règles s’appliquent à l’app connectée seulement.

## Notes complémentaires

- Sur iPhone, sans bouton système visible, le swipe depuis le bord est le seul Retour depuis l’Accueil ou une liste ; certains utilisateurs ne le connaissent pas.
- Si quelqu’un enchaîne beaucoup d’onglets, Retour rejoue toute la chaîne (c’est voulu).
- Un lien ouvert depuis une autre app, sans chemin dans FaderZero, ramène à l’Accueil, pas vers cette autre app (sauf le geste de sortie une fois déjà à l’Accueil).
