# FaderZero — Compte, espaces et page d’accueil

> Document produit vivant destiné à l’agent de développement. À mettre à jour à mesure que les décisions UX évoluent.

## 1. Principes validés

- Un compte représente une personne.
- Chaque compte possède automatiquement un espace personnel privé nommé **« Mon espace »**.
- Un utilisateur peut également créer ou rejoindre plusieurs espaces de groupe.
- Un contenu appartient toujours à un seul espace.
- L’application s’ouvre toujours sur **Mon espace**, qui constitue la véritable page d’accueil globale.

## 2. Espace personnel

### Profil du compte

Le compte utilisateur contient uniquement :

- un **pseudo** ;
- une **adresse e-mail** ;
- un **mot de passe** ;
- une **photo de profil facultative**.

Il n’existe pas de champs séparés pour le prénom et le nom. Le pseudo constitue le nom affiché dans l’application et dans les listes de membres. Le mot de passe est géré de manière sécurisée par le système d’authentification et n’est jamais visible dans l’application.

- L’adresse e-mail constitue l’identifiant unique du compte dans l’application et sert à la connexion.
- Deux comptes ne peuvent pas utiliser la même adresse e-mail.
- Le pseudo est uniquement un nom d’affichage et n’a pas besoin d’être unique.
- Plusieurs utilisateurs peuvent donc avoir le même pseudo ; leur identité technique reste déterminée par l’identifiant interne associé à leur adresse e-mail.

Si aucune photo n’est fournie, l’application génère un avatar coloré affichant en majuscules les **deux premières lettres du pseudo**.

### Modification du profil

- L’utilisateur peut modifier son pseudo à tout moment depuis les paramètres de son compte.
- Il peut ajouter, remplacer ou supprimer sa photo de profil à tout moment.
- Après la suppression d’une photo, l’avatar généré avec les deux premières lettres du pseudo est rétabli.
- Les changements de pseudo et de photo s’appliquent au profil global et sont donc visibles dans tous les groupes auxquels l’utilisateur appartient.
- Ces modifications ne changent ni son adresse e-mail, ni son identité technique, ni ses appartenances et rôles.

### Photo de profil

- Formats acceptés à l’import : **JPG, PNG et WebP**.
- Taille maximale du fichier source : **5 Mo**.
- L’utilisateur peut recadrer l’image au format carré avant validation.
- Après validation, l’application redimensionne et compresse automatiquement l’image dans un format adapté à l’affichage d’un avatar.
- La version finale est enregistrée au format **WebP en 512 × 512 pixels**, avec une compression préservant une qualité visuelle adaptée à un avatar.
- Le recadrage, le redimensionnement et la compression sont effectués sur l’appareil de l’utilisateur avant l’envoi.
- Seule la version WebP optimisée est envoyée au serveur ; le fichier source original ne quitte pas l’appareil.
- Le fichier original lourd n’est pas conservé si la version optimisée a été générée avec succès.
- Le format et la taille doivent être contrôlés côté serveur, et pas uniquement dans l’interface.
- Lors du remplacement d’une photo, l’ancienne version est supprimée après l’enregistrement réussi de la nouvelle.

### Modification de l’adresse e-mail

- L’utilisateur peut demander à modifier son adresse e-mail depuis les paramètres du compte.
- Le changement est traité comme une opération de sécurité sensible.
- L’utilisateur doit être authentifié pour lancer la demande.
- Une confirmation est envoyée à l’ancienne adresse et à la nouvelle adresse.
- La nouvelle adresse ne devient l’identifiant de connexion qu’après validation des deux confirmations.
- Tant que le parcours n’est pas terminé, l’ancienne adresse reste active et la nouvelle reste en attente.
- La nouvelle adresse doit être disponible et ne correspondre à aucun autre compte.
- Une notification de sécurité confirme le changement une fois celui-ci terminé.
- Le changement d’adresse ne modifie pas l’identifiant interne du compte, Mon espace, les contenus, les appartenances ou les rôles.
- Les liens envoyés à l’ancienne et à la nouvelle adresse expirent après **1 heure**.
- Si l’une des deux confirmations n’est pas effectuée dans ce délai, l’adresse n’est pas modifiée et l’utilisateur doit recommencer la procédure.

Ce parcours s’appuie sur le changement d’e-mail sécurisé de Supabase Auth. Il évite qu’une personne ayant momentanément accès à une session remplace silencieusement l’adresse du compte.

### Modification du mot de passe

- Depuis les paramètres du compte, l’utilisateur doit saisir son mot de passe actuel.
- Il saisit ensuite le nouveau mot de passe et le confirme une seconde fois.
- Le changement est refusé si le mot de passe actuel est incorrect ou si les deux saisies du nouveau mot de passe diffèrent.
- Après une modification réussie, un e-mail de sécurité informe l’utilisateur que son mot de passe a été changé.
- Après le changement, toutes les sessions actives du compte sont révoquées sur tous les appareils, y compris l’appareil courant.
- L’utilisateur est redirigé vers l’écran de connexion et doit se reconnecter avec son nouveau mot de passe.
- Le mot de passe actuel et le nouveau mot de passe ne sont jamais enregistrés dans le profil applicatif.

### Mot de passe oublié

1. L’utilisateur choisit **« Mot de passe oublié »** sur l’écran de connexion.
2. Il saisit l’adresse e-mail de son compte.
3. L’application affiche un message neutre indiquant qu’un e-mail sera envoyé si un compte correspond à cette adresse.
4. L’utilisateur reçoit un lien de réinitialisation à usage unique, valable pendant **1 heure**.
5. Le lien ouvre un écran permettant de saisir et confirmer un nouveau mot de passe.
6. Une fois utilisé, expiré ou remplacé par une nouvelle demande, le lien ne peut plus servir.
7. Après la réinitialisation, un e-mail de sécurité confirme le changement du mot de passe.
8. Toutes les sessions actives sont révoquées sur tous les appareils.
9. L’utilisateur doit se reconnecter avec son nouveau mot de passe.

La révocation globale doit être effectuée côté serveur ; elle ne doit pas se limiter à supprimer la session stockée sur l’appareil utilisé.

L’application ne propose pas de page « Appareils connectés » ni de gestion manuelle des sessions individuelles.

### Confidentialité de l’adresse e-mail

