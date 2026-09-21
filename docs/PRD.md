## Problème

L’admin d’un groupe FaderZero n’a pas de copie autonome du répertoire. Les morceaux, les paroles et les fichiers audio vivent dans l’app. S’il quitte FaderZero, perd l’accès au compte, ou veut simplement une sauvegarde qu’il range lui-même, il ne récupère pas un dossier lisible : titres, paroles ouvrables dans n’importe quel éditeur, fichiers audio écoutables. Une restauration après une suppression ou un changement d’infrastructure n’existe pas non plus.

En parallèle, un groupe qui arrive avec déjà des dizaines ou des centaines de morceaux sur disque doit recréer chaque titre un par un, puis rattacher les audios. Sans archive portable, une sauvegarde resterait collée à FaderZero. Sans import massif, l’arrivée d’un catalogue existant reste bloquante.

C’est devenu urgent parce que le répertoire audio est déjà réel : la portabilité et une copie de secours lisible hors de l’app sont nécessaires, et le même geste doit pouvoir avaler un dossier historique.

## Solution

L’admin télécharge, depuis les données du groupe, une archive autonome du **répertoire de morceaux** : métadonnées, paroles, fichiers audio. Il peut l’ouvrir sans FaderZero, la ranger où il veut, puis la réimporter plus tard dans ce groupe. Il peut aussi déposer un dossier (ou une archive de dossier) préparé à la main — un sous-dossier par morceau, un fichier de paroles, des fichiers audio. FaderZero analyse d’abord, montre ce qu’il a compris, signale les problèmes, et n’envoie rien avant confirmation.

L’export est strict et lisible. L’import est tolérant. Cette première version couvre le répertoire seulement ; setlists, EPK et le reste du groupe viendront plus tard dans le même type d’archive.

## Utilisateur cible

L’admin du groupe : souvent le musicien qui gère déjà Compte et paramètres. Il s’en sert d’abord sur téléphone, aussi sur ordinateur. Un membre ou un invité ne voit pas l’export, ni l’import, ni la restauration.

## User Stories

US-1. En tant qu’admin du groupe, je veux exporter tout le répertoire de morceaux depuis les données du groupe, afin d’obtenir une copie que je range moi-même.

US-2. En tant qu’admin, je veux choisir d’inclure les fichiers audio ou les données seulement, afin d’éviter un fichier trop lourd si besoin.

US-3. En tant qu’admin, je veux voir le nombre de morceaux, d’audios et la taille estimée avant de créer l’archive, afin de décider sur téléphone si je lance un export complet.

US-4. En tant qu’admin, je veux qu’un export « données uniquement » m’avertisse clairement que les audios ne pourront pas être restaurés, afin de ne pas croire que c’est une sauvegarde complète.

US-5. En tant qu’admin, je veux ouvrir l’archive hors FaderZero et y retrouver un dossier par morceau, des paroles lisibles et des fichiers audio écoutables, afin de ne pas dépendre de l’app.

US-6. En tant qu’admin, je veux réimporter une archive FaderZero dans le groupe, afin de récupérer le répertoire après une perte.

US-7. En tant qu’admin, je veux importer un dossier — ou une archive de dossier — préparé à la main, un sous-dossier par morceau, afin d’amener un catalogue existant sans tout recréer.

US-8. En tant qu’admin, je veux une prévisualisation avant tout envoi (morceaux détectés, paroles, audios, taille, avertissements, erreurs), afin de corriger ou d’exclure avant de lancer.

US-9. En tant qu’admin, je veux confirmer l’import des éléments valides, afin que rien ne parte sans mon accord.

US-10. En tant qu’admin, je veux annuler à la prévisualisation, afin de ne rien modifier dans le groupe.

US-11. En tant qu’admin, je veux qu’un fichier invalide ou manquant soit signalé sur ce morceau sans bloquer les autres, afin d’importer quand même ce qui est bon.

