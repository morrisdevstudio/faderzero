# Plan : Stockage multi-provider par groupe

> PRD source : `docs/PRD.md`

## Décisions architecturales

Décisions durables qui s’appliquent à toutes les phases :

- **Routes PWA** : les réglages du stockage utilisent `/account?view=group-storage&workspace=<id>`. Après la création d’un groupe, cette même vue présente le choix initial. En l’absence de stockage, les autres routes restent disponibles et seules les actions nécessitant un fichier sont bloquées.
- **Routes serveur** : une API de stockage unique porte la connexion des providers, les sessions d’upload, la finalisation, la lecture, le téléchargement, la suppression, le quota et l’état de santé. Les routes publiques EPK restent séparées des routes authentifiées.
- **Providers** : les identifiants stables sont `faderzero_r2`, `google_drive`, `dropbox`, `onedrive` et `webdav`. Seuls `faderzero_r2` et `google_drive` sont fonctionnels dans ce plan.
- **Contrat provider** : chaque provider expose les mêmes capacités métier : création ou reprise d’une session d’upload, finalisation vérifiée, lecture, téléchargement, suppression, quota et contrôle de santé. Les fonctionnalités métier ne sélectionnent jamais elles-mêmes un fournisseur.
- **Connexions de groupe** : `workspace_storage_connections` contient la configuration non sensible d’un provider pour un groupe, son propriétaire de connexion, son répertoire racine, son compte affichable, son état et son caractère par défaut. Un groupe peut conserver plusieurs connexions pendant une transition, mais une seule reçoit les nouveaux uploads.
- **Objets logiques** : `storage_objects` contient l’identité stable d’un fichier : groupe, clé logique, type, taille et empreinte. Cette identité ne change pas lors d’un transfert.
- **Emplacements physiques** : `storage_object_locations` rattache un objet logique à une connexion, un provider et un identifiant physique. Plusieurs emplacements peuvent coexister pendant un transfert ; un seul est l’emplacement principal, après vérification.
- **Secrets** : les credentials sont conservés dans un espace serveur privé, chiffrés avec une clé versionnée. Aucun refresh token n’est lisible par la PWA, les rôles authentifiés ou les tables publiques.
- **Compatibilité** : `song_assets` et `epk_assets` reçoivent une référence optionnelle vers l’objet logique. Les colonnes historiques, `audio_files` et les clés R2 restent présentes et utilisables pendant toute la stratégie expand → migrate → contract. Aucune phase de ce plan ne les supprime.
- **Groupes historiques** : chaque groupe possédant déjà des fichiers reçoit une connexion `faderzero_r2` active. Les objets existants sont référencés sans déplacer ni renommer leurs clés.
- **Nouveaux groupes** : aucun provider n’est actif tant que l’admin n’a pas choisi Google Drive. Faderzero Cloud est visible mais désactivé avec le libellé « À venir ».
- **Autorisation** : l’admin configure, reconnecte, change ou déconnecte le stockage. Admin et membre peuvent envoyer des fichiers. La lecture suit les permissions Faderzero existantes. L’invité n’obtient aucun droit supplémentaire.
- **Google Drive** : autorisation serveur avec état anti-CSRF, PKCE, accès hors ligne et scope minimal `drive.file`. Faderzero crée lui-même une racine stable pour le groupe et les sous-répertoires audio, EPK et documents.
- **Upload Google Drive** : le serveur contrôle session Faderzero, rôle, groupe, taille et type avant de créer une session résumable. La PWA envoie ensuite les octets directement à Google Drive. L’URI de reprise peut être conservée avec l’upload en attente, mais n’est jamais traitée comme un credential de compte.
- **Finalisation** : aucun fichier n’est déclaré disponible avant vérification côté serveur de son identifiant physique, de sa taille, de son type, de son groupe et, lorsqu’elle est disponible, de son empreinte.
- **Lecture privée** : la PWA demande une URL Faderzero temporaire à partir de l’identifiant logique. Le serveur revalide les permissions et relaie `GET`, `HEAD` et les requêtes `Range` vers l’emplacement réel sans exposer de credential ou de lien permanent du provider.
- **EPK public** : une route publique ne sert un objet qu’après avoir vérifié que l’EPK est publié, que la relation à l’asset existe et que l’asset est autorisé publiquement. Aucun lien public Google Drive n’est créé.
- **Quotas** : Faderzero conserve les limites techniques par fichier et par type pour tous les providers. Les quotas globaux Faderzero restent appliqués à `faderzero_r2` seulement. Pour un provider personnel, l’espace total et les erreurs de capacité viennent du provider.
- **Offline-first** : le Blob, la clé logique, le provider visé et l’état de reprise restent dans la base locale. Un changement de provider ne casse pas les fichiers déjà placés dans le cache audio.
- **Changement de provider** : changer la connexion par défaut affecte uniquement les nouveaux uploads. Les anciens emplacements restent lisibles jusqu’à transfert vérifié ou déconnexion explicitement confirmée.
- **Validation commune** : chaque phase modifiant le code exécute les tests ciblés, le contrôle TypeScript et la vérification PWA adaptée. Les migrations ajoutent des tests de RLS pour admin, membre, invité et service serveur.

