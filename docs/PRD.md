## Problème

Faderzero stocke aujourd’hui physiquement les fichiers des groupes dans son propre espace. Même lorsqu’un utilisateur utilise gratuitement l’application, ses audios, documents et médias génèrent donc un coût récurrent pour Faderzero. Ce modèle rend difficile la création d’une offre gratuite économiquement soutenable.

Les groupes ne peuvent pas choisir où leurs fichiers sont stockés. Ils ne peuvent ni utiliser leur propre espace cloud, ni choisir une offre gérée par Faderzero pour éviter de s’occuper de leur stockage. Le stockage est également trop lié au fonctionnement historique de Faderzero pour ajouter proprement plusieurs fournisseurs sans dupliquer les parcours d’envoi, de lecture, de suppression et de partage public.

Cette évolution ne doit pas interrompre les groupes existants, rendre Google obligatoire, casser l’utilisation hors ligne, ni rendre indisponibles les fichiers déjà stockés. Les permissions Faderzero doivent rester la source de vérité : connecter un compte de stockage ne doit pas obliger les autres membres du groupe à posséder un compte chez ce fournisseur.

## Solution

Chaque groupe choisit un stockage commun pour ses fichiers.

L’offre gratuite permet à un admin de connecter l’espace cloud de son choix, en commençant par Google Drive. Le groupe utilise alors cet espace pour ses nouveaux fichiers sans que chaque membre ait à connecter son propre compte. Les membres continuent à utiliser leurs identifiants et leurs rôles Faderzero habituels.

Faderzero Cloud constitue l’alternative payante destinée aux groupes qui préfèrent un stockage entièrement géré par Faderzero. Tant que sa facturation n’est pas disponible, l’offre apparaît comme « À venir » pour les nouveaux groupes. Les groupes existants conservent cependant leur stockage Faderzero actuel sans interruption.

Un groupe peut fonctionner sans stockage configuré. Les fonctions ne nécessitant pas de fichiers restent disponibles. Au premier besoin d’envoyer un fichier, l’admin est invité à configurer le stockage et les autres membres sont informés qu’un admin doit intervenir.

Chaque fichier conserve l’identité du fournisseur qui l’héberge. Un groupe peut donc changer de stockage sans perdre l’accès à ses anciens fichiers. Dans un premier temps, un transfert manuel assisté permet d’exporter l’ensemble des fichiers, de connecter un nouveau fournisseur, puis de les réimporter sans dupliquer les données métier. Un transfert automatique progressif pourra être ajouté ensuite.

## Utilisateur cible

L’utilisateur principal est l’admin d’un groupe musical utilisant Faderzero pour centraliser morceaux, enregistrements, documents et EPK. Il souhaite soit utiliser gratuitement un espace cloud qu’il possède déjà, soit payer pour déléguer entièrement la gestion du stockage à Faderzero.

Les membres du groupe envoient, écoutent et téléchargent les fichiers selon leurs permissions Faderzero. Ils n’ont pas besoin de connaître le compte cloud connecté ni de posséder un compte chez le même fournisseur.

Les invités disposent uniquement des accès explicitement accordés par leur rôle.

Les visiteurs d’un EPK publié peuvent consulter les médias autorisés sans accéder au stockage privé du groupe.

## User Stories

US-1. En tant qu’admin créant un groupe, je veux choisir où stocker ses fichiers, afin d’adopter le modèle correspondant à mes besoins.

US-2. En tant qu’admin, je veux choisir Google Drive gratuitement, afin d’utiliser un espace que je possède déjà.

US-3. En tant qu’admin, je veux voir Faderzero Cloud comme une offre « À venir », afin de savoir qu’une solution gérée sera proposée ultérieurement.

US-4. En tant qu’admin, je veux choisir « Configurer plus tard », afin de commencer à utiliser Faderzero sans connecter immédiatement un stockage.

US-5. En tant qu’utilisateur d’un groupe sans stockage, je veux continuer à utiliser toutes les fonctions sans fichier, afin que le groupe ne soit pas bloqué.

US-6. En tant qu’admin tentant un premier upload sans stockage, je veux être conduit vers sa configuration, afin de pouvoir poursuivre.

US-7. En tant que membre tentant un upload sans stockage, je veux être informé qu’un admin doit le configurer, afin de savoir pourquoi l’action est bloquée.

US-8. En tant qu’invité, je veux que les restrictions habituelles de mon rôle restent appliquées, afin de ne pas obtenir de droits supplémentaires par le parcours de stockage.

US-9. En tant qu’admin, je veux connecter Google Drive avec mon compte, afin qu’il devienne le stockage commun du groupe.

US-10. En tant qu’admin, je veux que Faderzero prépare automatiquement l’espace nécessaire, afin de ne pas créer ou organiser manuellement des dossiers.

