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

export type InstallAvailability = 'installed' | 'installable' | 'ios-instructions' | 'manual-instructions' | 'unsupported';

export function getInstallAvailability(
  environment: InstallEnvironment,
  isInstalledThisSession = false,
): InstallAvailability {
  if (isInstalledThisSession || environment.isStandalone) return 'installed';
  if (environment.canPromptInstall) return 'installable';
  if (environment.os === 'ios' && (environment.browser === 'safari' || environment.browser === 'chrome')) {
    return 'ios-instructions';
  }
  if (environment.os === 'macos' && environment.browser === 'safari') return 'manual-instructions';
  return 'unsupported';
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
  illustration: 'ios-safari' | 'ios-chrome' | 'ios-generic' | 'macos-safari';
} {
  if (environment.os === 'ios') {
    if (environment.browser === 'safari') {
      return {
        title: 'Installer sur iPhone ou iPad',
        description: 'Ajoutez FaderZero à votre écran d’accueil depuis le menu Safari.',
        steps: ['Touchez le bouton Partager de Safari.', 'Choisissez Sur l’écran d’accueil.', 'Confirmez avec Ajouter.'],
        illustration: 'ios-safari',
      };
    }

    if (environment.browser === 'chrome') {
      return {
        title: 'Installer sur iPhone ou iPad',
        description: 'Ajoutez FaderZero à votre écran d’accueil depuis le menu Chrome.',
        steps: ['Ouvrez le menu Partager de Chrome.', 'Choisissez Sur l’écran d’accueil.', 'Confirmez avec Ajouter.'],
        illustration: 'ios-chrome',
      };
    }

    return {
      title: 'Installer sur iPhone ou iPad',
      description: 'Ajoutez FaderZero à votre écran d’accueil depuis le menu de partage.',
      steps: ['Ouvrez le menu Partager.', 'Choisissez Sur l’écran d’accueil.', 'Confirmez avec Ajouter.'],
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

  return {
    title: 'Installer FaderZero',
    description: 'Cette méthode d’installation n’est pas disponible dans ce navigateur.',
    steps: [],
    illustration: 'ios-generic',
  };
}