- L’adresse e-mail est visible uniquement par le propriétaire du compte dans ses paramètres personnels.
- Elle n’est jamais affichée aux autres utilisateurs du groupe, y compris aux administrateurs.
- Les listes de membres affichent uniquement le pseudo, la photo ou l’avatar et le rôle.
- Les règles d’accès aux profils doivent empêcher la lecture de l’adresse e-mail d’un autre utilisateur.
- Le fait que l’e-mail soit l’identifiant unique ne modifie pas sa confidentialité.

### Création et accès

- Créé automatiquement lors de la création du compte.
- Accessible immédiatement après l’inscription ou la connexion.
- Nom fixe : **« Mon espace »**.
- Le nom ne peut pas être modifié.
- L’espace personnel possède un seul membre : le propriétaire du compte.
- Il est strictement privé : aucune invitation, aucun partage et aucun membre supplémentaire.

### Formulaire d’inscription

Le formulaire demande :

- un **pseudo obligatoire** ;
- une **adresse e-mail obligatoire** et unique ;
- un **mot de passe obligatoire** ;
- la **confirmation du mot de passe** ;
- une **photo de profil facultative**.

- Le pseudo peut être modifié plus tard depuis les paramètres du compte.
- Le pseudo doit contenir entre **2 et 30 caractères**.
- Les espaces, accents et caractères spéciaux sont autorisés dans le pseudo.
- Les espaces placés uniquement au début ou à la fin sont supprimés avant l’enregistrement.
- La photo peut être ajoutée, remplacée ou supprimée plus tard.
- Si aucune photo n’est fournie, l’avatar avec les deux premières lettres du pseudo est utilisé.
- Le compte et Mon espace sont créés après validation du formulaire.
- L’utilisateur doit confirmer son adresse e-mail avant que son compte soit considéré comme actif.

### Règles du mot de passe

- Minimum **8 caractères**.
- Au moins **une lettre majuscule**.
- Au moins **une lettre minuscule**.
- Au moins **un chiffre**.
- Un caractère spécial est autorisé mais n’est pas obligatoire.
- Les règles sont affichées près du champ et validées visuellement à mesure de la saisie.
- La confirmation doit correspondre exactement au mot de passe.
- Les mêmes règles s’appliquent à l’inscription, au changement de mot de passe et à sa réinitialisation.

### Fonctionnalités

L’espace personnel propose les mêmes fonctionnalités métier qu’un groupe, notamment les chansons, audios, notes, réglages, setlists et événements.

## 3. Espaces de groupe

- Un compte peut appartenir à plusieurs groupes.
- Un utilisateur peut créer un nombre illimité de groupes.
- Il n’existe pas de quota de groupes créés ou rejoints dans la version actuelle.
- Dans le sélecteur d’espace, afficher d’abord **Mon espace**, puis les groupes de l’utilisateur.

### Évolution commerciale possible

- Pendant la bêta, il n’existe aucun compte ni abonnement payant.
- Chaque groupe dispose d’un quota de stockage audio de **5 Go**.
- Le quota de groupe est mesuré sur la taille réelle des fichiers stockés, contrairement au quota personnel fondé sur la durée.
- À titre indicatif, 5 Go représentent environ 35 heures de MP3 à 320 kb/s, 58 heures à 192 kb/s ou 87 heures à 128 kb/s.
- Lorsque le quota est atteint, les contenus existants restent accessibles mais aucun nouvel audio dépassant la limite ne peut être ajouté.
- La taille d’un audio est retirée du quota du groupe immédiatement lorsqu’il est placé dans la corbeille.
- Restaurer un audio réintègre sa taille dans le quota.
- La restauration est bloquée si elle ferait dépasser 5 Go ; l’interface indique alors l’espace à libérer.
- Ces règles sont identiques au comportement du quota de Mon espace, à l’exception de l’unité : taille réelle en groupe, durée cumulée dans Mon espace.
- L’espace utilisé, l’espace restant et la limite de 5 Go sont visibles par les administrateurs et les membres.
- Les invités ne voient aucune information relative au quota ou au stockage du groupe.
- À partir de **80 % du quota**, une alerte de stockage est affichée aux administrateurs et aux membres.
- L’alerte indique l’espace utilisé, l’espace restant et invite à supprimer les audios inutiles.
- Elle reste visible tant que l’utilisation ne redescend pas sous 80 %.
- Les invités ne voient pas cette alerte.

### Import et conversion des audios

- L’application accepte au minimum les fichiers source MP3, WAV, M4A et FLAC.
- Tous les fichiers importés sont préparés localement avant l’envoi, y compris ceux qui sont déjà au format MP3.
- Le fichier final est uniformisé en MP3 avec un débit de **192 kb/s**.
- Un MP3 source encodé en 320 kb/s est donc recompressé localement en 192 kb/s.
- Seule la version MP3 convertie est téléversée et stockée sur le serveur.
- Le nom du fichier source est conservé comme nom d’affichage de l’audio après conversion.
- Le changement de format ou de nom technique côté stockage ne doit pas modifier ce nom visible.
- Le nom d’affichage peut ensuite être modifié dans FaderZero sans renommer ni déplacer le fichier technique stocké.
- Le nom d’affichage est obligatoire et limité à **100 caractères**.
- Les espaces, accents et caractères spéciaux sont autorisés ; les espaces superflus au début et à la fin sont supprimés.
- Deux audios ne peuvent pas avoir le même nom d’affichage dans un même espace.
- L’unicité est vérifiée sans tenir compte des majuscules et minuscules ni des espaces superflus.
- Lors d’un import ou d’une copie en conflit, utiliser automatiquement **« Nom (copie) »**, puis **« Nom (copie 2) »**, etc.
- Le même nom reste autorisé dans deux espaces différents.
- Dans un groupe, un administrateur ou un membre peut renommer un audio ; un invité ne le peut pas.
- Dans Mon espace, le propriétaire peut renommer ses audios.
- Le fichier source original ne quitte pas l’appareil et n’est pas conservé par FaderZero.
- Si la conversion locale échoue, aucun fichier incomplet n’est envoyé et l’utilisateur peut réessayer.
- Cette conversion locale existe déjà dans l’application et doit être conservée lors du développement des nouveaux espaces et quotas.
- À ce débit, une heure d’audio représente environ 86 Mo ; le quota de 5 Go correspond à environ 58 heures.
- Si FaderZero devient payant, la facturation sera pensée **par groupe**, et non par compte utilisateur.
- **Mon espace reste gratuit** et distinct d’un groupe facturable.
- Mon espace gratuit dispose d’un quota maximal de **1 heure d’audio au total**.
- Les audios de Mon espace sont comptabilisés au format MP3.
- Le quota porte sur la durée cumulée des audios personnels, et non sur le nombre de fichiers.
- Lorsque le quota est atteint, l’utilisateur peut toujours consulter et écouter ses contenus existants, mais ne peut plus ajouter d’audio dépassant la limite.
- La durée d’un audio est retirée du quota immédiatement lorsqu’il est placé dans la corbeille.
- Il n’est pas nécessaire d’attendre sa suppression définitive après 7 jours pour récupérer cet espace.
- La restauration d’un audio réintègre sa durée dans le quota.
- Si la restauration ferait dépasser la limite d’une heure, elle est bloquée.
- L’interface indique la durée à libérer et invite l’utilisateur à supprimer ou mettre en corbeille d’autres audios avant de réessayer.
- À partir de **48 minutes utilisées**, soit 80 % du quota, une alerte est affichée dans Mon espace.
- Elle indique la durée utilisée et restante et reste visible jusqu’à ce que l’utilisation redescende sous 48 minutes.
- Les tarifs, abonnements, limites et conséquences d’un impayé ne sont pas encore définis.
- Le modèle de données doit permettre d’associer ultérieurement un abonnement à un groupe sans modifier les appartenances des utilisateurs.