US-11. En tant qu’admin, je veux que le stockage reste associé au groupe même si celui-ci est renommé, afin qu’un changement de nom ne casse aucun fichier.

US-12. En tant que membre, je veux envoyer un fichier vers le stockage du groupe sans connecter mon propre compte Google, afin de collaborer normalement.

US-13. En tant que membre autorisé, je veux lire un fichier stocké sur le compte cloud connecté par l’admin, afin de ne pas dépendre d’un accès direct à ce compte.

US-14. En tant que membre autorisé, je veux télécharger un fichier pour une utilisation hors ligne, afin de continuer à l’utiliser sans réseau.

US-15. En tant qu’utilisateur hors ligne, je veux que mon fichier soit conservé localement et envoyé au retour du réseau, afin de ne pas perdre mon travail.

US-16. En tant qu’utilisateur, je veux pouvoir relancer un upload interrompu, afin de ne pas recommencer inutilement une opération importante.

US-17. En tant qu’utilisateur, je veux écouter un audio pendant son chargement et déplacer la position de lecture, afin de conserver une lecture fluide des fichiers longs.

US-18. En tant qu’utilisateur, je veux que les fichiers déjà téléchargés restent disponibles hors ligne après le changement de stockage du groupe, afin de préserver mon cache local.

US-19. En tant qu’admin, je veux consulter le fournisseur actif, son état, le compte connecté et l’espace disponible, afin de surveiller le stockage du groupe.

US-20. En tant qu’admin, je veux ouvrir l’espace du groupe dans Google Drive, afin de retrouver directement les fichiers hébergés.

US-21. En tant qu’admin, je veux reconnecter Google Drive après une autorisation expirée ou révoquée, afin de rétablir l’accès aux fichiers.

US-22. En tant qu’admin, je veux voir un état explicite lorsque le stockage est plein, indisponible, déconnecté ou doit être réautorisé, afin de savoir quelle action entreprendre.

US-23. En tant qu’admin, je veux déconnecter le stockage avec un avertissement précis, afin de comprendre quels fichiers deviendront indisponibles.

US-24. En tant qu’admin, je veux que la déconnexion ne supprime aucun fichier, afin d’éviter une perte irréversible.

US-25. En tant qu’admin, je veux changer le fournisseur par défaut du groupe, afin que les nouveaux fichiers utilisent un autre stockage.

US-26. En tant que membre, je veux continuer à lire les anciens fichiers après un changement de fournisseur, afin que la transition soit transparente.

US-27. En tant qu’admin, je veux voir quels fichiers restent chez chaque fournisseur, afin de suivre une migration progressive.

US-28. En tant qu’admin, je veux conserver temporairement l’ancienne connexion après un changement, afin que les anciens fichiers restent accessibles.

US-29. En tant qu’admin, je veux lancer un transfert manuel assisté, afin de déplacer les fichiers vers le nouveau stockage avant l’arrivée du transfert automatique.

US-30. En tant qu’admin, je veux exporter morceaux, audios, médias EPK et documents, afin que le transfert manuel soit complet.

US-31. En tant qu’admin, je veux réimporter cette archive en mode transfert, afin de copier physiquement les fichiers sans recréer les morceaux ou leurs relations.

US-32. En tant qu’admin, je veux que chaque fichier transféré soit vérifié avant de déconnecter l’ancien stockage, afin de ne pas perdre de contenu.

US-33. En tant qu’admin, je veux relancer uniquement les fichiers dont le transfert a échoué, afin de ne pas recopier ceux déjà vérifiés.

US-34. En tant qu’admin, je veux être empêché de supprimer prématurément l’ancienne connexion, afin de conserver l’accès aux fichiers qui y résident encore.

US-35. En tant qu’admin ayant connecté son compte cloud, je veux être averti avant de quitter le groupe ou de perdre son rôle, afin que le stockage ne devienne pas inaccessible sans préparation.

US-36. En tant qu’autre admin, je veux pouvoir reconnecter le stockage avec un autre compte ou changer de fournisseur, afin d’assurer la continuité après le départ du premier admin.

US-37. En tant qu’admin, je veux que les limites globales de stockage Faderzero ne s’appliquent pas à mon propre cloud, afin que sa capacité réelle soit utilisée.

US-38. En tant qu’utilisateur, je veux conserver des limites raisonnables par fichier et par type, afin que les uploads restent sûrs et compatibles.

US-39. En tant qu’utilisateur de Faderzero Cloud, je veux voir l’espace utilisé et l’espace inclus dans mon offre, afin de suivre mon quota.

US-40. En tant qu’admin d’un groupe existant, je veux que mes fichiers et mes nouveaux uploads continuent à fonctionner sur le stockage historique, afin que la migration ne provoque aucune interruption.