US-12. En tant qu’admin, je veux qu’un fichier altéré par rapport à l’archive soit signalé avant l’import, afin de ne pas restaurer un audio corrompu à mon insu.

US-13. En tant qu’admin, je veux être bloqué avant l’envoi si le quota de durée audio du groupe ne suffit pas, avec la durée manquante et la taille à envoyer, afin de libérer de l’espace ou de retirer des fichiers.

US-14. En tant qu’admin, je veux que les fichiers déjà présents (même contenu) soient réutilisés et ne reconsomment pas de quota, afin de ne pas compter deux fois le même audio.

US-15. En tant qu’admin, je veux qu’un morceau déjà présent soit proposé par défaut en « mettre à jour », avec les choix « créer un nouveau morceau » ou « ignorer », afin de restaurer sans dupliquer.

US-16. En tant qu’admin, je veux appliquer cette décision à tous les conflits similaires, afin de ne pas répondre cent fois.

US-17. En tant qu’admin, je veux que « mettre à jour » remplace les infos et paroles par celles de l’archive, ajoute les audios manquants, et ne supprime aucun audio déjà là, afin qu’une vieille sauvegarde n’efface pas un enregistrement plus récent.

US-18. En tant qu’admin, si un fichier échoue en cours d’import, je veux garder ce qui a réussi et voir les échecs dans le rapport, afin de ne pas tout perdre.

US-19. En tant qu’admin, je veux un rapport final (créés, mis à jour, ignorés, erreurs, audios envoyés ou déjà présents), afin de vérifier le résultat.

US-20. En tant qu’admin, je veux suivre la progression (analyse, envoi, finalisation) sur téléphone, afin de savoir que ça avance pendant un gros fichier.

US-21. En tant qu’admin hors ligne, je veux que export et import soient indisponibles avec une explication, afin de ne pas lancer une action qui ne peut pas finir.

US-22. En tant que membre ou invité, je veux ne voir ni export ni import des données du groupe, afin de ne pas toucher à la sauvegarde du répertoire.

US-23. En tant qu’admin, je veux qu’une archive d’une version non prise en charge soit refusée avec un message, afin de ne pas lancer un import cassé.

US-24. En tant qu’admin, je veux importer les morceaux encore valides d’une archive incomplète, afin de récupérer ce qui reste.

US-25. En tant qu’admin, je veux qu’une archive dangereuse ou illisible soit refusée tout de suite, afin de ne pas compromettre l’appareil ou le groupe.

US-26. En tant qu’admin, je veux importer un dossier sans fichier technique : le nom du dossier donne le titre, un fichier de paroles est reconnu, un préfixe DEMO / MASTER / etc. donne le type, afin de préparer le catalogue à la main.

US-27. En tant qu’admin, je veux voir un type audio proposé plutôt que refusé quand le nom est ambigu, afin de corriger à la prévisualisation.

US-28. En tant qu’admin, je veux un message s’il n’y a aucun morceau à exporter, afin de ne pas télécharger une archive inutile.

US-29. En tant qu’admin, si le dépôt ne contient aucun morceau exploitable, je veux le voir à la prévisualisation sans import possible, afin de corriger le dossier.

US-30. En tant qu’admin, je veux qu’un morceau sans paroles ou sans audio reste exportable et importable, afin de ne pas perdre un titre incomplet.

US-31. En tant qu’admin, je veux que deux morceaux au même titre restent deux morceaux dans l’archive (dossiers distincts), afin de ne pas les écraser.

US-32. En tant qu’admin, je veux que le titre réel du morceau soit conservé même si le nom de dossier a été simplifié, afin de retrouver le titre avec ses caractères spéciaux dans FaderZero.

US-33. En tant qu’admin, après export, suppression du morceau, puis import, je veux retrouver un morceau équivalent (titre, artiste, BPM, tonalité, notes, paroles mises en forme, audios et types), afin de faire confiance à la sauvegarde.