### Création d’un groupe

- Le formulaire demande uniquement le **nom du groupe**, obligatoire.
- Le nom doit contenir entre **2 et 30 caractères**.
- Les espaces, accents et caractères spéciaux sont autorisés ; les espaces placés uniquement au début ou à la fin sont supprimés.
- Le nom du groupe doit être unique dans toute l’application.
- L’unicité est vérifiée sans tenir compte des majuscules et minuscules ni des espaces superflus en début et fin.
- Si le nom est déjà utilisé, l’application indique simplement que ce nom n’est pas disponible, sans révéler d’informations sur l’autre groupe.
- L’utilisateur peut ajouter un **logo**, facultatif.
- Si aucun logo n’est fourni, l’application génère automatiquement un avatar coloré affichant les initiales du groupe.
- Cet avatar reste utilisé jusqu’à ce qu’un administrateur ajoute un logo.
- Aucun autre renseignement n’est exigé lors de la création.
- Après validation, le groupe est créé et son créateur reçoit automatiquement le rôle administrateur.
- Après la création réussie, l’application bascule automatiquement dans le nouveau groupe et ouvre sa page d’accueil.
- Dès l’arrivée dans le nouveau groupe, une fenêtre s’ouvre et propose d’inviter un premier membre.
- Cette fenêtre constitue la première étape d’accompagnement après la création du groupe.
- L’invitation utilise le parcours par lien générique, à usage unique et valable 24 heures.
- L’administrateur choisit le rôle accordé par le lien : administrateur, membre ou invité.
- La fenêtre propose également l’action **« Plus tard »**.
- Choisir Plus tard ferme la fenêtre sans générer de lien et permet d’utiliser immédiatement le groupe.
- Cette fenêtre n’apparaît qu’une seule fois, immédiatement après la création du groupe.
- Elle ne réapparaît pas aux ouvertures suivantes, que l’utilisateur ait créé une invitation ou choisi Plus tard.
- Après cette étape, la création et la gestion des invitations sont accessibles uniquement depuis l’espace d’administration du groupe.
- Le logo pourra être ajouté ou remplacé plus tard par un administrateur.

### Logo du groupe

- Seuls les administrateurs peuvent ajouter, remplacer ou supprimer le logo du groupe.
- Les membres et les invités peuvent le voir mais ne peuvent pas le modifier.
- Le logo suit les mêmes règles que la photo de profil.
- Formats source acceptés : JPG, PNG et WebP, avec une taille maximale de 5 Mo.
- L’image est recadrée au format carré.
- Le recadrage, le redimensionnement et la compression sont effectués sur l’appareil de l’utilisateur.
- Seule une version WebP optimisée de 512 × 512 pixels est envoyée au serveur.
- Le fichier source original n’est pas envoyé ni conservé.
- Le serveur vérifie malgré tout le format et les dimensions du fichier reçu.

### Modification du nom du groupe

- Seuls les administrateurs peuvent modifier le nom du groupe.
- Le nouveau nom doit respecter la limite de 2 à 30 caractères.
- Le nouveau nom doit également être disponible dans toute l’application.
- Les membres et les invités peuvent voir le nom mais ne peuvent pas le modifier.
- Le changement est immédiatement visible pour tous les utilisateurs du groupe et dans leur page d’accueil personnelle.

### Rôle administrateur

- Le créateur d’un groupe devient automatiquement administrateur de ce groupe.
- Un administrateur possède un accès en lecture et en écriture à tous les éléments du groupe.
- Il peut inviter de nouveaux membres.
- Il peut modifier le rôle des autres utilisateurs du groupe.
- Les rôles qu’il peut attribuer sont **administrateur**, **membre** et **invité**.
- Il peut retirer du groupe un administrateur, un membre ou un invité.
- Il peut supprimer le groupe, même s’il n’en est pas le créateur.

### Rôle membre

- Un membre peut consulter les contenus et les événements du groupe.
- Il peut créer, modifier et supprimer les contenus artistiques du groupe.
- Il peut créer, modifier et supprimer les événements du groupe.
- Ces droits s’appliquent à tous les contenus et événements du groupe, quel que soit leur créateur.
- Il ne peut pas inviter d’utilisateur ni gérer les rôles.

### Rôle invité

- Un invité dispose d’un accès strictement en lecture seule.
- Il peut consulter les éléments artistiques du groupe.
- Il peut consulter les dates et événements du groupe.
- Il peut écouter les fichiers audio et les mettre en cache sur son appareil pour une écoute hors connexion.
- La mise en cache ne lui accorde aucun droit de modification sur le fichier ou ses métadonnées.
- Il ne peut créer, modifier ou supprimer aucun contenu ni événement.
- Il ne peut pas inviter d’utilisateur ni gérer les rôles.

### Portée des rôles

Le rôle et les permissions sont propres à chaque groupe : un même utilisateur peut être administrateur dans un groupe, membre dans un autre et invité dans un troisième.

### Propriété des contenus

