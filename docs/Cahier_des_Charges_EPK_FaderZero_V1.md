# Cahier des Charges Technico-Fonctionnel — EPK Public FaderZero V1

## 1. Objectif

FaderZero doit permettre à un groupe de créer et publier un **EPK public professionnel** (*Electronic Press Kit*) accessible via une URL unique :

`https://faderzero.com/[slug-groupe]`

Exemple :

`https://faderzero.com/echopulse`

L'objectif de cette V1 est simple :

> Permettre à un professionnel de comprendre rapidement qui est le groupe, voir ou écouter son travail, récupérer les documents utiles et savoir qui contacter.

Le développement doit rester strictement limité aux exigences décrites dans ce document.

**Ne pas implémenter de fonctionnalité, abstraction, structure de données ou composant qui n'est pas nécessaire à cette V1.**

---

## 2. Utilisateurs

### 2.1 Gestionnaire de l'EPK

Un membre autorisé du groupe peut :

- créer l'EPK ;
- modifier son contenu ;
- ajouter ou supprimer des médias ;
- ajouter ou supprimer des documents ;
- gérer les contacts ;
- prévisualiser la page ;
- publier ou dépublier l'EPK.

### 2.2 Visiteur

L'EPK public est principalement destiné à :

- programmateurs ;
- salles ;
- festivals ;
- tourneurs ;
- bookers ;
- régisseurs ;
- techniciens ;
- médias ;
- partenaires professionnels.

Aucun compte ne doit être nécessaire pour consulter un EPK publié.

---

## 3. Principes UX

### 3.1 Consultation rapide

L'EPK doit être pensé pour une consultation rapide, particulièrement sur smartphone.

Le visiteur doit pouvoir identifier rapidement :

1. qui est le groupe ;
2. quel type de musique il joue ;
3. quel média écouter ou regarder ;
4. où trouver les photos et documents utiles ;
5. qui contacter.

### 3.2 Mobile-first

L'interface publique doit être conçue en priorité pour smartphone puis adaptée aux écrans plus larges.

Aucune fonctionnalité essentielle ne doit dépendre du survol de la souris.

### 3.3 Contenu facultatif

La majorité des contenus sont facultatifs.

Une section sans contenu ne doit jamais apparaître sur la page publique.

Exemples :

- aucune vidéo → aucune section vidéo ;
- aucun lien Spotify → aucun bouton Spotify ;
- aucune fiche technique → aucun bouton de téléchargement ;
- aucune galerie → aucune section Photos ;
- aucun téléphone → aucun bouton Téléphone.

La mise en page doit automatiquement se recomposer selon les contenus disponibles.

### 3.4 Publication avec peu de contenu

Un groupe doit pouvoir publier un EPK simple avec au minimum :

- nom du groupe ;
- genre ;
- localisation ;
- une image ou un média principal ;
- au moins un moyen de contact.

Les autres contenus enrichissent l'EPK mais ne bloquent pas sa publication.

---

## 4. URL publique

Chaque EPK possède une URL publique :

`faderzero.com/[slug-groupe]`

### 4.1 Slug

Le slug doit :

- être unique ;
- être en minuscules ;
- ne pas contenir d'espaces ;
- normaliser les caractères accentués ;
- refuser les slugs réservés par l'application.

Exemple :

`Les Étoiles Noires` → `les-etoiles-noires`

### 4.2 Validation

Le slug doit être vérifié avant publication.

---

## 5. États de publication

Un EPK possède deux états :

- `DRAFT`
- `PUBLISHED`

### 5.1 Draft

Un EPK en brouillon :

- est modifiable ;
- peut être prévisualisé par le groupe ;
- n'est pas accessible publiquement.

### 5.2 Published

Un EPK publié :

- est accessible via son URL publique ;
- reste modifiable depuis le back-office.

Une modification ou un enregistrement incomplet ne doit jamais rendre la page publique inutilisable.

---

## 6. Structure de la page publique

L'ordre général recommandé est :

1. Hero / identité ;
2. média principal ;
3. présentation ;
4. autres médias ;
5. photos ;
6. documents ;
7. contacts ;
8. liens externes.

Les sections absentes sont simplement retirées.

---

## 7. Hero / identité

Le haut de page affiche :

- nom du groupe ;
- genre musical ;
- ville ;
- pays facultatif ;
- image principale ;
- courte accroche facultative ;
- logo facultatif.

Le Hero doit rester relativement compact afin de laisser rapidement apparaître le contenu principal.

