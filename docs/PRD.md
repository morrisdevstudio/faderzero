# Parcours d’inscription et de création de groupe

## Problème

Une personne qui rejoint FaderZero doit aujourd’hui passer par plusieurs endroits pour commencer : création du compte, modification du pseudo et de la pastille dans le profil, puis création du groupe dans les paramètres. Après la création, elle reste sur le même écran sans indication claire de la suite. Le branchement du stockage et l’invitation des membres arrivent tard ou sont faciles à manquer.

Les écrans Google montrent parfois une adresse technique à la place du nom FaderZero. Cette présentation rend le parcours moins cohérent au moment où la personne confie son compte ou son espace de stockage à l’application.

## Solution

Après sa première inscription, la personne choisit son pseudo et peut ajouter une photo à sa pastille. Elle choisit ensuite de créer immédiatement un morceau dans son espace personnel ou de créer un groupe.

La création d’un groupe suit un tunnel continu : donner un nom, connecter Google Drive ou ignorer le stockage, inviter des membres ou passer cette étape, puis choisir une première action. Chaque écran explique ce qui vient d’être fait et ce qu’il reste à faire. Après la connexion à Google Drive, la personne revient à l’étape suivante du tunnel.

Sans stockage connecté, le groupe peut utiliser le texte et les liens. L’application prévient clairement que les fichiers, notamment les audios, photos et documents, ne pourront pas être ajoutés avant la connexion d’un stockage. L’EPK peut être préparé en texte et liens, mais l’ajout de fichiers et sa publication attendent cette connexion.

## Utilisateur cible

Une personne qui découvre FaderZero, seule ou comme responsable d’un groupe musical, et souhaite commencer à écrire ou à organiser son groupe depuis son téléphone sans devoir chercher les réglages nécessaires.

Le parcours concerne aussi un membre déjà inscrit qui crée un nouveau groupe. Les personnes qui se reconnectent à un compte existant retrouvent directement leur espace habituel.

## User Stories

US-1. En tant que nouvelle personne inscrite avec Google, je veux choisir mon pseudo après la connexion, afin de commencer avec l’identité que je souhaite afficher.

US-2. En tant que nouvelle personne inscrite par e-mail, je veux retrouver le même parcours après confirmation de mon adresse, afin de commencer de la même manière.

US-3. En tant que nouvelle personne inscrite, je veux pouvoir ajouter une photo à ma pastille ou garder les initiales proposées, afin de personnaliser mon profil sans étape obligatoire supplémentaire.

US-4. En tant que nouvelle personne inscrite, je veux choisir entre créer un morceau et créer un groupe, afin d’arriver directement à mon premier objectif.

US-5. En tant que personne qui choisit un morceau, je veux arriver sur sa page de création dans mon espace personnel, afin de commencer à écrire immédiatement.

US-6. En tant que personne qui crée un groupe, je veux renseigner son nom dans un parcours guidé, afin de ne pas devoir passer par les paramètres.

US-7. En tant que personne qui crée un groupe, je veux connecter Google Drive ou ignorer cette étape, afin de choisir quand préparer le stockage.

US-8. En tant que personne qui ignore le stockage, je veux voir avant de confirmer que les fichiers seront indisponibles, afin de savoir ce que mon groupe pourra faire.

US-9. En tant que membre d’un groupe sans stockage, je veux pouvoir utiliser le texte et les liens, afin de travailler sans attendre.

US-10. En tant que membre d’un groupe sans stockage, je veux voir une explication lorsque j’essaie d’ajouter un fichier, afin de savoir qu’un administrateur doit connecter un stockage.

US-11. En tant que personne qui connecte Google Drive, je veux revenir au tunnel après l’autorisation Google, afin de terminer la création du groupe.

US-12. En tant que personne qui crée un groupe, je veux obtenir un lien d’invitation à copier ou partager et pouvoir ignorer cette étape, afin d’inviter les autres au moment qui me convient.

US-13. En tant que personne qui termine la création du groupe, je veux pouvoir créer un morceau, préparer un EPK, inviter des membres ou explorer le groupe, afin de choisir une première action concrète.