---

## Phase 1 : Compatibilité audio R2 derrière l’abstraction

**User stories** : US-40, US-46

### Ce qu’on livre

Le parcours audio historique — réservation, upload, finalisation, lecture avec Range et utilisation offline — passe par le contrat commun de stockage tout en continuant à utiliser R2. Aucun changement n’est visible pour les groupes existants. Cette tranche fixe les types partagés et les erreurs communes dont les autres providers auront besoin.

### Critères d’acceptation

- [ ] Un admin ou membre envoie un nouvel audio R2 avec le même résultat qu’avant la refonte.
- [ ] Un invité reste interdit d’upload.
- [ ] La lecture privée prend en charge `GET`, `HEAD` et une requête `Range` avec les statuts et en-têtes attendus.
- [ ] Une réservation échouée ou un upload invalide est libéré comme aujourd’hui.
- [ ] La file d’attente offline existante peut encore envoyer un fichier au retour du réseau.
- [ ] Aucun appel métier audio ne dépend directement du client R2.
- [ ] Les tests du provider R2 et les tests audio historiques passent.

## Bloquée par

- Aucune — démarrable immédiatement

---

## Phase 2 : Catalogue générique et groupes historiques

**User stories** : US-19, US-39, US-40

### Ce qu’on livre

Les connexions de stockage, objets logiques et emplacements physiques existent avec leurs règles d’accès. Les groupes historiques sont associés à R2 sans déplacer leurs fichiers. Les nouveaux uploads R2 alimentent à la fois le modèle générique et les champs historiques. Un admin ouvre la page Stockage et voit Faderzero Cloud, son état et son quota actuel.

### Critères d’acceptation

- [ ] Les migrations créent les connexions, objets et emplacements avec clés étrangères, contraintes d’unicité et index par groupe.
- [ ] Les credentials sensibles ne se trouvent dans aucune table lisible par les utilisateurs.
- [ ] Le backfill R2 est idempotent et référence chaque `song_asset` existant sans modifier sa clé physique.
- [ ] Un asset historique reste lisible si sa référence générique est absente ou incomplète pendant la fenêtre de compatibilité.
- [ ] Un nouvel upload R2 possède une référence générique et reste lisible par un client utilisant encore les colonnes historiques.
- [ ] Un admin voit `/account?view=group-storage&workspace=<id>` ; un membre ou invité ne peut pas administrer cette vue.
- [ ] La vue d’un groupe historique affiche Faderzero Cloud, Connecté et le quota R2 existant.
- [ ] Les politiques d’accès couvrent admin, membre, invité et service serveur.

## Bloquée par

- Phase 1 : Compatibilité audio R2 derrière l’abstraction

---

## Phase 3 : Compatibilité EPK R2

**User stories** : US-40, US-42, US-43, US-44, US-45

### Ce qu’on livre