Le logo n'est jamais obligatoire.

---

## 8. Média principal

L'EPK possède un **média principal configurable**.

Il peut être :

- une vidéo ;
- un morceau audio ;
- une image.

Une vidéo live est recommandée lorsqu'elle existe, mais elle n'est jamais obligatoire.

### 8.1 Priorité recommandée

L'interface peut conseiller au groupe de privilégier :

1. vidéo live ;
2. live session ;
3. captation de répétition de bonne qualité ;
4. clip ;
5. morceau audio ;
6. photo.

Cette hiérarchie est une recommandation UX et ne doit pas bloquer la publication.

---

## 9. Vidéos

Le groupe peut ajouter plusieurs vidéos externes.

### 9.1 Sources supportées

V1 :

- YouTube ;
- Vimeo.

### 9.2 Données par vidéo

- titre facultatif ;
- URL ;
- type ;
- ordre d'affichage.

### 9.3 Types

- `LIVE`
- `LIVE_SESSION`
- `MUSIC_VIDEO`
- `INTERVIEW`
- `OTHER`

Une vidéo peut être sélectionnée comme média principal.

---

## 10. Audio

FaderZero propose un lecteur audio intégré.

### 10.1 Données par morceau

- titre ;
- fichier audio ;
- artwork facultatif ;
- description facultative ;
- ordre d'affichage ;
- visibilité.

### 10.2 Visibilité

Valeurs V1 :

- `PUBLIC`
- `UNLISTED`

Un morceau peut être sélectionné comme média principal.

### 10.3 Lecture web

Les fichiers utilisés pour la lecture doivent être servis dans un format adapté au streaming web.

Les fichiers excessivement lourds ne doivent pas être chargés directement dans le lecteur.

---

## 11. Plateformes musicales

Le groupe peut ajouter des liens facultatifs vers :

- Spotify ;
- Apple Music ;
- Qobuz ;
- Deezer ;
- Bandcamp ;
- YouTube Music ;
- autre plateforme pertinente.

Seules les plateformes configurées apparaissent.

---

## 12. Présentation du groupe

### 12.1 Accroche

Texte court facultatif affiché près du Hero.

Recommandation :

1 à 3 lignes.

### 12.2 Bio courte

Résumé rapide du groupe.

### 12.3 Bio complète

Texte facultatif plus détaillé.

Si la bio est longue, l'interface peut utiliser une action du type :

`Lire la suite`

afin de conserver une page compacte.

---

## 13. Photos presse

Le groupe peut créer une galerie de photos.

### 13.1 Données par photo

- aperçu optimisé pour le web ;
- fichier original HD ;
- crédit photo facultatif ;
- légende facultative ;
- ordre d'affichage.

### 13.2 Téléchargement

Le visiteur doit pouvoir télécharger la version HD d'une photo.

Les fichiers HD ne doivent pas être chargés automatiquement lors de l'ouverture de la page.

---

## 14. Documents

Le groupe peut importer des documents existants.

### 14.1 Types

Valeurs proposées :

- `TECH_RIDER`
- `STAGE_PLOT`
- `HOSPITALITY_RIDER`
- `PRESS_KIT`
- `LOGO`
- `OTHER`

### 14.2 Données par document

- titre ;
- type ;
- fichier ;
- date de mise à jour ;
- ordre d'affichage.

### 14.3 Fiche technique

Une fiche technique peut être mise en avant avec une action :

`Télécharger la fiche technique`

La date de dernière mise à jour doit pouvoir être affichée.

Exemple :

> Fiche technique — mise à jour le 18 août 2026

Si aucune fiche technique n'est disponible, aucun bouton correspondant n'est affiché.

---

## 15. Contacts

Le groupe peut ajouter plusieurs contacts.

### 15.1 Données par contact

- nom ;
- rôle ;
- organisation facultative ;
- email facultatif ;
- téléphone facultatif ;
- WhatsApp facultatif ;
- ordre d'affichage.

Au moins un moyen de contact doit être renseigné.

### 15.2 Rôles

- `BAND`
- `BOOKING`
- `MANAGEMENT`
- `TECH`
- `PRESS`
- `PRODUCTION`
- `OTHER`

Un groupe sans booker peut simplement afficher un contact de type `BAND`.

---

## 16. Réseaux sociaux et liens externes

Le groupe peut ajouter des liens facultatifs vers :

- Instagram ;
- Facebook ;
- YouTube ;
- TikTok ;
- site officiel ;
- autre lien pertinent.

Seuls les liens renseignés sont affichés.

