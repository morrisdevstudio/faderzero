# Plan : parcours d’inscription et de création de groupe

> PRD source : `docs/PRD.md`

## Décisions architecturales

- **Routes** : l’accueil initial utilise `/onboarding` ; la création d’un groupe utilise `/groups/new`, puis `/groups/:workspaceId/setup` après sa création. Les destinations finales réutilisent les routes existantes de morceau, d’EPK, de membres et d’accueil. Une invitation reçue garde la priorité sur l’accueil initial.
- **Schéma** : `profiles.onboarding_completed_at` distingue les nouveaux comptes des comptes ayant terminé l’accueil. Les profils déjà présents lors de la migration sont marqués comme terminés. L’absence de connexion dans `workspace_storage_connections` signifie « texte seul » pour un nouveau groupe ; les connexions historiques restent intactes.
- **Modèles clés** : le profil porte le pseudo et la photo ; le groupe porte l’identité et les membres ; sa connexion de stockage détermine si les fichiers sont disponibles. L’étape courante du tunnel est conservée par compte et groupe pour résister au rechargement et au retour Google, sans créer deux fois le groupe.
- **Authentification et autorisation** : les inscriptions Google et e-mail confirmé rejoignent le même accueil. Les connexions de comptes existants restent directes. Seul un administrateur peut connecter le stockage et créer un lien d’invitation ; les autres rôles ne gagnent aucun droit.
- **Services externes** : l’authentification Google reste distincte de l’autorisation Google Drive. Le retour Drive peut mener au tunnel ou à la page Stockage habituelle selon l’origine de la demande. Le nom affiché par Google dépend de la validation de la marque ; aucune modification du domaine Auth n’est prévue.
- **Validation commune** : chaque phase comprend des vérifications ciblées et `verify:fast` ; la livraison du parcours complet comprend `verify:full`, les contrôles mobile à 320 px et les scénarios de retour OAuth.

---

## Phase 1 : premier accueil et premier morceau

**User stories** : US-1 à US-5, US-15, US-16.

### Ce qu’on livre

Une personne nouvellement inscrite avec Google ou par e-mail confirmé arrive sur un écran de pseudo avec photo facultative et pastille à initiales par défaut. Elle choisit ensuite « Créer un morceau » ou « Créer un groupe ». Le premier choix ouvre directement le nouveau morceau dans son espace personnel ; le second mène provisoirement à la création de groupe existante, que la phase 2 remplacera. Une invitation reçue est traitée avant cet accueil, et un compte existant ne le revoit pas.

### Critères d’acceptation

- [ ] Le pseudo de 2 à 30 caractères est enregistré après la première connexion, quelle que soit la méthode d’inscription ; l’inscription e-mail n’exige plus ce pseudo avant la confirmation.
- [ ] La photo peut être ajoutée ou ignorée ; dans ce dernier cas, les initiales sont visibles.
- [ ] « Créer un morceau » ouvre sa création dans l’espace personnel ; « Créer un groupe » ouvre un parcours de création fonctionnel.
- [ ] Une invitation reçue et les comptes déjà existants conservent leurs chemins respectifs, y compris après rechargement.

## Bloquée par

Aucune — démarrable immédiatement.

---

## Phase 2 : groupe et mode texte seul

**User stories** : US-6 à US-10, US-17 ; complète le choix « groupe » de US-4.

### Ce qu’on livre

Depuis l’accueil initial ou les paramètres, le même tunnel permet de nommer un groupe et d’arriver au choix du stockage. Il présente Google Drive, « Ignorer » et FaderZero Cloud « À venir » désactivé. Avant « Ignorer », il explique que les audios, photos et documents exigent un stockage. Le groupe créé reste utilisable pour le texte et les liens. Les ajouts de fichiers sont bloqués avec une action adaptée au rôle, et un EPK peut rester en brouillon texte et liens sans pouvoir être publié. Les groupes existants gardent leur stockage actuel.

### Critères d’acceptation