Les médias EPK privés et publics utilisent eux aussi les objets logiques et le provider R2. Les EPK déjà publiés continuent à servir images, documents et audios, y compris la lecture partielle, sans modifier leurs adresses publiques.

### Critères d’acceptation

- [ ] Un admin envoie et retire une image ou un document EPK R2 à travers l’abstraction.
- [ ] Les assets EPK existants sont référencés sans déplacement ni renommage physique.
- [ ] Une page EPK publiée sert uniquement ses assets autorisés.
- [ ] Un asset d’un autre EPK ou groupe ne peut pas être obtenu par substitution d’identifiant.
- [ ] Les lectures audio publiques prennent en charge `GET`, `HEAD` et `Range`.
- [ ] Après dépublication, aucune nouvelle session publique ne peut être créée.
- [ ] Les snapshots et révisions EPK existants restent compatibles.

## Bloquée par

- Phase 2 : Catalogue générique et groupes historiques

---

## Phase 4 : Choix du stockage et état non configuré

**User stories** : US-1, US-3, US-4, US-5, US-6, US-7, US-8

### Ce qu’on livre

Après création d’un groupe, l’admin arrive sur le choix Google Drive, Faderzero Cloud « À venir » ou « Configurer plus tard ». Un groupe non configuré utilise normalement toutes les fonctions sans fichier. Au premier upload, l’admin retourne vers la configuration ; le membre reçoit une explication ; l’invité conserve son interdiction habituelle.

### Critères d’acceptation

- [ ] La création d’un groupe ouvre sa vue Stockage sans rendre le choix obligatoire.
- [ ] Google Drive est sélectionnable et Faderzero Cloud est visible mais désactivé avec « À venir ».
- [ ] « Configurer plus tard » conduit au reste de l’application sans connexion créée.
- [ ] Un groupe non configuré peut créer et synchroniser des données sans fichier.
- [ ] Le premier upload d’un admin ouvre la configuration puis permet de reprendre le geste initial.
- [ ] Le premier upload d’un membre explique qu’un admin doit configurer le stockage.
- [ ] Un invité ne voit ni connexion de provider ni élévation de permission.
- [ ] L’interface reste utilisable à partir de 320 px et respecte les composants partagés.

## Bloquée par

- Phase 2 : Catalogue générique et groupes historiques

---

## Phase 5 : Connexion Google Drive

**User stories** : US-2, US-9, US-10, US-11, US-19, US-20, US-21, US-22

### Ce qu’on livre

Un admin connecte Google Drive depuis la vue Stockage. Après consentement, Faderzero crée automatiquement une racine stable pour le groupe et ses catégories. La vue affiche le compte, l’espace utilisé, l’espace disponible, l’ouverture du dossier et les états Connecté, Autorisation expirée, Stockage plein, Indisponible ou Déconnecté.

### Critères d’acceptation

- [ ] Seul un admin authentifié peut démarrer et terminer la connexion d’un groupe qu’il administre.
- [ ] Le retour d’autorisation refuse un état absent, expiré, réutilisé ou associé à un autre groupe.
- [ ] Le scope demandé est `drive.file` et l’accès hors ligne est obtenu côté serveur.
- [ ] Le refresh token est chiffré côté serveur et n’apparaît ni dans les réponses, ni dans la base locale, ni dans l’état client.
- [ ] La racine et les catégories audio, EPK et documents sont créées automatiquement.
- [ ] Renommer le groupe ne change pas l’identifiant de sa racine.
- [ ] Le quota et l’identité affichable du compte sont visibles dans la vue Stockage.
- [ ] « Ouvrir dans Google Drive » cible la racine du groupe.
- [ ] Une révocation produit l’état Autorisation expirée et propose Reconnecter.

## Bloquée par

- Phase 4 : Choix du stockage et état non configuré

---

## Phase 6 : Premier upload audio Google Drive

**User stories** : US-12, US-16, US-37, US-38

### Ce qu’on livre

Un admin ou membre autorisé envoie un MP3 directement vers une session résumable Google Drive créée après validation serveur. Le fichier n’est déclaré disponible qu’après finalisation et vérification. Les quotas globaux Faderzero ne bloquent pas cet upload ; les limites de fichier, MIME et anti-abus restent actives.

