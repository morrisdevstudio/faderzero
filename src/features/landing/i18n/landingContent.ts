import { useState, useEffect } from 'react';

export type Language = 'fr' | 'en';

export const LANDING_CONTENT = {
  fr: {
    nav: {
      prompter: 'Prompteur',
      setlists: 'Setlists',
      metronome: 'Métronome',
      songs: 'Morceaux',
      offline: 'Hors-ligne',
      faq: 'FAQ',
      login: 'Connexion',
      startFree: 'Ouvrir l’app',
      createGroup: 'Créer mon groupe',
    },
    hero: {
      badge: 'PWA Mobile-First · 100% Hors-ligne · Conçu pour la scène',
      titleHighlight: 'Le cockpit de scène',
      titleEnd: 'pour les groupes et musiciens live.',
      subtitle:
        'Prompteur scène haute lisibilité avec paroles et repères, setlists de concert avec transitions, métronome calé sur vos morceaux, planning de groupe et enregistreur de répétition.',
      ctaPrimary: 'Démarrer gratuitement',
      ctaSecondary: 'Découvrir le prompteur',
      pwaProof: 'Installation instantanée sur iPhone, Android, Mac ou PC · Fonctionne 100% hors-ligne',
    },
    offlineBanner: {
      tag: 'ARCHITECTURE OFFLINE-FIRST (INDEXEDDB)',
      title: 'En sous-sol ou sur scène sans aucun réseau : l’application tourne à 100%.',
      description:
        'FaderZero stocke toutes vos données localement sur votre appareil (paroles, tempos, setlists, mémos audio). Vous pouvez lancer vos répètes et vos concerts en mode avion sans jamais dépendre d’une connexion internet.',
      points: [
        {
          title: 'Accès instantané 0 ms',
          desc: 'Aucun temps de chargement. Vos paroles et setlists s’ouvrent instantanément même sans Wi-Fi.',
        },
        {
          title: 'Enregistreur de répétitions intégré',
          desc: 'Capturez les mémos vocaux de vos répètes et attachez-les directement à vos morceaux.',
        },
        {
          title: 'Synchronisation automatique du groupe',
          desc: 'Toutes les modifications créées hors-ligne sont synchronisées avec vos musiciens dès la reconnexion.',
        },
      ],
    },
    features: {
      badge: 'FONCTIONNALITÉS CLÉS',
      title: 'Tous vos outils de répétition et de concert au même endroit',
      subtitle: 'Une interface sombre taillée pour les conditions de scène, sans fioritures inutiles.',
    },
    demo: {
      badge: 'VRAIE EXPÉRIENCE APPLICATION',
      title: 'Testez les modules FaderZero en conditions réelles',
      subtitle: 'Une ergonomie pensée pour l’obscurité des scènes, avec contrastes élevés et repères visuels clairs.',
      tabs: {
        prompter: 'Prompteur Live',
        setlist: 'Setlist Concert',
        metronome: 'Métronome Scène',
      },
    },
    useCases: {
      badge: 'POUR TOUTES LES FORMATIONS',
      title: 'Pensé pour les répétitions et les concerts',
      items: [
        {
          title: 'Groupes en répétition',
          desc: 'Gardez vos morceaux structurés avec couplets et refrains, callez vos tempos sur le métronome et enregistrez vos prises en un clic.',
          highlight: 'Efficacité maximale en répétition',
        },
        {
          title: 'Concerts & Festivals',
          desc: 'Enchaînez vos morceaux avec le défilement automatique du prompteur et suivez l’ordre précis de vos setlists avec les transitions.',
          highlight: 'Zéro temps mort sur scène',
        },
        {
          title: 'Chanteurs & Musiciens solo',
          desc: 'Posez votre smartphone sur votre pupitre. Profitez du mode plein écran, de l’affichage sombre et du défilement réglable.',
          highlight: 'Lisibilité parfaite en plein concert',
        },
      ],
    },
    faq: {
      badge: 'QUESTIONS FRÉQUENTES',
      title: 'Tout comprendre sur le fonctionnement de FaderZero',
      items: [
        {
          q: 'Pourquoi FaderZero fonctionne-t-il sans connexion internet ?',
          a: 'FaderZero est conçu en Offline-First avec IndexedDB. Toutes vos paroles, setlists, tempos et mémos audio sont enregistrés sur votre téléphone ou ordinateur. Vous pouvez jouer en sous-sol ou en mode avion en toute sérénité.',
        },
        {
          q: 'Dois-je télécharger une application sur l’App Store ou le Play Store ?',
          a: 'Non ! FaderZero est une Progressive Web App (PWA). Il vous suffit d’ouvrir le site sur Safari ou Chrome et d’appuyer sur « Sur l’écran d’accueil ». Elle s’installe instantanément.',
        },
        {
          q: 'Comment fonctionne le partage avec les membres du groupe ?',
          a: 'Vous créez un groupe, puis vous générez un lien d’invitation. Chaque musicien qui rejoint votre espace a accès en temps réel au répertoire, aux setlists et au calendrier.',
        },
        {
          q: 'FaderZero est-il gratuit ?',
          a: 'Oui, l’inscription et l’ensemble des fonctionnalités de répétition et de scène sont entièrement gratuites.',
        },
      ],
    },
    footer: {
      tagline: 'L’outil de scène et de répétition pensé par des musiciens pour les musiciens.',
      linksTitle: 'Navigation',
      legalTitle: 'Plateforme',
      openApp: 'Ouvrir l’application',
      offlineGuaranteed: '100% Offline-First (IndexedDB) · Chiffrement sécurisé · Hébergé en Europe',
      copyright: '© 2026 FaderZero. Tous droits réservés.',
    },
  },
  en: {
    nav: {
      prompter: 'Prompter',
      setlists: 'Setlists',
      metronome: 'Metronome',
      songs: 'Songs',
      offline: 'Offline',
      faq: 'FAQ',
      login: 'Sign in',
      startFree: 'Open app',
      createGroup: 'Create free band',
    },
    hero: {
      badge: 'Mobile-First PWA · 100% Offline-Ready · Built for Stage',
      titleHighlight: 'The live stage cockpit',
      titleEnd: 'for bands and gigging musicians.',
      subtitle:
        'High-visibility stage prompter with lyrics and section markers, gig setlists with transitions, metronome locked to your songs, rehearsal schedule, and quick recorder.',
      ctaPrimary: 'Start for free',
      ctaSecondary: 'Try stage prompter',
      pwaProof: 'Instant install on iPhone, Android, Mac, or PC · Works 100% offline',
    },
    offlineBanner: {
      tag: 'OFFLINE-FIRST ARCHITECTURE (INDEXEDDB)',
      title: 'In concrete basements or backstage with zero reception: runs 100% smoothly.',
      description:
        'FaderZero persists all your data locally on your device (lyrics, tempos, setlists, audio memos). You can rehearse and gig in airplane mode without relying on an internet connection.',
      points: [
        {
          title: 'Instant 0 ms load time',
          desc: 'No loading spinners. Your lyrics and setlists open instantly even without network.',
        },
        {
          title: 'Integrated Rehearsal Recorder',
          desc: 'Capture vocal and instrument take memos and attach them directly to your songs.',
        },
        {
          title: 'Automatic Band Sync',
          desc: 'All offline modifications automatically sync across all bandmates once reconnected.',
        },
      ],
    },
    features: {
      badge: 'CORE FEATURES',
      title: 'All your rehearsal and stage tools in one place',
      subtitle: 'A high-contrast dark interface tailored for stage darkness, with zero clutter.',
    },
    demo: {
      badge: 'REAL APP EXPERIENCE',
      title: 'Test FaderZero modules live',
      subtitle: 'Engineered for stage darkness, with high contrast and clear visual markers.',
      tabs: {
        prompter: 'Live Prompter',
        setlist: 'Gig Setlist',
        metronome: 'Stage Metronome',
      },
    },
    useCases: {
      badge: 'FOR ALL LIVE FORMATIONS',
      title: 'Built for rehearsal rooms and live stages',
      items: [
        {
          title: 'Bands in Rehearsal',
          desc: 'Organize song structures with verse and chorus sections, lock tempos with the metronome, and record ideas in one tap.',
          highlight: 'Maximum rehearsal productivity',
        },
        {
          title: 'Gigs & Festivals',
          desc: 'Perform without stage dead-air thanks to auto-scrolling lyrics and structured setlists with transitions.',
          highlight: 'Zero stage dead-time',
        },
        {
          title: 'Solo Artists & Singers',
          desc: 'Set your smartphone on your mic stand. Enjoy fullscreen mode, high contrast typography, and smooth scrolling.',
          highlight: 'Total stage clarity',
        },
      ],
    },
    faq: {
      badge: 'FREQUENTLY ASKED QUESTIONS',
      title: 'Everything you need to know about FaderZero',
      items: [
        {
          q: 'Why does FaderZero work without internet reception?',
          a: 'FaderZero is built Offline-First using IndexedDB. All your lyrics, setlists, tempos, and audio memos are saved on your phone or laptop. You can perform anywhere with zero connectivity.',
        },
        {
          q: 'Do I need to download an app from the App Store or Play Store?',
          a: 'No! FaderZero is a Progressive Web App (PWA). Open it in Safari or Chrome and tap "Add to Home Screen" to install it instantly.',
        },
        {
          q: 'How does sharing with band members work?',
          a: 'Create a workspace, generate an invite link, and send it to your musicians. Everyone gets instant access to the shared songs, setlists, and calendar.',
        },
        {
          q: 'Is FaderZero free?',
          a: 'Yes, account creation and all stage and rehearsal features are 100% free.',
        },
      ],
    },
    footer: {
      tagline: 'The live stage and rehearsal tool built by musicians, for musicians.',
      linksTitle: 'Navigation',
      legalTitle: 'Platform',
      openApp: 'Open application',
      offlineGuaranteed: '100% Offline-First (IndexedDB) · Secure encryption · Hosted in Europe',
      copyright: '© 2026 FaderZero. All rights reserved.',
    },
  },
} as const;

export function useLandingLanguage() {
  const [lang, setLang] = useState<Language>(() => {
    try {
      const saved = localStorage.getItem('fz_landing_lang');
      if (saved === 'fr' || saved === 'en') return saved;
      if (typeof navigator !== 'undefined' && navigator.language?.startsWith('fr')) {
        return 'fr';
      }
    } catch {
      /* ignore */
    }
    return 'fr';
  });

  useEffect(() => {
    try {
      localStorage.setItem('fz_landing_lang', lang);
    } catch {
      /* ignore */
    }
  }, [lang]);

  const content = LANDING_CONTENT[lang];

  return { lang, setLang, content };
}
