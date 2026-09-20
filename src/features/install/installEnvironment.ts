export type InstallOS = 'windows' | 'macos' | 'android' | 'ios' | 'linux' | 'unknown';

export type InstallBrowser =
  | 'chrome'
  | 'edge'
  | 'safari'
  | 'firefox'
  | 'samsung'
  | 'brave'
  | 'opera'
  | 'unknown';

export interface InstallEnvironment {
  os: InstallOS;
  browser: InstallBrowser;
  isStandalone: boolean;
  canPromptInstall: boolean;
}

export function applyInstallGuidePreview(
  environment: InstallEnvironment,
  search: string,
  isDevelopment = import.meta.env.DEV,
): InstallEnvironment {
  if (!isDevelopment || new URLSearchParams(search).get('installGuide') !== 'ios') return environment;

  return { ...environment, os: 'ios', browser: 'safari', canPromptInstall: false };
}

interface InstallEnvironmentOptions {
  userAgent?: string;
  vendor?: string;
  maxTouchPoints?: number;
  isBrave?: boolean;
  isStandalone?: boolean;
}

export function detectInstallEnvironment(options: InstallEnvironmentOptions = {}): InstallEnvironment {
  const userAgent = (options.userAgent ?? navigator.userAgent).toLowerCase();
  const vendor = (options.vendor ?? navigator.vendor).toLowerCase();
  const maxTouchPoints = options.maxTouchPoints ?? navigator.maxTouchPoints;
  const isIos = /iphone|ipad|ipod/.test(userAgent) || (/macintosh/.test(userAgent) && maxTouchPoints > 1);
  const isStandalone = options.isStandalone ?? (
    window.matchMedia('(display-mode: standalone)').matches
    || (navigator as Navigator & { standalone?: boolean }).standalone === true
  );

  const os: InstallOS = isIos
    ? 'ios'
    : /android/.test(userAgent)
      ? 'android'
      : /windows/.test(userAgent)
        ? 'windows'
        : /macintosh|mac os x/.test(userAgent)
          ? 'macos'
          : /linux/.test(userAgent)
            ? 'linux'
            : 'unknown';

  const browser: InstallBrowser = options.isBrave
    ? 'brave'
    : /samsungbrowser/.test(userAgent)
      ? 'samsung'
      : /edg\//.test(userAgent) || /edga\//.test(userAgent) || /edgios\//.test(userAgent)
        ? 'edge'
        : /opr\//.test(userAgent) || /opera/.test(userAgent)
          ? 'opera'
          : /firefox\//.test(userAgent) || /fxios\//.test(userAgent)
            ? 'firefox'
            : /crios\//.test(userAgent) || /chrome\//.test(userAgent)
              ? 'chrome'
              : /safari\//.test(userAgent) && /apple/.test(vendor)
                ? 'safari'
                : 'unknown';

  return { os, browser, isStandalone, canPromptInstall: false };
}

export function getInstallGuide(environment: InstallEnvironment): {
  title: string;
  description: string;
  steps: string[];
  illustration: 'ios-safari' | 'ios-chrome' | 'ios-generic' | 'macos-safari' | 'firefox' | 'generic';
} {
  if (environment.os === 'ios') {
    if (environment.browser === 'safari') {
      return {
        title: 'Installer sur iPhone ou iPad',
        description: 'Ajoutez FaderZero à votre écran d’accueil depuis le menu Safari.',
        steps: ['Appuyez sur Partager.', 'Sélectionnez Ajouter à l’écran d’accueil.', 'Appuyez sur Ajouter.'],
        illustration: 'ios-safari',
      };
    }

    if (environment.browser === 'chrome') {
      return {
        title: 'Installer sur iPhone ou iPad',
        description: 'Ajoutez FaderZero à votre écran d’accueil depuis le menu Chrome.',
        steps: ['Ouvrez le menu Partager de Chrome.', 'Sélectionnez Ajouter à l’écran d’accueil.', 'Appuyez sur Ajouter.'],
        illustration: 'ios-chrome',
      };
    }

    return {
      title: 'Installer sur iPhone ou iPad',
      description: 'Ajoutez FaderZero à votre écran d’accueil depuis le menu de partage.',
      steps: ['Ouvrez le menu Partager.', 'Sélectionnez Ajouter à l’écran d’accueil.', 'Appuyez sur Ajouter.'],
      illustration: 'ios-generic',
    };
  }

  if (environment.os === 'macos' && environment.browser === 'safari') {
    return {
      title: 'Installer sur votre Mac',
      description: 'Ajoutez FaderZero au Dock pour l’ouvrir comme une application.',
      steps: ['Ouvrez le menu Fichier dans Safari.', 'Choisissez Ajouter au Dock.', 'Confirmez l’ajout de FaderZero.'],
      illustration: 'macos-safari',
    };
  }

  if (environment.browser === 'firefox') {
    return {
      title: 'Installation indisponible avec Firefox',
      description: 'Firefox ne propose pas l’installation directe de FaderZero comme application.',
      steps: ['Ouvrez cette page avec Chrome ou Edge.', 'Utilisez ensuite le bouton Installer de FaderZero.'],
      illustration: 'firefox',
    };
  }

  return {
    title: 'Installer FaderZero',
    description: 'Utilisez FaderZero comme une vraie application, directement depuis votre écran d’accueil ou votre bureau.',
    steps: ['Appuyez sur les trois points en haut à droite.', 'Choisissez Installer.', 'Confirmez en appuyant sur Installer.'],
    illustration: 'generic',
  };
}