### Critères d’acceptation

- [ ] Admin et membre peuvent demander une session ; un invité reçoit un refus.
- [ ] Le serveur valide groupe, connexion active, taille déclarée, MIME et clé logique avant de créer la session.
- [ ] Le corps du fichier est envoyé directement à Google Drive et ne traverse pas le serveur Faderzero.
- [ ] Une session interrompue peut être interrogée puis reprise à l’octet confirmé.
- [ ] Une session expirée redémarre proprement sans perdre le Blob local.
- [ ] La finalisation rejette un identifiant Drive étranger à la racine du groupe ou incohérent avec la taille et le type attendus.
- [ ] L’objet logique et son emplacement Google ne deviennent principaux qu’après vérification.
- [ ] Le quota total R2 n’est pas appliqué ; une erreur de capacité Google produit Stockage plein.
- [ ] Un autre provider peut implémenter le même parcours sans modifier la logique métier de l’audio.

## Bloquée par

- Phase 5 : Connexion Google Drive

---

## Phase 7 : Lecture et téléchargement Google Drive

**User stories** : US-13, US-14, US-17

### Ce qu’on livre

Un membre Faderzero autorisé lit ou télécharge un audio Google Drive sans compte Google. La PWA reçoit uniquement une adresse Faderzero temporaire fondée sur l’objet logique. Le serveur contrôle les permissions et relaie le contenu depuis l’emplacement Google.

### Critères d’acceptation

- [ ] Un membre du groupe lit l’audio envoyé par un autre membre sans autorisation Google personnelle.
- [ ] Un utilisateur sans accès au groupe ne peut pas créer de session de lecture.
- [ ] L’adresse temporaire ne contient ni access token, ni refresh token, ni lien Drive permanent.
- [ ] `GET`, `HEAD` et les requêtes `Range` renvoient les statuts, tailles et en-têtes attendus par la lecture HTML5.
- [ ] Déplacer la position de lecture dans un fichier long fonctionne.
- [ ] Le téléchargement produit le bon type, la bonne taille et un nom utilisable.
- [ ] Une autorisation Google révoquée met la connexion en Autorisation expirée sans exposer l’erreur brute du provider.

## Bloquée par

- Phase 6 : Premier upload audio Google Drive

---

## Phase 8 : File d’attente et cache offline multi-provider

**User stories** : US-15, US-16, US-18

### Ce qu’on livre

La file d’attente locale connaît le provider et l’état d’une session résumable. Un upload créé hors ligne part au retour du réseau vers la connexion active prévue. Une interruption conserve le Blob et reprend lorsque possible. Le cache audio reste indexé par l’objet logique et survit aux changements de provider.

### Critères d’acceptation

- [ ] Hors ligne, le Blob et ses métadonnées sont conservés sans tenter d’appeler un provider.
- [ ] Au retour du réseau, l’upload utilise la connexion prévue ou demande une décision si celle-ci n’est plus disponible.
- [ ] Une reprise conserve l’URI de session et l’avancement sans stocker de credential Google.
- [ ] Après fermeture puis réouverture de la PWA, un upload interrompu revient dans la file avec un état cohérent.
- [ ] Une erreur réseau revient en attente ; une erreur définitive passe en échec avec une action Réessayer.
- [ ] Deux onglets ne finalisent pas deux fois le même upload.
- [ ] Un audio déjà téléchargé reste lisible hors ligne après changement du provider par défaut.
- [ ] Les migrations de base locale préservent les uploads en attente existants.

## Bloquée par

- Phase 6 : Premier upload audio Google Drive
- Phase 7 : Lecture et téléchargement Google Drive

---

## Phase 9 : EPK sur Google Drive

**User stories** : US-42, US-43, US-44, US-45

### Ce qu’on livre

Les images, documents et audios EPK peuvent résider sur Google Drive. L’admin les envoie dans la catégorie du groupe. Les visiteurs les consultent exclusivement à travers les routes publiques Faderzero après validation de l’EPK, de la relation et de la visibilité.