US-34. En tant qu’admin, je veux que l’analyse se fasse avant tout envoi, afin de ne pas transférer un gros fichier pour découvrir une erreur de structure.

US-35. En tant qu’admin sur téléphone, je veux pouvoir choisir un fichier d’archive ou un dossier quand l’appareil le permet, afin de ne pas dépendre d’un ordinateur.

## Critères de succès

1. Un admin exporte le répertoire depuis les données du groupe et obtient un fichier téléchargeable.
2. En ouvrant cette archive hors FaderZero, on voit un dossier par morceau, un fichier de paroles lisible, et les fichiers audio écoutables.
3. Après export → suppression des morceaux → import, chaque morceau réapparaît avec le même titre, artiste, BPM, tonalité, notes, paroles (y compris la mise en forme FaderZero si elle existait), fichiers audio et types (Démo, Master, etc.).
4. Un admin dépose un dossier maison (sous-dossiers = morceaux, fichier de paroles, fichiers audio) : une prévisualisation s’affiche (nombre de morceaux, audios, taille) **avant** tout envoi.
5. Rien n’est envoyé tant que l’admin n’a pas confirmé l’import des éléments valides.
6. Un fichier audio invalide ou manquant est signalé sur ce morceau ; les autres morceaux valides restent importables.
7. Un fichier altéré par rapport à l’archive est signalé **avant** l’import.
8. Si le quota de durée audio du groupe ne suffit pas, l’import est bloqué **avant** l’envoi, avec la durée manquante et la taille à envoyer.
9. Réimporter la même archive propose : mettre à jour, créer un nouveau morceau, ou ignorer — avec « appliquer à tous les conflits similaires ».
10. À la fin, un rapport indique créés / mis à jour / ignorés / erreurs.
11. Un membre (non admin) ne voit ni export ni import.
12. Un export « données uniquement » affiche clairement que les fichiers audio ne pourront pas être restaurés.
13. Une archive d’une version non prise en charge est refusée avec un message, sans tentative d’import.

## Hors périmètre

- Setlists, EPK, contacts, dépenses, calendrier, et le reste du groupe.
- Sauvegarde automatique, planifiée, ou stockée « chez FaderZero » : l’admin télécharge le fichier et le range lui-même.
- Reprise d’un import coupé (réseau, onglet fermé) : v1 s’arrête ; l’admin relance.
- Fusion automatique de morceaux « à peu près » identiques.
- Import depuis un autre service (Drive, Dropbox, Spotify, etc.).
- Archive chiffrée, mot de passe, ou lien de partage FaderZero.
- Export / import par un membre ou un invité.
- Restauration qui écrase tout le groupe sans prévisualisation ni choix morceau par morceau.
- Un outil hors de l’app pour fabriquer ou modifier l’archive.
- Un historique de sauvegardes dans l’app (liste des archives passées).
- Export d’un seul morceau depuis la fiche ou la liste : v1 exporte le répertoire entier depuis les données du groupe.

## Décisions d’implémentation