- Les contenus et événements créés dans un groupe appartiennent au groupe, et non à leur auteur.
- Un administrateur ou un membre peut donc modifier ou supprimer un élément créé par un autre utilisateur.
- Le départ ou le retrait de l’auteur ne supprime pas ses contributions du groupe.

### Administration minimale obligatoire

- Un groupe doit toujours compter au moins un administrateur.
- Le dernier administrateur ne peut pas être retiré du groupe.
- Le dernier administrateur ne peut pas être rétrogradé au rôle de membre ou d’invité.
- Le dernier administrateur ne peut pas quitter le groupe tant qu’il n’a pas nommé un autre administrateur.
- L’interface doit expliquer le blocage et proposer de promouvoir un autre utilisateur.

### Suppression et corbeille du groupe

- N’importe quel administrateur peut placer le groupe dans la corbeille.
- Cette action ne supprime pas immédiatement et définitivement les données.
- Le groupe et l’ensemble de ses contenus sont conservés pendant **7 jours**.
- Le nom unique du groupe reste réservé pendant ces 7 jours et ne peut pas être utilisé par un autre groupe.
- Pendant cette période, le groupe peut être restauré.
- Tous les administrateurs du groupe peuvent le restaurer pendant cette période.
- La restauration réactive le groupe avec ses membres, leurs rôles et l’ensemble de ses contenus.
- À la fin du septième jour, le groupe et ses données sont supprimés définitivement.
- Après cette suppression définitive, le nom redevient disponible.
- Aucun administrateur ne peut déclencher une suppression définitive avant la fin des 7 jours.

### Corbeille des contenus

- Une chanson, un audio ou un événement supprimé individuellement est placé dans la corbeille de son espace au lieu d’être supprimé immédiatement.
- Un élément placé dans la corbeille disparaît des listes, recherches, nouveautés et calendriers actifs.
- Sa restauration doit rétablir ses données et ses relations encore valides.
- Il est conservé pendant **7 jours**, puis supprimé définitivement et automatiquement.
- Aucune suppression définitive anticipée n’est possible pendant cette période.
- Un administrateur ou un membre peut restaurer un élément pendant ces 7 jours.
- Un invité ne peut ni accéder aux actions de la corbeille ni restaurer un élément.
- Dans Mon espace, le propriétaire peut restaurer ses propres éléments.
- Juste après la suppression, l’interface affiche pendant **5 secondes** un message temporaire avec l’action **« Annuler »**.
- L’action Annuler restaure immédiatement l’élément à son emplacement précédent, sans obliger l’utilisateur à ouvrir la corbeille.
- Après la disparition du message, l’élément reste restaurable depuis la corbeille pendant le reste des 7 jours.
- Le groupe placé dans la corbeille ne doit plus apparaître comme un groupe actif dans la page d’accueil ou le sélecteur d’espace.
- Une confirmation explicite est nécessaire avant la mise en corbeille.

### Invitations

- Seul un administrateur peut générer une invitation.
- L’invitation prend la forme d’un lien générique partageable ; elle n’est pas liée à une adresse e-mail précise.
- Lors de la génération du lien, l’administrateur choisit le rôle accordé : **administrateur**, **membre** ou **invité**.
- Le rôle choisi est enregistré avec l’invitation et attribué automatiquement à l’utilisateur qui l’utilise.
- Le lien expire automatiquement 24 heures après sa création.
- Le lien est à usage unique.
- Dès qu’un utilisateur rejoint le groupe avec ce lien, celui-ci est immédiatement invalidé et ne peut pas être réutilisé.
- Une fois expiré, il ne permet plus de rejoindre le groupe.
- L’interface doit afficher clairement sa date ou son temps restant de validité.
- Un administrateur peut révoquer manuellement un lien encore valide.
- La révocation est immédiate et définitive : le lien ne peut plus être utilisé ni réactivé.
- Un administrateur peut générer un nouveau lien lorsque le précédent a expiré.
- L’espace d’administration affiche uniquement les invitations actives, c’est-à-dire non utilisées, non expirées et non révoquées.
- Une invitation disparaît automatiquement de cette liste dès qu’elle est utilisée, expire ou est révoquée.
- Aucun historique des invitations inactives n’est affiché à l’utilisateur.
- Un groupe peut posséder plusieurs liens d’invitation actifs simultanément.
- Plusieurs liens peuvent attribuer le même rôle, par exemple plusieurs invitations membre ou plusieurs invitations invité.
- Chaque lien conserve son propre rôle, sa propre expiration de 24 heures et son propre état d’utilisation.
- L’utilisation d’un lien n’invalide pas les autres liens actifs.
- Un groupe peut avoir au maximum **5 liens actifs par rôle** : 5 administrateur, 5 membre et 5 invité.
- Le maximum global est donc de 15 liens actifs simultanément par groupe.
- Un lien utilisé, expiré ou révoqué libère immédiatement une place pour son rôle.
- Lorsque la limite d’un rôle est atteinte, l’interface empêche la création d’un nouveau lien pour ce rôle et explique qu’il faut attendre, utiliser ou révoquer une invitation existante.

#### Affichage d’une invitation active

Chaque invitation active affiche :

- le rôle attribué par le lien ;
- le temps restant avant son expiration ;
- un bouton **« Copier le lien »** ;
- un bouton **« Révoquer »**.

Après la copie, une confirmation visuelle courte indique que le lien a été copié. La révocation demande une confirmation avant de désactiver définitivement le lien.

#### Parcours sans compte

1. La personne ouvre le lien d’invitation.
2. Si elle ne possède pas de compte ou n’est pas connectée, l’application lui demande de créer un compte ou de se connecter.
3. L’application conserve le contexte de l’invitation pendant cette étape.
4. Après l’inscription, la personne doit confirmer son adresse e-mail.
5. Le compte n’est considéré comme actif qu’après cette confirmation.
6. Une fois l’adresse confirmée et l’authentification terminée, la personne rejoint automatiquement le groupe.
7. Le rôle enregistré dans l’invitation lui est attribué.
8. Le lien est consommé uniquement lorsque l’adhésion au groupe a réussi.
9. L’utilisateur est ensuite dirigé vers le groupe rejoint.

Le lien doit toujours être valide au moment où l’adhésion est finalisée. S’il expire pendant la création du compte ou l’attente de confirmation de l’adresse e-mail, l’utilisateur ne rejoint pas le groupe et doit demander un nouveau lien à un administrateur.