### Critères d’acceptation

- [ ] Un admin envoie une image ou un document EPK sur Google Drive avec les limites de type et de taille existantes.
- [ ] Aucun membre non-admin ne peut administrer les médias EPK.
- [ ] La publication conserve les snapshots et relations existants tout en référençant l’objet logique.
- [ ] Un visiteur lit uniquement les médias d’un EPK publié et explicitement autorisés.
- [ ] Modifier le slug, l’identifiant d’asset ou de piste dans l’URL ne permet pas d’accéder à un autre fichier.
- [ ] Aucun lien public Google Drive n’est créé ou retourné.
- [ ] Les audios publics acceptent `GET`, `HEAD` et `Range` ; les documents utilisent un téléchargement contrôlé.
- [ ] Dépublier l’EPK ou retirer l’asset empêche la création de nouvelles sessions publiques.

## Bloquée par

- Phase 3 : Compatibilité EPK R2
- Phase 5 : Connexion Google Drive
- Phase 7 : Lecture et téléchargement Google Drive

---

## Phase 10 : Suppression physique multi-provider

**User stories** : US-24, US-41

### Ce qu’on livre

Le cycle de suppression cible l’emplacement réel de chaque objet. Une suppression logique conserve le comportement de la corbeille. La suppression physique définitive est idempotente, vérifie le groupe et ne détruit jamais automatiquement les fichiers d’une autre connexion ou d’un autre groupe.

### Critères d’acceptation

- [ ] Mettre un morceau ou asset audio à la corbeille ne supprime pas prématurément son fichier physique.
- [ ] La suppression définitive retire l’emplacement R2 ou Google correspondant après les contrôles métier.
- [ ] Supprimer un média EPK retire uniquement ses emplacements associés et invalide son accès public.
- [ ] Répéter une demande de suppression déjà réussie reste sans effet indésirable.
- [ ] Un identifiant physique fourni par le client n’est jamais suffisant pour choisir l’objet à supprimer.
- [ ] Une panne du provider crée une tâche de nettoyage relançable sans supprimer les métadonnées nécessaires au diagnostic.
- [ ] Les quotas et compteurs se mettent à jour selon le provider concerné.

## Bloquée par

- Phase 6 : Premier upload audio Google Drive
- Phase 9 : EPK sur Google Drive

---

## Phase 11 : Changement de provider et coexistence

**User stories** : US-23, US-24, US-25, US-26, US-27, US-28, US-34

### Ce qu’on livre

Un admin change la connexion par défaut sans déplacer automatiquement les fichiers. Les nouveaux uploads utilisent le nouveau provider, les anciens restent servis depuis leur emplacement actuel et la vue Stockage affiche leur répartition. Une connexion contenant encore des emplacements ne peut pas disparaître sans avertissement explicite.

### Critères d’acceptation

- [ ] Changer le provider par défaut ne réécrit aucun objet existant.
- [ ] Le premier nouvel upload après changement utilise le nouveau provider.
- [ ] Un ancien audio R2 et un nouvel audio Google sont lisibles dans le même groupe.
- [ ] La vue affiche le nombre et le volume de fichiers par connexion.
- [ ] Une ancienne connexion reste disponible en lecture tant qu’elle contient des emplacements actifs.
- [ ] Déconnecter ne supprime aucun fichier physique.
- [ ] Une déconnexion avec fichiers exige une confirmation listant le nombre et le volume rendus indisponibles.
- [ ] Sans confirmation, l’ancienne connexion reste active en lecture.

## Bloquée par

- Phase 7 : Lecture et téléchargement Google Drive
- Phase 9 : EPK sur Google Drive
- Phase 10 : Suppression physique multi-provider

---

## Phase 12 : Continuité après départ de l’admin connecteur

**User stories** : US-21, US-35, US-36

### Ce qu’on livre

Faderzero protège le groupe lorsque l’admin ayant fourni le compte cloud quitte le groupe ou perd son rôle. Un autre admin peut reconnecter la connexion, choisir un autre compte ou un autre provider. L’action risquée reste possible uniquement après acceptation explicite de l’indisponibilité.

