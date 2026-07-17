# FaderZero PWA

FaderZero est une app mobile-first pour groupes de musique. Elle sert a preparer les morceaux, organiser les setlists, gerer les audios utiles au live et lancer rapidement les outils de scene depuis un smartphone.

Ce README est volontairement centre sur l'utilisation de l'app.

## A quoi sert l'app

FaderZero permet de:

- garder tout le repertoire du groupe au meme endroit
- preparer une setlist de concert
- associer des fichiers audio a des morceaux
- utiliser un prompteur en situation de live
- lancer un metronome simple et rapide
- synchroniser les donnees d'un groupe entre plusieurs appareils
- partager un groupe via lien d'invitation

## Parcours type

1. se connecter
2. creer ou rejoindre un groupe
3. ajouter les morceaux du repertoire
4. importer les fichiers audio utiles
5. construire une ou plusieurs setlists
6. utiliser le prompteur, l'audio et le metronome pendant la repetition ou le live
7. synchroniser avec le groupe ou transferer en QR si besoin

## Premiere prise en main

### 1. Connexion

Au premier lancement, l'app propose:

- `Connexion`
- `Inscription`

Une fois connecte, vous retrouvez votre espace et vos groupes. Si vous ouvrez l'app avec un lien d'invitation, l'app vous guide directement vers l'acceptation du groupe.

### 2. Groupe / workspace

FaderZero fonctionne par groupe.

Vous pouvez:

- creer un nouveau groupe
- rejoindre un groupe avec un lien
- changer de groupe actif
- inviter quelqu'un dans le groupe courant

Le groupe actif definit les morceaux, setlists et synchronisations affiches dans l'app.

## Utilisation par ecran

### Repertoire

L'ecran `Repertoire` sert a gerer les chansons.

Vous pouvez:

- creer une nouvelle chanson
- rechercher dans le repertoire
- trier par titre ou mise a jour
- ouvrir une fiche chanson pour la completer

Chaque morceau peut contenir notamment:

- un titre
- des paroles
- une tonalite
- un BPM
- une duree
- un statut de preparation
- des notes

Usage typique:

1. creer une chanson
2. remplir paroles, tonalite, tempo et notes
3. revenir plus tard pour la finaliser avant la scene

### Musiques

L'ecran `Musiques` sert a importer et organiser les fichiers audio.

Vous pouvez:

- importer un ou plusieurs fichiers audio
- renommer ou remplacer un doublon a l'import
- associer un audio a une chanson
- lire un extrait depuis l'app
- choisir une piste principale quand une chanson a plusieurs fichiers
- mettre un fichier en cache hors ligne
- supprimer un fichier audio importé

Usage typique:

1. importer les pistes de travail ou de reference
2. les lier aux bons morceaux
3. telecharger en cache les morceaux necessaires avant un live sans reseau

### Setlists

L'ecran `Setlists` sert a preparer les listes de concert.

Vous pouvez:

- creer une setlist
- lui donner un nom
- ajouter des notes de contexte
- retrouver rapidement une setlist via la recherche
- ouvrir une setlist pour preparer l'ordre du live

Une setlist permet ensuite de piloter plus facilement le prompteur et la navigation morceau par morceau pendant le concert.

### Prompteur

L'ecran `Prompteur` est pensé pour la scene.

Vous pouvez:

- ouvrir toutes les chansons ou une setlist precise
- choisir un morceau
- afficher les paroles en grand
- regler la taille du texte
- regler la vitesse de defilement
- passer au morceau precedent ou suivant
- activer le plein ecran

Usage typique:

1. ouvrir la setlist du concert
2. choisir le morceau courant
3. regler le texte et la vitesse
4. enchainer les morceaux sans quitter l'ecran

### Metronome

L'ecran `Metronome` sert a lancer un clic rapide.

Vous pouvez:

- regler le BPM
- utiliser le `Tap tempo`
- regler le nombre de temps par mesure
- lancer ou stopper le clic

Il est utile pour la repetition, le calage d'un titre ou une verification rapide avant de jouer.

### Sync

L'ecran `Sync` couvre deux usages differents.

#### Synchronisation cloud

Vous pouvez:

- voir le compte connecte
- voir le groupe actif
- consulter les modifications en attente
- lancer une synchronisation manuelle
- gerer les conflits si deux versions divergent

Cas d'usage:

- recuperer les changements du groupe
- pousser vos modifications
- arbitrer un conflit entre votre version et celle du groupe

#### Transfert QR

Vous pouvez aussi transferer des donnees localement via QR.

Cela permet:

- d'exporter les donnees locales en QR successifs
- de scanner un transfert depuis un autre appareil
- de previsualiser l'import avant confirmation

Pratique quand:

- vous n'avez pas de backend disponible
- vous voulez depanner rapidement entre deux appareils
- vous etes dans un contexte reseau complique

### Compte

L'ecran `Compte` regroupe la gestion personnelle et la gestion des groupes.

Vous pouvez:

- voir l'adresse e-mail connectee
- changer de groupe actif
- creer un groupe
- rejoindre un groupe avec un lien
- generer et copier un lien d'invitation
- changer votre mot de passe
- vider le cache audio local
- vous deconnecter

## Usage hors ligne

L'app est pensee pour rester utile meme sans connexion.

Concretement:

- les donnees de travail restent disponibles localement
- les modifications peuvent attendre la prochaine synchronisation
- les fichiers audio mis en cache restent accessibles hors ligne

Pour un usage scene, il est recommande de:

1. ouvrir l'app une fois avant le live
2. verifier que la bonne setlist est chargee
3. telecharger en cache les audios utiles
4. verifier la synchronisation avant de passer hors reseau

## A qui s'adresse FaderZero

L'app vise surtout:

- les groupes qui repetent depuis un smartphone
- les musiciens qui veulent un repertoire toujours accessible
- les formations qui ont besoin d'un prompteur simple et rapide
- les groupes qui partagent morceaux, setlists et ressources entre plusieurs membres

## Installation rapide

Si vous voulez lancer l'app en local:

```bash
npm install
npm run dev
```

Configurer ensuite `.env` a partir de `./.env.example` avec:

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

## Liens utiles pour l'exploitation

- synchro Supabase: `docs/SUPABASE_SYNC.md`
- deploiement Android / Tailscale: `docs/TAILSCALE_ANDROID_DEPLOY.md`
- SQL Supabase: `supabase/sql`

## Etat du README

Ce README decrit d'abord l'experience utilisateur. La documentation technique plus detaillee reste dans `docs/`, `supabase/` et le code.