| Action | Administrateur | Membre | Invité |
|---|:---:|:---:|:---:|
| Consulter les contenus artistiques | Oui | Oui | Oui |
| Créer, modifier et supprimer des contenus | Oui | Oui | Non |
| Consulter les événements | Oui | Oui | Oui |
| Créer, modifier et supprimer des événements | Oui | Oui | Non |
| Écouter et mettre en cache les audios | Oui | Oui | Oui |
| Inviter des utilisateurs | Oui | Non | Non |
| Modifier les rôles | Oui | Non | Non |
| Retirer un utilisateur du groupe | Oui | Non | Non |
| Supprimer le groupe | Oui | Non | Non |
| Restaurer un contenu ou un événement | Oui | Oui | Non |
| Modifier ou supprimer le logo du groupe | Oui | Non | Non |
| Modifier le nom du groupe | Oui | Non | Non |
| Consulter l’utilisation du stockage | Oui | Oui | Non |

### Liste des utilisateurs dans l’espace admin

- Afficher tous les utilisateurs du groupe dans une seule liste.
- Ne pas créer de sections séparées pour les administrateurs, membres et invités.
- Afficher le rôle en petit à côté du nom de chaque utilisateur.
- Regrouper l’ordre de la liste par rôle : administrateurs, puis membres, puis invités.
- Dans chaque rôle, trier les utilisateurs par ordre alphabétique de leur nom affiché.
- Le regroupement reste léger et ne transforme pas la liste en trois panneaux séparés.
- Afficher la photo de profil de chaque utilisateur à côté de son nom.
- En l’absence de photo, générer un avatar coloré avec les deux premières lettres du pseudo en majuscules.
- Les actions autorisées, comme modifier le rôle ou retirer l’utilisateur, sont accessibles depuis sa ligne.

## 4. Copie de contenus entre espaces

### Depuis Mon espace vers un groupe

- L’utilisateur peut copier un morceau personnel vers un groupe dans lequel il est administrateur ou membre.
- Un invité ne peut pas copier de contenu vers le groupe.
- L’original reste dans Mon espace.

### Depuis un groupe vers Mon espace

- Seul un administrateur du groupe peut copier un morceau du groupe vers son espace personnel.

### Droits sur l’espace de destination

- Un administrateur ou un membre peut créer du contenu dans son groupe, y compris en copiant des éléments provenant d’un autre espace.
- Un invité reste strictement en lecture seule et ne peut jamais être la personne à l’origine d’une copie vers le groupe.
- Les droits de lecture dans l’espace source restent vérifiés séparément des droits d’écriture dans l’espace de destination.
- La copie depuis un groupe vers un autre espace reste soumise à la règle de la source : seul un administrateur du groupe source peut en sortir une copie.

### Historique des copies du groupe

- L’espace d’administration du groupe contient une section **« Historique des copies »**.
- Elle répertorie les contenus copiés vers le groupe et depuis le groupe.
- Chaque entrée conserve au minimum la date et l’heure, l’utilisateur ayant lancé l’opération, le contenu concerné, l’espace source et l’espace de destination.
- Pour une chanson, l’historique indique également les audios sélectionnés lors de la copie.
- Une copie annulée ou échouée n’apparaît pas comme une copie réussie.
- Cet historique est distinct du fil de nouveautés artistiques.
- L’historique conserve uniquement les opérations des **30 derniers jours**.
- Les entrées plus anciennes sont supprimées automatiquement et ne sont plus consultables dans l’application.

### Contenu de la copie

La copie comprend :

- toutes les informations de la chanson ;
- les paroles ;
- les notes ;
- les réglages associés.

La copie ne comprend pas l’appartenance aux setlists.

- Avant de confirmer la copie, l’application affiche la liste des fichiers audio liés à la chanson.
- L’utilisateur sélectionne individuellement les audios qu’il souhaite copier.
- Tous les audios sont décochés par défaut.
- Seuls les audios explicitement sélectionnés sont inclus ; il est possible de n’en sélectionner aucun.
- Si l’utilisateur choisit de ne pas les copier, seuls la chanson et ses autres données sont créées dans l’espace de destination.
- Les audios inclus conservent leur nom d’affichage d’origine.
- Chaque audio copié est automatiquement lié à la nouvelle chanson créée dans l’espace de destination.
- Un suffixe « (copie) », puis un numéro croissant, est ajouté uniquement si un audio du même nom existe déjà dans l’espace de destination.
- Le renommage d’un audio n’affecte pas les autres audios de la chanson ni leurs fichiers techniques.

### Contrôle du quota avant la copie

- L’interface affiche le poids total des audios sélectionnés.
- Au clic sur le bouton **« Transférer »**, l’application vérifie le quota réellement disponible dans l’espace de destination.
- Pour un groupe, le contrôle utilise la taille cumulée des fichiers face à la limite de 5 Go.
- Pour Mon espace, le contrôle utilise la durée cumulée face à la limite d’une heure.
- Si tout le contenu sélectionné tient dans le quota, la copie peut commencer.
- Si le quota est insuffisant, aucun transfert ne démarre et aucune copie partielle n’est créée.
- Le message d’erreur indique l’espace ou la durée supplémentaire nécessaire et invite l’utilisateur à retirer des audios de la sélection ou à libérer du quota.
- Le quota est vérifié à nouveau côté serveur au moment de finaliser l’opération afin d’éviter un dépassement provoqué par une autre action simultanée.

### Fonctionnement technique de la copie

- La chanson est copiée sous forme de nouvelles métadonnées et de nouveaux contenus textuels dans l’espace de destination.
- Un fichier audio déjà stocké n’est pas téléchargé puis téléversé à nouveau.
- Pour chaque audio sélectionné, l’application crée une nouvelle référence logique rattachée à l’espace et à la chanson de destination.
- Cette référence possède ses propres métadonnées et ses propres droits d’accès.
- Le nom, la date d’ajout affichée et l’auteur affiché de l’audio restent ceux de l’élément d’origine.
- Le système conserve séparément la date de copie, l’utilisateur ayant lancé la copie et l’espace source pour l’audit interne, sans remplacer les informations d’origine visibles.
- La copie reste fonctionnellement indépendante : supprimer ou modifier la référence d’origine ne supprime pas ou ne modifie pas la référence copiée.
- Le fichier MP3 physique n’est supprimé du stockage que lorsqu’aucune référence active ou restaurable ne l’utilise encore.
- Même si les octets physiques ne sont pas dupliqués, la taille ou la durée de l’audio est comptabilisée dans le quota de chaque espace qui possède une référence, afin d’éviter le contournement des limites.
- Les fichiers sont conservés dans un stockage privé. Leur lecture dépend des droits enregistrés dans les données métier et de l’appartenance de l’utilisateur à l’espace.
- L’opération étant principalement une copie de données et de droits, elle doit être presque instantanée.
- L’interface affiche simplement **« Copie en cours… »** pendant l’opération, sans barre de progression ni bouton Annuler.