---

## 17. Actions de la page publique

La page peut afficher les actions pertinentes selon son contenu :

- partager ;
- copier le lien ;
- écouter ;
- regarder ;
- télécharger la fiche technique ;
- télécharger une photo HD ;
- contacter le groupe.

### 17.1 Partage

Utiliser la Web Share API lorsque disponible.

Prévoir un fallback permettant de copier l'URL dans le presse-papier.

Après copie :

`Lien copié`

---

## 18. Métadonnées de partage

Chaque EPK publié doit produire des métadonnées adaptées au partage sur les messageries et réseaux sociaux.

Prévoir notamment :

- titre ;
- description ;
- image ;
- URL canonique.

Si aucune image spécifique n'est définie pour le partage, utiliser automatiquement la meilleure image disponible.

---

## 19. Back-office

Le groupe dispose d'une interface de gestion de son EPK.

### 19.1 Identité

- nom ;
- slug ;
- genre ;
- ville ;
- pays ;
- accroche ;
- image principale ;
- logo.

### 19.2 Présentation

- bio courte ;
- bio complète.

### 19.3 Médias

- sélection du média principal ;
- vidéos ;
- morceaux audio ;
- plateformes musicales.

### 19.4 Photos

- ajout ;
- suppression ;
- ordre ;
- crédit.

### 19.5 Documents

- ajout ;
- remplacement ;
- suppression ;
- type ;
- titre ;
- date de mise à jour.

### 19.6 Contacts

- ajout ;
- modification ;
- suppression ;
- ordre.

### 19.7 Liens

- réseaux sociaux ;
- site ;
- plateformes externes.

### 19.8 Publication

- état Draft / Published ;
- prévisualisation ;
- URL publique.

---

## 20. Indicateur de complétude

Le back-office peut afficher un indicateur informatif.

Exemple :

**EPK 70 % complet**

Suggestions possibles :

- Ajouter une vidéo live ;
- Ajouter une photo presse ;
- Ajouter une fiche technique.

Cet indicateur :

- n'empêche jamais la publication ;
- ne transforme pas les suggestions en champs obligatoires.

---

## 21. Performance

La performance de la page publique est prioritaire.

### 21.1 Images

Prévoir :

- images optimisées ;
- dimensions adaptées au viewport ;
- thumbnails ;
- lazy loading ;
- conservation séparée des fichiers HD.

### 21.2 Vidéos externes

Les embeds vidéo ne doivent pas ralentir inutilement le chargement initial.

### 21.3 Audio

Le lecteur doit éviter de télécharger tous les morceaux au chargement de la page.

---

## 22. Gestion des fichiers

Le système doit gérer :

- upload ;
- remplacement ;
- suppression ;
- erreurs d'upload ;
- validation de format ;
- limites de taille ;
- nettoyage des fichiers inutilisés.

Les limites doivent être configurables.

Prévoir notamment des limites pour :

- nombre de photos ;
- nombre de vidéos ;
- nombre de morceaux ;
- taille d'une photo ;
- taille d'un fichier audio ;
- taille d'un document.

Un fichier remplacé ou supprimé ne doit pas rester indéfiniment dans le stockage sans être référencé.

---

## 23. Modèle de données proposé

```typescript
interface Band {
  id: string;
  name: string;
}

interface EPK {
  id: string;
  bandId: string;

  slug: string;
  status: 'DRAFT' | 'PUBLISHED';

  genre: string[];
  city?: string;
  country?: string;

  tagline?: string;
  shortBio?: string;
  fullBio?: string;

  heroImageId?: string;
  logoImageId?: string;

  featuredMedia?: FeaturedMedia;

  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
}

interface FeaturedMedia {
  type: 'VIDEO' | 'AUDIO' | 'IMAGE';
  id: string;
}

interface Video {
  id: string;
  epkId: string;

  title?: string;
  url: string;

  type:
    | 'LIVE'
    | 'LIVE_SESSION'
    | 'MUSIC_VIDEO'
    | 'INTERVIEW'
    | 'OTHER';

  order: number;
}

interface AudioTrack {
  id: string;
  epkId: string;

  title: string;
  fileUrl: string;
  artworkUrl?: string;

  visibility: 'PUBLIC' | 'UNLISTED';

  order: number;
}

interface Photo {
  id: string;
  epkId: string;

  previewUrl: string;
  originalUrl: string;

  credit?: string;
  caption?: string;

  order: number;
}

interface EPKDocument {
  id: string;
  epkId: string;

  title: string;

  type:
    | 'TECH_RIDER'
    | 'STAGE_PLOT'
    | 'HOSPITALITY_RIDER'
    | 'PRESS_KIT'
    | 'LOGO'
    | 'OTHER';

  fileUrl: string;
  updatedAt: string;
  order: number;
}

interface Contact {
  id: string;
  epkId: string;

  name: string;

  role:
    | 'BAND'
    | 'BOOKING'
    | 'MANAGEMENT'
    | 'TECH'
    | 'PRESS'
    | 'PRODUCTION'
    | 'OTHER';

  organisation?: string;

  email?: string;
  phone?: string;
  whatsapp?: string;

  order: number;
}

interface ExternalLink {
  id: string;
  epkId: string;

  type: string;
  url: string;
  order: number;
}
```