- [ ] La création valide le nom, signale un doublon et ouvre l’étape Stockage sans laisser la personne sur la page des paramètres.
- [ ] « Ignorer » affiche l’avertissement avant de continuer ; FaderZero Cloud est visible mais ne peut pas être choisi.
- [ ] Sans stockage, un membre peut créer un morceau textuel et préparer un EPK texte et liens, mais ne peut ajouter aucun fichier ni publier cet EPK.
- [ ] Une tentative d’ajout de fichier donne à l’administrateur l’accès à la configuration ; un autre membre voit qu’un administrateur doit agir. Aucun envoi ne bascule silencieusement vers FaderZero Cloud.
- [ ] Les groupes existants continuent à utiliser leurs fichiers et leur destination de stockage.

## Bloquée par

- Phase 1 pour le point d’entrée après inscription ; le point d’entrée depuis les paramètres reste utilisable seul.

---

## Phase 3 : Google Drive et reprise du tunnel

**User stories** : US-7, US-11, US-14.

### Ce qu’on livre

À l’étape Stockage, l’administrateur peut autoriser Google Drive. Après succès, annulation ou échec, il revient au groupe en cours de création avec un résultat explicite et peut avancer, réessayer ou continuer sans stockage. Le tunnel reprend à l’étape atteinte après un rechargement, sans recréer le groupe. Une connexion Drive lancée depuis les paramètres continue à revenir à la page Stockage habituelle.

### Critères d’acceptation

- [ ] Une autorisation réussie montre Google Drive connecté au bon groupe, puis ouvre l’étape d’invitation du tunnel.
- [ ] Une annulation, une expiration ou une erreur laisse le groupe intact et offre « Réessayer » et « Continuer sans stockage ».
- [ ] Recharger l’app ou revenir de Google restaure le même groupe et l’étape appropriée ; aucun groupe en double n’apparaît.
- [ ] Le retour Drive demandé depuis les paramètres conserve le parcours existant.

## Bloquée par

- Phase 2.

---

## Phase 4 : invitation et premières actions

**User stories** : US-12, US-13 ; achève US-14.

### Ce qu’on livre

Après le stockage connecté ou ignoré, le tunnel propose un lien d’invitation pour un membre, à copier ou à partager, ainsi qu’une action « Ignorer ». Son dernier écran propose « Créer un morceau », « Créer un EPK », « Inviter des membres » et « Explorer le groupe ». Chaque choix sort du tunnel vers la bonne destination ; les choix déjà faits ne sont pas redemandés après rechargement.

### Critères d’acceptation

- [ ] Le lien d’invitation créé est utilisable ; copie et partage fonctionnent, avec un message clair en cas d’échec.
- [ ] « Ignorer » mène au dernier écran sans empêcher une invitation ultérieure.
- [ ] Les quatre actions finales ouvrent respectivement la création d’un morceau du groupe, l’éditeur d’EPK, les invitations et l’accueil du groupe.
- [ ] Après la sortie du tunnel, une connexion ou un rechargement n’affiche plus ses étapes terminées.

## Bloquée par

- Phase 2 ; le retour Google Drive de la phase 3 doit rejoindre cette étape avant de livrer le parcours Drive complet.

---

## Phase 5 : nom FaderZero sur les écrans Google

**User stories** : US-18.

### Ce qu’on livre

Les écrans de consentement utilisés pour la connexion et Google Drive présentent FaderZero comme nom de l’application après configuration et validation de la marque Google. Les personnes utilisant le tunnel ou la page Stockage voient la même identité. Le fonctionnement existant de la connexion et du stockage est revérifié après cette configuration.

### Critères d’acceptation

- [ ] Un nouvel utilisateur voit FaderZero comme nom de l’application lors de la connexion Google.
- [ ] Un administrateur voit FaderZero comme nom de l’application lors de la connexion Google Drive.
- [ ] Les deux retours Google ramènent à l’écran attendu, sans erreur de redirection.
- [ ] Une adresse technique éventuellement présente dans les détails est distinguée du nom de l’application.

## Bloquée par

Aucune phase de code ; dépend de l’accès à la configuration des deux applications Google et de la validation de la marque.