### Cycle de vie d’un fichier audio

Le système distingue deux objets :

1. **Le fichier physique partagé** : le MP3 compressé et stocké une seule fois.
2. **La référence d’espace** : les informations propres à l’utilisation de ce fichier dans un espace.

#### Création initiale

1. L’audio est préparé et compressé localement en MP3 192 kb/s.
2. Le fichier est envoyé dans le stockage privé.
3. Un identifiant unique et immuable est attribué au fichier physique.
4. Une référence est créée dans l’espace d’origine.
5. Cette référence porte notamment le nom d’affichage, l’auteur, la chanson liée, l’espace, les droits et les autres métadonnées fonctionnelles.

#### Copie de l’espace A vers l’espace B

1. Le fichier physique n’est pas renvoyé et conserve le même identifiant.
2. Une nouvelle référence indépendante est créée dans l’espace B.
3. Les métadonnées de départ sont copiées depuis la référence de l’espace A.
4. Les références A et B évoluent ensuite séparément.
5. Renommer ou modifier les métadonnées dans A ne modifie rien dans B, et inversement.
6. Chaque référence peut être liée à une chanson différente dans son propre espace.
7. Les permissions sont déterminées séparément par l’espace auquel appartient chaque référence.

#### Suppression

- Supprimer l’audio dans l’espace A place uniquement la référence A dans la corbeille.
- L’espace B conserve sa référence et continue d’accéder au fichier physique.
- La mise en corbeille de A libère immédiatement le quota logique de A, sans affecter celui de B.
- Le fichier physique est conservé tant qu’au moins une référence active ou encore restaurable existe dans un espace.
- Le fichier physique peut être supprimé définitivement uniquement lorsque toutes ses références ont été supprimées définitivement après leur période de corbeille.
- La suppression physique doit être gérée côté serveur avec un contrôle du nombre de références, jamais directement par le client.

Ainsi, les espaces partagent les octets du fichier pour éviter les transferts et duplications inutiles, mais ne partagent ni les métadonnées modifiables ni les droits fonctionnels.

### Interruption du transfert

- Si la connexion est coupée ou qu’une erreur survient pendant la copie logique, l’opération est annulée.
- Le transfert ne reprend pas automatiquement à l’endroit où il s’est arrêté.
- Aucun contenu partiel ne doit rester visible dans l’espace de destination.
- Les fichiers incomplets éventuellement envoyés sont supprimés et ne consomment pas de quota.
- La chanson et les audios de l’espace source restent inchangés.
- L’utilisateur est informé de l’échec et peut relancer manuellement l’opération complète.

### Règle d’indépendance

- La copie crée une nouvelle entité dans l’espace de destination.
- Les deux versions deviennent indépendantes.
- Les modifications futures ne sont pas synchronisées entre l’original et la copie.
- Si une chanson du même titre existe déjà dans l’espace de destination, la copie est automatiquement renommée **« Titre (copie) »**.
- Si ce nom existe également, ajouter un numéro croissant : **« Titre (copie 2) »**, **« Titre (copie 3) »**, etc.
- L’utilisateur peut modifier ce titre après la copie, dans le respect de la limite de 100 caractères et de l’unicité dans l’espace.

## 5. Page d’accueil — Mon espace

### Objectif

La page d’accueil donne une vue synthétique de l’activité personnelle et de tous les groupes de l’utilisateur. Elle ne comporte pas de bouton de création rapide.

### Ordre des sections

1. Les trois prochains événements.
2. La section **Mes créations**.
3. Les cartes des groupes, triées par activité récente.

## 6. Calendrier global

### Résumé sur la page d’accueil

- Afficher les **trois prochains événements**, tous espaces confondus.
- Inclure les événements personnels et ceux de tous les groupes.
- Chaque événement indique clairement l’espace concerné.
- Un clic ou toucher ouvre directement la fiche de l’événement dans son espace.
- Afficher un bouton **« Voir tout le calendrier »**.
- S’il n’existe aucun événement à venir, afficher **« Aucun événement prévu pour le moment. »**
- Dans cet état vide, conserver un bouton **« Voir le calendrier »**.
- Ne pas ajouter de bouton de création rapide sur la page d’accueil.

### Calendrier complet

- Mélanger les événements de tous les espaces.
- Permettre de filtrer par groupe ou par espace personnel.
- Proposer des vues classiques : agenda, semaine et mois.
- Permettre d’ouvrir directement la fiche d’un événement.
- Permettre de créer un événement en choisissant son espace de destination.
- Rechercher une expérience conventionnelle et prévisible, proche de Google Calendar, sans fonctionnalité originale supplémentaire à ce stade.

## 7. Nouveautés artistiques

### Titre d’une chanson

- Le titre est obligatoire et limité à **100 caractères**.
- Les espaces, accents et caractères spéciaux sont autorisés.
- Les espaces superflus au début et à la fin sont supprimés avant l’enregistrement.
- Deux chansons ne peuvent pas avoir le même titre dans un même espace.
- L’unicité est vérifiée sans tenir compte des majuscules et minuscules ni des espaces superflus.
- Le même titre reste autorisé dans deux espaces différents.

### Éléments inclus

Une nouveauté artistique correspond uniquement à la création initiale de :

- une nouvelle chanson ;
- un nouvel audio.

Une chanson ou un audio copié depuis un autre espace compte également comme une nouveauté artistique dans l’espace de destination.

- Son classement dans les nouveautés utilise la date de la copie, c’est-à-dire sa date d’arrivée dans l’espace de destination.
- Sa fiche conserve cependant la date et l’auteur d’origine.
- La copie ne recrée une nouveauté que dans l’espace de destination ; elle ne remonte pas dans le fil de l’espace source.

Ne sont pas considérés comme nouveautés :

- les setlists ;
- les modifications d’une chanson existante ;
- les modifications d’un audio existant ;
- les corrections ou changements de métadonnées.

