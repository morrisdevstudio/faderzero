# FaderZero

FaderZero est une PWA mobile-first pour les musiciens et les groupes : répertoire, paroles, setlists, médias, outils de scène et collaboration restent disponibles même lorsque la connexion est instable.

Application : [fader.pages.dev](https://fader.pages.dev)

## Ce que permet l’application

- Organiser un répertoire de morceaux (statut, tonalité, BPM, durée, notes et paroles).
- Créer des setlists, les réordonner, ajouter des annotations et les exporter en PDF.
- Importer, compresser et écouter des pistes audio ; les mettre en cache pour les utiliser hors ligne.
- Enregistrer rapidement des mémos vocaux et les associer à des morceaux.
- Préparer la scène avec un prompteur plein écran et un métronome avec Tap Tempo.
- Planifier répétitions, concerts et autres événements.
- Travailler seul ou à plusieurs dans des espaces partagés avec rôles et invitations.
- Synchroniser les changements avec Supabase ou transférer des données hors connexion par QR code.
- Créer et publier un EPK public pour un groupe.

## Compte et accès

L’application prend en charge l’inscription et la connexion par e-mail et mot de passe, la récupération de mot de passe et la modification d’adresse e-mail.

La connexion avec Google est également disponible :

- depuis l’écran de connexion ou d’inscription ;
- depuis le compte, afin d’associer Google à un compte e-mail existant ;
- avec retour sécurisé vers `/auth/callback`, qui restaure l’affichage de l’application après l’authentification.

Pour l’activer, configurez le fournisseur Google dans Supabase Auth et autorisez l’URL de redirection de chaque environnement, par exemple `https://fader.pages.dev/auth/callback`.

## Hors ligne et synchronisation

FaderZero suit une approche offline-first : les données métier sont enregistrées dans IndexedDB via Dexie, et les mutations sont placées dans une file de synchronisation avant leur envoi à Supabase. Les pistes téléchargées restent lisibles sans réseau. Le transfert QR permet d’échanger des données entre appareils lorsqu’aucune connexion n’est disponible.

Pour une utilisation sur scène, synchronisez l’espace et mettez les pistes nécessaires en cache avant le concert.

## Architecture

| Couche | Technologies |
| --- | --- |
| Interface | React 19, TypeScript strict, React Router 7, Tailwind CSS 4, Vite 8 |
| PWA et stockage local | `vite-plugin-pwa`, Service Worker, Dexie / IndexedDB |
| État et synchronisation | Zustand, file locale `syncQueue`, Supabase Auth / PostgreSQL / RLS |
| Audio | Encodage MP3 local avec LameJS, Cloudflare R2 et Worker audio |
| Déploiement | Cloudflare Pages |

## Structure du projet

```text
src/
├── app/            # Entrée, providers et routage
├── components/     # Composants UI partagés
├── db/             # Schéma Dexie, repositories et file de synchronisation
├── features/       # Modules : morceaux, setlists, scène, compte, EPK…
├── services/       # Supabase, audio et synchronisation
└── stores/         # État global Zustand
cloudflare/         # Workers Cloudflare (audio et EPK public)
supabase/           # Migrations, fonctions et configuration Supabase
docs/               # Spécifications et documents légaux
scripts/            # Vérifications et automatisations de développement
```

## Développer localement

### Prérequis

- Node.js `22.16.0`
- npm `10.9.2`

### Installation

```bash
npm install
```

Créez un fichier `.env.local` avec les paramètres de votre projet Supabase et du Worker audio :

```env
VITE_SUPABASE_URL=https://votre-projet.supabase.co
VITE_SUPABASE_ANON_KEY=votre-cle-anon-supabase
VITE_AUDIO_API_URL=https://votre-audio-worker.workers.dev
```

### Commandes utiles

```bash
npm run dev          # serveur Vite
npm run typecheck    # vérification TypeScript
npm run lint         # analyse statique
npm run test         # tests Vitest
npm run build        # build de production
npm run verify:fast  # typecheck + lint + tests
npm run dev:audio    # Worker audio local
```

`npm run verify:full` ajoute les validations des Workers, de la configuration Cloudflare, des en-têtes de sécurité et le build de déploiement.

## Documentation et cadre légal

- [Conditions générales d’utilisation](docs/legal/TERMS_OF_SERVICE.md)
- [Politique de confidentialité](docs/legal/PRIVACY_POLICY.md)
- [Mentions légales](docs/legal/LEGAL_NOTICES.md)
- [Spécifications fonctionnelles](docs/Cahier_des_Charges_EPK_FaderZero_V1.md)

## Licence

Projet privé. Tous droits réservés.