- Export et import sont dans **Données du groupe** seulement. Pas d’action dans la fiche morceau ni de sélection multiple dans la liste.
- L’export v1 couvre **tout le répertoire** de morceaux du groupe (infos, paroles, audios), pas un sous-ensemble.
- L’admin choisit : inclure les fichiers audio, ou données uniquement. Données uniquement = avertissement visible : cette archive ne restaure pas les audios.
- Avant de créer l’archive : nombre de morceaux, nombre d’audios, taille estimée.
- Export et import **uniquement en ligne**. Hors ligne, l’action est visible mais indisponible, avec une phrase d’explication.
- Pour importer / restaurer : un fichier d’archive, ou un dossier quand l’appareil le permet.
- Aucun import ne démarre à la sélection du fichier ou du dossier. Analyse locale d’abord, puis écran de prévisualisation, puis confirmation.
- Prévisualisation : morceaux valides, avertissements (paroles absentes, BPM inconnu, type audio proposé), erreurs (fichier manquant, format non supporté, fichier altéré). Actions : Annuler, ou Importer les éléments valides.
- Titre d’un morceau, par priorité : infos de l’archive FaderZero → nom du dossier → nom du fichier audio si le morceau est isolé.
- Paroles, par priorité : paroles mises en forme FaderZero → fichier de paroles texte → aucune parole.
- Type d’audio, par priorité : infos de l’archive → convention de nom de fichier → type Autre. Types stables : Démo, Répétition, Mix, Master, Live, Autre.
- Convention recommandée pour un dossier maison : `TYPE__DATE__DESCRIPTION` (la date et la description peuvent manquer). Le nom de fichier n’est pas la vérité si l’archive FaderZero décrit déjà le fichier.
- L’admin n’a pas à écrire de fichier technique pour un import maison.
- Un fichier invalide n’interrompt pas tout l’import : erreur individuelle.
- Si l’empreinte d’un fichier ne correspond pas à celle de l’archive, avertissement **avant** import ; l’admin peut quand même importer les éléments valides.
- Quota : afficher la taille à envoyer (Mo / Go) ; **bloquer** sur la durée audio du groupe, comme aujourd’hui. Un fichier déjà présent (même contenu) est réutilisé et ne recompte pas.
- Conflit de morceau déjà présent : par défaut **Mettre à jour**, sinon créer un nouveau morceau, sinon ignorer. Case : appliquer à tous les conflits similaires. Politiques globales : toujours créer une copie / toujours mettre à jour la correspondance exacte / toujours ignorer. Les correspondances approximatives ne fusionnent jamais toutes seules.
- Mettre à jour = les infos et paroles de l’archive remplacent celles du morceau ; les audios de l’archive s’ajoutent s’ils n’y sont pas déjà ; aucun audio déjà dans FaderZero n’est supprimé.
- Un identifiant d’origine dans l’archive sert à reconnaître un morceau **dans ce groupe**, jamais à l’imposer comme nouvel identifiant.
- Si un fichier échoue pendant l’import : on **garde** ce qui a réussi (morceau et audios OK) ; le rapport liste les fichiers en échec.
- Rapport final : morceaux analysés, créés, mis à jour, ignorés ; audios envoyés, déjà présents, en erreur ; lien vers les détails.
- Progression visible sur téléphone, avec distinction analyse / envoi / finalisation, morceau en cours, compteurs (morceaux et volume).
- Archive d’une version inconnue : refus immédiat, message du type « Cette archive utilise une version qui n’est pas encore prise en charge. »
- Archive incomplète ou partiellement endommagée : les morceaux encore valides restent importables ; le rapport dit ce qui manque.
- Archive dangereuse (chemins qui sortent du dossier, contenu illisible) : refus immédiat.
- Noms de dossiers d’export : caractères interdits remplacés ; le titre réel du morceau reste intact dans les infos. Deux titres identiques → dossiers distincts lisibles (Intro, Intro (2)).
- Accents, paroles internationales et symboles musicaux sont conservés.
- Téléphone = usage de premier plan : les flux doivent tenir dans l’écran, rester utilisables pendant un long envoi, et laisser choisir « données uniquement » si la taille affichée est trop lourde. L’ordinateur n’est pas un prérequis.

## Notes complémentaires

- Une archive avec audio peut peser plusieurs Go : sur téléphone ce sera long. La taille estimée, la progression et l’export sans audio existent pour que ça reste tenable, pas pour renvoyer l’admin vers un ordinateur.
- Le quota reste en durée, pas en poids de fichiers. La taille en Go est une information d’envoi.
- Un import interrompu n’est pas repris : l’admin relance. Des morceaux partiels peuvent déjà être là (on garde ce qui a réussi).
- Une archive de cette version ne restaure pas tout le groupe (setlists, EPK, etc.) : ces catégories viendront plus tard.
- L’admin range le fichier lui-même : FaderZero ne conserve pas d’historique de sauvegardes.