### Comportement au clic

- Une chanson ouvre directement sa fiche.
- Un audio lié à une chanson ouvre directement le lecteur audio de la chanson concernée.
- Un audio non lié ouvre directement sa propre fiche audio.

### Distinction visuelle des audios

L’interface doit distinguer clairement :

- **Audio lié** : afficher le nom de la chanson associée et une indication visuelle de liaison.
- **Audio indépendant** : afficher une indication explicite qu’il n’est lié à aucune chanson.

Cette distinction ne doit pas reposer uniquement sur la couleur : utiliser également un libellé et/ou une icône différente.

## 8. Section Mes créations

- Afficher les trois dernières nouveautés artistiques de l’espace personnel.
- Toujours afficher les trois dernières, même si elles sont anciennes.
- Chaque élément est visuellement et fonctionnellement cliquable.
- La section donne accès à Mon espace.
- Si aucune création personnelle n’existe, afficher **« Aucune création pour le moment. »**
- Dans cet état vide, afficher un bouton **« Ouvrir Mon espace »**.
- Ne pas afficher de bouton de création directe sur la page d’accueil.

## 9. Cartes des groupes

### Tri

- Trier les groupes selon la date de leur nouveauté artistique la plus récente.
- Le groupe le plus récemment actif apparaît en premier.
- Un groupe sans activité récente reste affiché en dernier.

### Contenu de chaque carte

- Nom du groupe.
- Indication de son activité récente.
- Accès direct au groupe.
- Ses trois dernières nouveautés artistiques.
- Toujours afficher les trois dernières nouveautés disponibles, même si elles datent de plusieurs mois.
- Chaque nouveauté est cliquable et ouvre directement le contenu concerné.
- Aucun bouton « Voir toutes les nouveautés » et aucun historique artistique dédié ne sont proposés.
- Pour consulter les autres contenus, l’utilisateur ouvre le groupe puis se rend sur sa page **Songs**.

### Cas avec moins de trois nouveautés

- Afficher uniquement les nouveautés existantes.
- Ne pas inventer de contenu et ne pas masquer le groupe.
- Si le groupe ne possède encore aucune chanson ni aucun audio, afficher **« Aucune création pour le moment. »** dans sa carte.
- Dans cet état vide, afficher uniquement le bouton **« Ouvrir le groupe »**.

### Utilisateur sans groupe

- Si l’utilisateur n’appartient à aucun groupe, afficher **« Vous n’avez encore aucun groupe. »**
- Proposer un bouton **« Créer un groupe »**.
- Proposer un bouton **« Rejoindre avec un lien »**.
- Mon espace, Mes créations et le calendrier personnel restent utilisables normalement.

## 10. Navigation et interactions

- Toutes les lignes d’événement et de nouveauté doivent avoir une apparence interactive claire.
- Le clic sur un élément doit ouvrir directement la ressource, sans étape intermédiaire.
- Lorsqu’une ressource appartient à un groupe, l’application bascule dans le bon contexte de groupe avant d’afficher la ressource.
- Le retour doit ramener l’utilisateur à la page d’accueil en conservant sa position autant que possible.

## 11. Retrait d’un utilisateur et données locales

- Le retrait d’un utilisateur révoque immédiatement son accès serveur au groupe.
- Un membre ou un invité peut quitter lui-même un groupe, sans intervention d’un administrateur.
- Un administrateur peut également quitter le groupe, sauf s’il en est le dernier administrateur.
- Un départ volontaire applique les mêmes règles de révocation et de suppression locale qu’un retrait effectué par un administrateur.
- Si son appareil est hors connexion, les données déjà présentes peuvent rester temporairement accessibles jusqu’à la prochaine reconnexion.
- À la prochaine connexion ou synchronisation, l’application détecte la perte d’appartenance au groupe.
- Elle supprime alors automatiquement de l’appareil toutes les données locales appartenant à ce groupe.
- Elle supprime également tous les fichiers audio de ce groupe mis en cache.
- Les modifications locales en attente concernant ce groupe ne doivent pas être envoyées après la révocation de l’accès.
- Le groupe disparaît du sélecteur d’espace et de la page d’accueil.
- L’utilisateur est informé qu’il n’a plus accès au groupe et que ses données locales ont été supprimées.

### Suppression du compte

- Un utilisateur ne peut pas supprimer son compte s’il est le dernier administrateur d’au moins un groupe.
- Il doit d’abord nommer un autre administrateur dans chacun des groupes concernés.
- L’écran de suppression doit identifier les groupes qui bloquent l’action et proposer un accès direct à leur gestion des rôles.
- Une fois qu’un autre administrateur est présent dans chaque groupe, la suppression du compte peut continuer.
- Les contenus créés dans les groupes restent dans leurs groupes, car ils appartiennent au groupe et non à leur auteur.
- La suppression du compte entraîne la suppression immédiate et définitive de Mon espace et de tous ses contenus.
- Aucun délai de rétention et aucune restauration ne sont proposés pour la suppression d’un compte.
- Les appartenances de l’utilisateur aux groupes sont retirées et les données locales correspondantes sont purgées.

#### Parcours de confirmation

1. L’utilisateur clique sur **« Supprimer mon compte »**.
2. Une première fenêtre demande : **« Voulez-vous supprimer votre compte ? »**
3. Elle propose les actions **« Supprimer »** et **« Annuler »**.
4. Si l’utilisateur choisit Annuler, aucune demande n’est créée.
5. S’il choisit Supprimer, l’application envoie un e-mail de confirmation à l’adresse de son compte.
6. Une seconde fenêtre l’informe : **« Veuillez confirmer la suppression de votre compte en cliquant sur le lien envoyé par e-mail. »**
7. Le compte reste actif tant que le lien reçu par e-mail n’a pas été utilisé.
8. La suppression définitive est déclenchée uniquement après le clic sur ce lien.

- Le lien de confirmation reste valable pendant **1 heure** après son envoi.
- Après expiration, aucune suppression n’a lieu et l’utilisateur doit recommencer la procédure depuis l’application.
- Le lien doit être à usage unique et devient invalide dès que la suppression a été confirmée.
- Une fois la suppression effective, un dernier e-mail est envoyé à l’ancienne adresse du compte.
- Cet e-mail confirme que le compte a bien été supprimé et remercie l’utilisateur d’avoir utilisé FaderZero.
- Il ne contient pas de lien de restauration, puisque la suppression est définitive.

