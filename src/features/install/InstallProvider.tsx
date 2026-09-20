import { useCallback, useEffect, useMemo, useState, type PropsWithChildren } from 'react';
import { detectInstallEnvironment, type InstallEnvironment } from './installEnvironment';
import { InstallContext, type InstallContextValue } from './InstallContext';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

function readEnvironment(hasDeferredPrompt: boolean): InstallEnvironment {
  const environment = detectInstallEnvironment({
    isBrave: Boolean((navigator as Navigator & { brave?: unknown }).brave),
  });
  return { ...environment, canPromptInstall: hasDeferredPrompt };
}

export function InstallProvider({ children }: PropsWithChildren) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalledThisSession, setIsInstalledThisSession] = useState(false);
  const [environment, setEnvironment] = useState<InstallEnvironment>(() => readEnvironment(false));

  useEffect(() => {
    const mediaQuery = window.matchMedia('(display-mode: standalone)');
    const updateEnvironment = () => setEnvironment(readEnvironment(Boolean(deferredPrompt)));
    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    };
    const handleInstalled = () => {
      setIsInstalledThisSession(true);
      setDeferredPrompt(null);
    };

    updateEnvironment();
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleInstalled);
    mediaQuery.addEventListener('change', updateEnvironment);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleInstalled);
      mediaQuery.removeEventListener('change', updateEnvironment);
    };
  }, [deferredPrompt]);

  const requestNativeInstall = useCallback(async () => {
    if (!deferredPrompt) return 'unavailable' as const;

    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    return outcome;
  }, [deferredPrompt]);

  const value = useMemo<InstallContextValue>(() => ({
    environment,
    isInstalledThisSession,
    requestNativeInstall,
  }), [environment, isInstalledThisSession, requestNativeInstall]);

  return <InstallContext.Provider value={value}>{children}</InstallContext.Provider>;
}