---

## 24. Règles d'affichage adaptatif

### Groupe avec vidéo principale

```text
Hero
↓
Vidéo
↓
Présentation
↓
Audio
↓
Photos
↓
Documents
↓
Contacts
```

### Groupe sans vidéo mais avec audio

```text
Hero
↓
Morceau principal
↓
Présentation
↓
Photos
↓
Documents
↓
Contacts
```

### Groupe sans audio

```text
Hero
↓
Vidéo ou image principale
↓
Présentation
↓
Photos
↓
Documents
↓
Contacts
```

Une section vide est toujours supprimée.

---

## 25. Critères d'acceptation

La V1 est considérée fonctionnelle lorsque :

- [ ] un groupe peut créer un EPK ;
- [ ] un slug unique peut être attribué ;
- [ ] un EPK peut rester en brouillon ;
- [ ] un EPK peut être prévisualisé ;
- [ ] un EPK peut être publié ;
- [ ] un EPK publié est accessible sans authentification ;
- [ ] la page fonctionne correctement sur smartphone et ordinateur ;
- [ ] une image principale peut être ajoutée ;
- [ ] une vidéo peut être ajoutée ;
- [ ] une vidéo n'est pas obligatoire ;
- [ ] plusieurs vidéos peuvent être enregistrées ;
- [ ] un morceau audio peut être ajouté ;
- [ ] un morceau ou une vidéo peut être défini comme média principal ;
- [ ] plusieurs photos peuvent être ajoutées ;
- [ ] les photos HD peuvent être téléchargées ;
- [ ] plusieurs contacts peuvent être ajoutés ;
- [ ] aucun rôle de booking n'est obligatoire ;
- [ ] plusieurs documents peuvent être ajoutés ;
- [ ] une fiche technique PDF existante peut être importée ;
- [ ] les réseaux sociaux sont facultatifs ;
- [ ] les plateformes musicales sont facultatives ;
- [ ] toutes les sections sans contenu disparaissent automatiquement ;
- [ ] l'URL peut être copiée ;
- [ ] la page peut être partagée ;
- [ ] les métadonnées de partage sont générées ;
- [ ] remplacer ou supprimer un fichier ne casse pas la page publique ;
- [ ] la date de mise à jour d'un document peut être affichée ;
- [ ] l'interface reste exploitable avec peu de contenu ;
- [ ] aucune fonctionnalité non décrite dans ce document n'est nécessaire au fonctionnement de la V1.

---

## 26. Priorités d'implémentation

### P0 — indispensable

- URL publique ;
- slug ;
- Draft / Published ;
- prévisualisation ;
- identité ;
- Hero ;
- média principal adaptable ;
- vidéo externe ;
- lecteur audio ;
- présentation ;
- photos ;
- contacts ;
- documents ;
- fiche technique importée ;
- responsive ;
- partage ;
- gestion correcte des sections absentes.

### P1 — à intégrer si le socle P0 est terminé

- plusieurs vidéos ;
- téléchargement HD des photos ;
- métadonnées Open Graph ;
- indicateur de complétude ;
- optimisation avancée des médias.

---

## 27. Principe directeur pour l'agent codeur

Toute implémentation doit répondre à une exigence présente dans ce document.

En cas de doute :

1. rechercher d'abord si le besoin est explicitement décrit ;
2. réutiliser les composants, patterns et tokens existants du projet ;
3. ne pas inventer une nouvelle fonctionnalité ;
4. ne pas créer d'abstraction destinée à un besoin hypothétique ;
5. privilégier l'implémentation la plus simple qui satisfait les critères d'acceptation.

La priorité est de livrer une V1 claire, robuste et maintenable, sans anticiper des besoins non spécifiés.