US-14. En tant que personne qui interrompt le tunnel, je veux reprendre à l’étape atteinte, afin de ne pas recommencer après un rechargement ou un retour de Google.

US-15. En tant que personne qui arrive avec une invitation, je veux rejoindre le groupe reçu avant toute proposition de création, afin de ne pas suivre le mauvais parcours.

US-16. En tant que personne déjà inscrite, je veux accéder directement à mon espace lors d’une connexion habituelle, afin de ne pas refaire l’accueil initial.

US-17. En tant que personne déjà inscrite qui crée un autre groupe, je veux retrouver le tunnel de création, afin de préparer ce groupe de la même manière.

US-18. En tant que personne qui autorise FaderZero avec Google, je veux voir le nom FaderZero présenté comme celui de l’application, afin de reconnaître le service auquel je donne accès.

## Critères de succès

1. Après une première connexion Google ou une première connexion suivant la confirmation de l’e-mail, l’écran du pseudo apparaît avant le choix « morceau ou groupe ».
2. Depuis ce choix, « Créer un morceau » ouvre directement la création d’un morceau dans l’espace personnel.
3. Après la saisie du nom d’un groupe, l’écran de stockage apparaît ; après sa validation ou son passage, l’écran d’invitation apparaît.
4. L’écran de stockage montre Google Drive, « Ignorer » et « FaderZero Cloud — à venir », cette dernière option étant indisponible.
5. Avant de passer le stockage, un avertissement énumère les audios, photos et documents indisponibles. Une tentative d’ajout de fichier dans ce groupe est ensuite bloquée avec une explication.
6. Un groupe sans stockage permet de créer du contenu textuel et des liens, y compris un brouillon d’EPK. Il ne permet ni d’y ajouter un fichier ni de publier cet EPK.
7. Après l’autorisation Google Drive, réussie ou annulée, la personne retrouve le tunnel avec un résultat explicite et peut continuer ou réessayer.
8. L’étape d’invitation affiche un lien utilisable et offre les actions copier, partager et ignorer.
9. Le dernier écran affiche « Créer un morceau », « Créer un EPK », « Inviter des membres » et « Explorer le groupe » ; chaque action ouvre sa destination.
10. Un rechargement reprend le tunnel sans recréer le groupe ni refaire une étape enregistrée.
11. Une invitation reçue et une connexion habituelle conservent leurs parcours respectifs.
12. Les écrans restent utilisables sur un téléphone de 320 px de large.
13. Les deux écrans d’autorisation Google présentent FaderZero comme nom de l’application après validation de la marque.

## Hors périmètre

- Rendre Google Drive obligatoire pour créer un groupe.
- Activer FaderZero Cloud pour les nouveaux groupes.
- Modifier le parcours habituel des connexions à un compte existant.
- Obliger les membres invités à connecter leur propre compte Google.
- Transférer les fichiers des groupes existants ou modifier leur stockage actuel.
- Ajouter d’autres fournisseurs de stockage dans ce parcours.
- Supprimer toutes les adresses techniques des détails affichés par Google dès cette première version.
- Refaire les fonctions de création de morceau et d’édition d’EPK au-delà des accès et restrictions nécessaires au tunnel.

## Décisions d’implémentation

- Le pseudo est obligatoire et contient de 2 à 30 caractères ; la photo est facultative et les initiales restent proposées par défaut.
- Le choix « Créer un morceau » quitte le tunnel et utilise l’espace personnel.
- « Ignorer » laisse le groupe utilisable sans fichiers ; l’administrateur pourra connecter Google Drive plus tard.
- L’étape d’invitation peut être passée ; le dernier écran conserve une action pour inviter.
- Le tunnel s’affiche après une première inscription et lors de la création de chaque nouveau groupe, jamais à chaque connexion.
- En cas d’annulation ou d’échec de la connexion Google Drive, le groupe créé est conservé et l’étape indique comment réessayer ou continuer sans stockage.
- Le nom FaderZero est recherché sur les écrans Google ; une adresse technique peut encore apparaître dans leurs détails.

## Notes complémentaires

L’affichage du nom FaderZero dépend de la validation de sa marque par Google. Les groupes existants et leurs fichiers doivent continuer à fonctionner pendant l’arrivée du nouveau parcours.