US-41. En tant qu’admin, je veux supprimer un fichier selon les règles Faderzero, afin que son contenu physique et ses métadonnées suivent le même cycle de suppression.

US-42. En tant qu’admin d’un EPK, je veux publier des médias provenant du stockage du groupe, afin de conserver le fonctionnement actuel de l’EPK.

US-43. En tant que visiteur d’un EPK publié, je veux consulter uniquement les médias rendus publics par ce dernier, afin de ne jamais accéder aux autres fichiers du groupe.

US-44. En tant que visiteur, je veux que les médias EPK restent accessibles sans voir de lien privé vers le stockage du groupe, afin de préserver sa confidentialité.

US-45. En tant qu’admin, je veux que la dépublication ou le retrait d’un média EPK supprime son accès public, afin que les anciennes adresses ne permettent plus de le consulter.

US-46. En tant qu’admin, je veux pouvoir utiliser ultérieurement Dropbox, OneDrive ou WebDAV/Nextcloud sans changer les parcours Faderzero, afin de choisir librement mon fournisseur.

## Critères de succès

1. Tous les fichiers historiques des groupes existants restent lisibles, téléchargeables, supprimables et utilisables dans les EPK.
2. Les groupes existants peuvent continuer à envoyer de nouveaux fichiers sur leur stockage historique.
3. Après création d’un groupe, l’admin voit Google Drive, Faderzero Cloud « À venir » et « Configurer plus tard ».
4. Choisir « Configurer plus tard » permet d’accéder au reste de l’application.
5. Un admin connecte Google Drive et voit ensuite l’état « Connecté », le compte utilisé et l’espace disponible.
6. L’espace du groupe est créé automatiquement sans intervention manuelle dans Google Drive.
7. Un membre autorisé envoie un audio sur le Google Drive du groupe sans connecter de compte Google.
8. Un autre membre autorisé lit cet audio sans connecter de compte Google.
9. Un invité ne peut ni configurer le stockage ni envoyer un fichier sans permission.
10. Un fichier ajouté hors ligne apparaît dans la file d’attente puis est envoyé automatiquement au retour du réseau.
11. Après interruption d’un upload, une nouvelle tentative peut reprendre ou relancer l’envoi sans perdre le fichier local.
12. La lecture audio accepte la lecture partielle et le déplacement dans la piste.
13. Un fichier téléchargé dans le cache reste lisible hors ligne.
14. Une autorisation Google expirée ou révoquée produit l’état « Autorisation expirée » et bloque les nouveaux uploads sans casser le reste de l’application.
15. Un stockage plein produit l’état « Stockage plein » avant qu’un fichier ne soit déclaré envoyé.
16. Aucun écran utilisateur, export ordinaire ou réponse de téléchargement n’expose les autorisations privées du compte connecté.
17. Un média Google Drive n’est jamais rendu public directement.
18. Un EPK publié sert uniquement les fichiers qui lui appartiennent et qui ont été autorisés publiquement.
19. Un EPK dépublié ne permet plus de créer de nouvelle session d’accès à ses médias.
20. Un groupe peut conserver simultanément des fichiers historiques sur Faderzero Cloud et de nouveaux fichiers sur Google Drive.
21. Après changement de fournisseur, les nouveaux uploads utilisent le nouveau fournisseur tandis que les anciens fichiers restent lisibles.
22. L’export de transfert contient les morceaux, audios, médias EPK et documents attendus.
23. Le réimport en mode transfert ne crée ni morceau en double ni relation métier en double.
24. Chaque fichier transféré est vérifié avant que l’ancienne connexion puisse être supprimée sans avertissement.
25. Le départ ou la rétrogradation de l’admin ayant connecté le stockage est bloqué jusqu’à reconnexion, changement de fournisseur ou acceptation explicite de l’indisponibilité.
26. Le stockage personnel n’est pas bloqué par un quota total Faderzero, mais conserve les limites de taille, de format et de sécurité par fichier.
27. Les groupes utilisant le stockage personnel ne génèrent pas de nouvelle consommation de stockage Faderzero pour leurs nouveaux fichiers.
28. Les contrôles existants de rôles, de types de fichiers et de suppression continuent à produire les mêmes autorisations observables.

## Hors périmètre

- Activation et facturation de Faderzero Cloud pour les nouveaux groupes.
- Transfert automatique entre fournisseurs dans la première version.
- Implémentation fonctionnelle de Dropbox, OneDrive et WebDAV/Nextcloud dans la première version.
- Suppression immédiate du stockage historique des groupes existants.
- Déplacement obligatoire des anciens fichiers vers Google Drive.
- Compte Google obligatoire pour tous les membres.
- Connexion d’un stockage différent par membre.
- Liens Google Drive publics ou partage direct des dossiers avec les membres.
- Publication d’identifiants ou d’autorisations privées du fournisseur.
- Suppression automatique des fichiers de l’ancien fournisseur après un changement.
- Déconnexion silencieuse d’un fournisseur contenant encore des fichiers.
- Migration destructive réalisée en une seule opération sans coexistence.
- Refonte des fonctionnalités Faderzero ne manipulant aucun fichier.
- Historique complet de toutes les versions d’un fichier.
- Garantie de disponibilité lorsque le fournisseur choisi par l’utilisateur est lui-même indisponible.
- Transfert direct de fournisseur à fournisseur sans export local dans la première version.