Aucune saisie du mot « SUPPRIMER » n’est demandée.

## 12. Contraintes d’interface

- Conception mobile-first.
- Thème sombre, propre, crédible et orienté musique.
- Responsive sur mobile et ordinateur.
- Hiérarchie visuelle sobre : calendrier, créations personnelles, puis groupes.
- Accessibilité clavier et libellés explicites.
- Ne pas utiliser la couleur comme seul moyen de transmettre une information.
- Prévoir des états de chargement, vide et erreur dans l’implémentation finale.

## 13. Modèle fonctionnel minimal suggéré

### Espace

- `id`
- `type`: `personal` ou `group`
- `name`
- `owner_id`
- `created_at`

### Appartenance à un groupe

- `workspace_id`
- `user_id`
- `role`
- `joined_at`

Un espace personnel ne doit jamais accepter plus d’une appartenance.

### Événement

- `id`
- `workspace_id`
- `title`
- `type`
- `starts_at`
- `ends_at`
- `location`

### Nouveauté artistique

Elle peut être calculée à partir des dates de création des chansons et des audios. Les modifications ultérieures ne doivent pas changer son ordre dans le fil de nouveautés.

Pour un audio, prévoir au minimum :

- `song_id` renseigné : audio lié à une chanson ;
- `song_id` nul : audio indépendant.

## 14. Critères d’acceptation principaux

- À la création d’un compte, Mon espace est créé automatiquement et reste privé.
- Après connexion, l’utilisateur arrive sur la page d’accueil de Mon espace.
- La page affiche exactement trois événements futurs au maximum, issus de tous les espaces.
- La page affiche jusqu’à trois nouveautés personnelles.
- Chaque groupe affiche jusqu’à trois nouveautés artistiques et reste visible même si elles sont anciennes.
- Les groupes sont triés par date de dernière nouveauté artistique.
- Les créations et modifications de setlists n’apparaissent jamais dans les nouveautés.
- La modification d’une chanson ou d’un audio ne recrée pas une nouveauté.
- Un audio lié et un audio indépendant sont distinguables par leur libellé et leur icône.
- Chaque événement, chanson et audio ouvre directement la bonne ressource dans le bon espace.
- La copie d’un morceau crée une version indépendante sans appartenance aux setlists.
- Le créateur d’un groupe reçoit automatiquement le rôle administrateur.
- La création d’un groupe nécessite uniquement un nom ; le logo est facultatif.
- Un utilisateur peut créer un nombre illimité de groupes dans la version actuelle.
- En l’absence de logo, un avatar coloré avec les initiales du groupe est généré automatiquement.
- Après sa création, le nouveau groupe devient l’espace actif et sa page d’accueil est ouverte.
- Une fenêtre propose immédiatement d’inviter un premier membre dans le nouveau groupe.
- L’utilisateur peut fermer cette fenêtre avec « Plus tard » sans créer d’invitation.
- La proposition initiale d’invitation n’apparaît qu’une fois ; les invitations suivantes passent par l’espace d’administration.
- Un administrateur peut lire et modifier tous les éléments, inviter des utilisateurs et attribuer les rôles administrateur, membre ou invité.
- Un administrateur peut retirer un autre administrateur, un membre ou un invité du groupe.
- Le système empêche toute action laissant le groupe sans administrateur.
- N’importe quel administrateur peut supprimer le groupe ; le créateur ne conserve pas de privilège particulier.
- La suppression d’un groupe passe d’abord par une corbeille permettant sa restauration.
- Tous les administrateurs peuvent restaurer un groupe placé dans la corbeille pendant 7 jours.
- Les chansons, audios et événements supprimés individuellement passent également par une corbeille.
- Les éléments supprimés sont restaurables pendant 7 jours avant leur suppression définitive automatique.
- Les administrateurs et les membres peuvent restaurer les éléments supprimés ; les invités ne le peuvent pas.
- Une action temporaire « Annuler » permet de restaurer immédiatement un élément après sa suppression.
- Un administrateur peut générer un lien d’invitation générique, à usage unique et valable pendant 24 heures.
- Le rôle choisi lors de la création du lien est automatiquement attribué au nouvel utilisateur.
- Une personne sans compte peut s’inscrire depuis le lien, confirmer son adresse e-mail, puis rejoindre automatiquement le groupe.
- Aucun utilisateur ne rejoint un groupe avec un compte non confirmé.
- Une invitation expirée pendant l’inscription ou la confirmation de l’e-mail ne permet pas de finaliser l’adhésion.
- Un administrateur peut révoquer à tout moment une invitation non utilisée.
- L’espace d’administration liste uniquement les invitations encore actives.
- Plusieurs liens à usage unique peuvent être actifs simultanément, y compris pour un même rôle.
- La limite est de 5 liens actifs simultanés pour chacun des trois rôles.
- Chaque invitation active affiche son rôle, son temps restant et les actions Copier et Révoquer.
- Un membre peut créer, modifier et supprimer les contenus artistiques et les événements du groupe.
- Un membre peut modifier ou supprimer un contenu du groupe même s’il a été créé par un autre utilisateur.
- Un invité peut uniquement consulter les éléments artistiques et les événements du groupe.
- Un invité peut écouter et mettre en cache les audios sans pouvoir les modifier.
- Après le retrait d’un utilisateur, toutes les données et tous les audios locaux du groupe sont supprimés à la prochaine connexion.
- Un utilisateur peut quitter librement un groupe ; le dernier administrateur doit d’abord nommer un autre administrateur.
- Aucune modification locale en attente n’est synchronisée après la révocation de l’accès.
- La suppression d’un compte est impossible tant que son utilisateur est le dernier administrateur d’un groupe.
- La suppression d’un compte détruit immédiatement et définitivement Mon espace et ses contenus, sans période de rétention.
- La suppression définitive nécessite une confirmation dans l’application, puis un clic sur un lien envoyé par e-mail.
- Le lien de suppression est à usage unique et expire après 1 heure.
- Un e-mail final confirme la suppression et remercie l’utilisateur d’avoir utilisé l’application.

## 15. Points restant à décider

- Aucun point bloquant ne reste à décider dans le périmètre actuel compte, espaces, groupes et page d’accueil.

## 16. Référence de prototype

Le prototype visuel autonome de la page d’accueil est enregistré dans le même dossier sous le nom `home.html`.

---

Dernière mise à jour : 20 juillet 2026.
