import type { Language } from './landingContent';

type NarrativeItem = readonly [tag: string, title: string, description: string];

interface LandingNarrativeCopy {
  proof: readonly (readonly [title: string, detail: string])[];
  workflow: {
    label: string;
    title: string;
    description: string;
    items: readonly (readonly [number: string, title: string, description: string, glyph: string])[];
  };
  stage: {
    label: string;
    title: readonly [string, string];
    description: string;
    points: readonly string[];
    prompterLabel: string;
  };
  offline: {
    label: string;
    title: readonly [string, string];
    ready: string;
    badge: string;
    status: readonly (readonly [title: string, detail: string, state: string])[];
    heading: string;
    description: string;
    technologies: string;
  };
  features: {
    label: string;
    title: readonly [string, string];
    description: string;
    items: readonly NarrativeItem[];
  };
  epk: {
    label: string;
    title: string;
    description: string;
    cta: string;
    genre: string;
    listen: string;
    technical: string;
    contact: string;
  };
}

export const LANDING_NARRATIVE_CONTENT = {
  fr: {
    proof: [
      ['Pensé mobile', 'PWA mobile-first'],
      ['Joue sans réseau', 'Audio & données en cache'],
      ['Conçu pour un groupe', 'Espaces, rôles, invitations'],
      ['Du local au cloud', 'Sync quand ça revient'],
    ],
    workflow: {
      label: '01 — Le workflow',
      title: 'Une app qui suit le groupe. Pas l’inverse.',
      description: 'FaderZero rassemble ce qui finit d’habitude dans six apps, trois conversations et un dossier Drive. Le morceau reste le point central, de l’idée brute jusqu’à la scène.',
      items: [
        ['01 / CAPTURE', 'Enregistre l’idée.', 'Un mémo vocal au milieu de la répétition. Il reste attaché au bon morceau, avec les notes, le BPM, la tonalité et les paroles.', 'REC'],
        ['02 / PRÉPARE', 'Construis le set.', 'Réordonne les titres, note les transitions, garde les pistes utiles à portée de main et prépare la soirée sans multiplier les fichiers.', '≡'],
        ['03 / JOUE', 'Passe en mode scène.', 'Prompteur plein écran, métronome, Tap Tempo et contenu disponible hors connexion. Sur scène, l’outil s’efface derrière le concert.', '▶'],
      ],
    },
    stage: {
      label: '02 — Live mode',
      title: ['Sur scène,', 'zéro friction.'],
      description: 'Les outils utiles au concert sont lisibles, directs et accessibles en quelques secondes. Pas de tableau de bord à administrer pendant que le public attend.',
      points: ['Prompteur plein écran avec informations du morceau', 'Métronome et Tap Tempo directement dans l’app', 'Setlists annotées et réordonnables', 'Pistes téléchargées lisibles sans réseau'],
      prompterLabel: 'Prompteur live',
    },
    offline: {
      label: '03 — Offline first',
      title: ['Quand le réseau lâche,', 'le groupe continue.'],
      ready: 'Prêt pour la scène',
      badge: 'Hors ligne',
      status: [['Setlist — Live Nantes', '7 morceaux disponibles', 'LOCAL'], ['Pistes audio', '5 fichiers téléchargés', 'OK'], ['Paroles & notes', 'Dernière synchro 18:42', 'OK'], ['Modifications', '2 changements en attente', 'QUEUE']],
      heading: 'La connexion devient une option, pas une condition.',
      description: 'Répète dans une cave, joue dans une salle saturée, prépare un set dans le train. FaderZero garde le nécessaire localement et synchronise les changements dès que possible.',
      technologies: 'Données locales · File de synchronisation · Audio en cache · Transfert QR',
    },
    features: {
      label: '04 — Tout au même endroit',
      title: ['Moins d’outils.', 'Plus de musique.'],
      description: 'Chaque fonction a une raison d’être dans le flux réel d’un groupe. Rien n’est là pour remplir une fiche produit.',
      items: [['Répertoire', 'Morceaux & paroles', 'Statut, tonalité, BPM, durée, notes et paroles restent regroupés autour du morceau.'], ['Audio', 'Pistes & mémos', 'Importe, écoute et télécharge les pistes utiles. Capture aussi une idée vocale sans casser le rythme.'], ['Live', 'Prompteur', 'Un affichage dédié à la scène pour les paroles et les informations essentielles du morceau.'], ['Préparation', 'Setlists', 'Crée, réordonne et annote tes sets. Exporte-les en PDF quand il faut les partager.'], ['Timing', 'Métronome', 'Tempo, Tap Tempo et accès direct depuis le workflow de répétition ou de scène.'], ['Équipe', 'Collaboration', 'Espaces partagés, rôles et invitations pour que tout le groupe travaille sur la même base.'], ['Agenda', 'Répètes & concerts', 'Planifie les événements du groupe sans séparer l’agenda du reste de la préparation musicale.']],
    },
    epk: {
      label: '05 — Côté pro',
      title: 'Et quand il faut se présenter, le groupe est déjà prêt.',
      description: 'FaderZero permet aussi de publier un EPK public : un lien propre pour envoyer bio, musique, médias, informations professionnelles et contact.',
      cta: 'Créer l’espace du groupe →',
      genre: 'Rock · Nantes, FR · Booking 2026',
      listen: 'Écouter',
      technical: 'Fiche technique',
      contact: 'Contact',
    },
  },
  en: {
    proof: [
      ['Built for mobile', 'Mobile-first PWA'],
      ['Play without a network', 'Cached audio & data'],
      ['Made for a band', 'Workspaces, roles, invites'],
      ['From local to cloud', 'Sync when connection returns'],
    ],
    workflow: {
      label: '01 — The workflow',
      title: 'An app that follows the band. Not the other way around.',
      description: 'FaderZero brings together what usually ends up across six apps, three conversations, and a Drive folder. The song stays at the center, from the first idea to the stage.',
      items: [
        ['01 / CAPTURE', 'Record the idea.', 'Capture a voice memo during rehearsal. It stays attached to the right song, alongside notes, BPM, key, and lyrics.', 'REC'],
        ['02 / PREPARE', 'Build the set.', 'Reorder songs, note transitions, keep useful tracks close, and prepare the show without multiplying files.', '≡'],
        ['03 / PLAY', 'Switch to stage mode.', 'Fullscreen prompter, metronome, Tap Tempo, and offline content. On stage, the tool gets out of the way of the show.', '▶'],
      ],
    },
    stage: {
      label: '02 — Live mode',
      title: ['On stage,', 'zero friction.'],
      description: 'The tools you need during a show are readable, direct, and seconds away. No dashboard to manage while the audience is waiting.',
      points: ['Fullscreen prompter with essential song information', 'Metronome and Tap Tempo inside the app', 'Annotated, reorderable setlists', 'Downloaded tracks available without a network'],
      prompterLabel: 'Live prompter',
    },
    offline: {
      label: '03 — Offline first',
      title: ['When the network drops,', 'the band keeps going.'],
      ready: 'Ready for the stage',
      badge: 'Offline',
      status: [['Setlist — Nantes live', '7 songs available', 'LOCAL'], ['Audio tracks', '5 files downloaded', 'OK'], ['Lyrics & notes', 'Last synced at 18:42', 'OK'], ['Changes', '2 updates waiting', 'QUEUE']],
      heading: 'Connection becomes an option, not a requirement.',
      description: 'Rehearse in a basement, play in a crowded venue, or prepare a set on the train. FaderZero keeps the essentials locally and syncs changes as soon as it can.',
      technologies: 'Local data · Sync queue · Cached audio · QR transfer',
    },
    features: {
      label: '04 — Everything in one place',
      title: ['Fewer tools.', 'More music.'],
      description: 'Every feature belongs in a band’s real workflow. Nothing is here just to fill a product checklist.',
      items: [['Repertoire', 'Songs & lyrics', 'Keep status, key, BPM, duration, notes, and lyrics together around each song.'], ['Audio', 'Tracks & memos', 'Import, play, and download useful tracks. Capture a voice idea without breaking rehearsal flow.'], ['Live', 'Prompter', 'A dedicated stage view for lyrics and the essential details of each song.'], ['Preparation', 'Setlists', 'Create, reorder, and annotate sets. Export them to PDF when they need to be shared.'], ['Timing', 'Metronome', 'Tempo, Tap Tempo, and direct access from rehearsal or stage workflows.'], ['Team', 'Collaboration', 'Shared workspaces, roles, and invitations keep the whole band on the same page.'], ['Schedule', 'Rehearsals & gigs', 'Plan band events without separating the calendar from the rest of the musical preparation.']],
    },
    epk: {
      label: '05 — Professional tools',
      title: 'When it is time to introduce the band, everything is already ready.',
      description: 'FaderZero can also publish a public EPK: one clean link for your bio, music, media, professional information, and contact details.',
      cta: 'Create the band workspace →',
      genre: 'Rock · Nantes, FR · Booking 2026',
      listen: 'Listen',
      technical: 'Tech rider',
      contact: 'Contact',
    },
  },
} as const satisfies Record<Language, LandingNarrativeCopy>;