## Décisions d’implémentation

- Le stockage appartient au groupe et non à chaque membre.
- Un seul fournisseur est la destination par défaut des nouveaux fichiers à un instant donné.
- Chaque fichier conserve le fournisseur sur lequel il réside réellement.
- Les groupes existants conservent Faderzero Cloud comme stockage actif historique tant que la facturation et la migration ne sont pas prêtes.
- Les nouveaux groupes voient Google Drive, « Configurer plus tard » et Faderzero Cloud marqué « À venir ».
- Faderzero Cloud ne peut pas être choisi par un nouveau groupe avant son activation commerciale.
- Seul un admin peut connecter, reconnecter, changer ou déconnecter le stockage.
- Les membres autorisés peuvent envoyer et lire des fichiers sans connecter leur propre compte chez le fournisseur.
- Les invités conservent strictement les permissions prévues par leur rôle.
- Sans stockage configuré, seules les actions nécessitant un fichier sont bloquées.
- Au premier upload sans stockage, un admin voit le choix du fournisseur ; un membre voit qu’un admin doit intervenir.
- Google Drive est préparé automatiquement avec un espace Faderzero propre au groupe et des catégories pour les audios, les EPK et les documents.
- L’identité technique de cet espace ne change pas lorsque le groupe est renommé.
- Les fichiers Google Drive restent privés et sont toujours servis à travers Faderzero.
- Les états visibles sont : Connecté, Autorisation expirée, Stockage plein, Indisponible et Déconnecté.
- L’écran Stockage affiche le fournisseur, l’état, le compte connecté, l’espace utilisé, l’espace disponible et les actions autorisées.
- Pour Faderzero Cloud, l’écran affiche l’espace utilisé sur l’espace inclus ainsi qu’une action de gestion de l’offre lorsqu’elle sera disponible.
- Pour un stockage personnel, la capacité totale dépend du fournisseur ; Faderzero conserve uniquement des limites raisonnables par fichier et par type.
- Pour Faderzero Cloud, les quotas restent liés à l’offre gérée.
- Changer de fournisseur modifie immédiatement la destination des nouveaux fichiers.
- Les anciennes connexions restent disponibles en lecture tant que des fichiers leur sont associés.
- La déconnexion ne supprime aucun fichier, mais peut rendre les fichiers concernés indisponibles jusqu’à reconnexion.
- Une déconnexion contenant encore des fichiers exige un avertissement et une confirmation explicite.
- Le transfert manuel assisté utilise un export complet distinct de l’export ordinaire du répertoire.
- Le mode transfert recopie les fichiers vers le fournisseur actif sans dupliquer les morceaux, EPK, documents ou relations existantes.
- La présence d’un fichier identique sur l’ancien fournisseur n’empêche pas sa copie physique vers le nouveau.
- L’ancienne connexion n’est considérée comme libérable qu’après vérification de tous les fichiers ou acceptation explicite des éléments indisponibles.
- Le transfert automatique apparaît comme une possibilité à venir, sans prétendre être disponible.
- L’admin ayant connecté le stockage ne peut pas quitter le groupe ou perdre son rôle sans transfert de responsabilité, changement de fournisseur ou confirmation explicite des conséquences.
- Les uploads hors ligne restent conservés localement jusqu’au retour du réseau.
- Une erreur réseau ne supprime ni le fichier local en attente ni les éléments déjà envoyés avec succès.
- Les médias EPK publics sont accessibles uniquement à travers une adresse Faderzero temporaire et contrôlée.
- La dépublication d’un EPK ou le retrait d’un média invalide la création de nouveaux accès publics.
- Dropbox, OneDrive et WebDAV/Nextcloud doivent pouvoir reprendre les mêmes parcours visibles sans refonte de l’application.

## Notes complémentaires

- La disponibilité de Google Drive, ses limites et ses règles d’autorisation constituent une dépendance externe.
- Le transfert manuel de plusieurs gigaoctets peut être long et exige suffisamment d’espace local pour produire puis relire l’archive.
- Le stockage historique doit rester exploitable pendant toute la période de transition.
- Les changements de fournisseur nécessitent une présentation particulièrement claire de l’emplacement des anciens fichiers.
- Aucun risque ou dépendance supplémentaire n’a été signalé pendant le cadrage.