### Critères d’acceptation

- [ ] Quitter le groupe ou rétrograder le propriétaire d’une connexion active déclenche un blocage explicatif.
- [ ] Un autre admin peut reconnecter avec un compte autorisé et rétablir l’état Connecté.
- [ ] Une reconnexion ne change pas les objets logiques ni leurs relations métier.
- [ ] Un changement de compte qui ne donne pas accès aux anciens fichiers laisse leurs emplacements indisponibles et identifiés.
- [ ] L’admin peut choisir un autre provider pour les nouveaux uploads sans perdre les références historiques.
- [ ] Accepter l’indisponibilité exige une confirmation forte et conserve les métadonnées nécessaires à une reconnexion ultérieure.
- [ ] Aucun membre non-admin ne peut transférer la propriété ou contourner ce blocage.

## Bloquée par

- Phase 5 : Connexion Google Drive
- Phase 11 : Changement de provider et coexistence

---

## Phase 13 : Transfert manuel assisté

**User stories** : US-29, US-30, US-31, US-32, US-33

### Ce qu’on livre

L’admin exporte une archive de transfert complète comprenant morceaux, audios, médias EPK, documents, objets logiques et empreintes. Après connexion du nouveau provider, le mode Transférer le stockage réimporte les octets dans les mêmes objets logiques, sans dupliquer les données métier. Chaque nouvel emplacement est vérifié ; seuls les échecs sont relancés.

### Critères d’acceptation

- [ ] L’export de transfert contient tous les fichiers audio, médias EPK et documents référencés par le groupe.
- [ ] L’archive ne contient aucun credential, URL temporaire de provider ou secret serveur.
- [ ] La prévisualisation distingue objets à copier, déjà vérifiés, indisponibles et invalides.
- [ ] Le réimport force une copie physique vers la connexion active même si une empreinte identique existe sur l’ancien provider.
- [ ] Aucun morceau, EPK, document ou lien métier n’est dupliqué.
- [ ] Un nouvel emplacement ne devient principal qu’après vérification de taille, type et empreinte.
- [ ] Un échec laisse l’ancien emplacement principal et peut être relancé seul.
- [ ] Après transfert complet, la vue indique que l’ancienne connexion peut être déconnectée sans rendre de fichier indisponible.
- [ ] Un transfert interrompu conserve un rapport exploitable après rechargement.

## Bloquée par

- Phase 9 : EPK sur Google Drive
- Phase 10 : Suppression physique multi-provider
- Phase 11 : Changement de provider et coexistence
- Phase 12 : Continuité après départ de l’admin connecteur

---

## Phase 14 : Contrat d’extension des futurs providers

**User stories** : US-46

### Ce qu’on livre

Les capacités communes sont validées avec des providers non activés pour Dropbox, OneDrive et WebDAV/Nextcloud. Ils apparaissent uniquement comme possibilités futures, sans faux bouton de connexion. Les tests de contrat démontrent qu’un provider peut être ajouté sans modifier les parcours audio, offline, EPK, suppression ou changement de stockage.

### Critères d’acceptation

- [ ] Chaque futur provider possède un identifiant stable et une déclaration explicite de ses capacités.
- [ ] Aucun placeholder ne permet une connexion ou un upload incomplet en production.
- [ ] Les tests de contrat couvrent session d’upload, finalisation, lecture, téléchargement, suppression, quota et santé.
- [ ] Une capacité absente produit une erreur commune exploitable par l’interface.
- [ ] Ajouter un faux provider de test ne nécessite aucune modification des fonctionnalités métier audio ou EPK.
- [ ] La documentation d’extension précise les responsabilités de sécurité, reprise, quota et vérification.

## Bloquée par

- Phase 6 : Premier upload audio Google Drive
- Phase 7 : Lecture et téléchargement Google Drive
- Phase 9 : EPK sur Google Drive
- Phase 10 : Suppression physique multi-provider
- Phase 11 : Changement de provider et coexistence
