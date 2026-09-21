import { useContext, useEffect, useState } from 'react';
import { FormDialog } from '@/components/FormDialog';
import { isAppHostname } from '@/utils/domainRouting';
import { FzIcon } from '@/ui/icons';
import { applyInstallGuidePreview, getInstallAvailability, getInstallGuide } from './installEnvironment';
import { InstallContext, useInstall } from './InstallContext';

const DISMISS_KEY = 'faderzero:pwa-install-dismissed-at';
const DISMISS_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

function isDismissedRecently() {
  try {
    const dismissedAt = Number(window.localStorage.getItem(DISMISS_KEY));
    return Number.isFinite(dismissedAt) && Date.now() - dismissedAt < DISMISS_DURATION_MS;
  } catch {
    return false;
  }
}

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => window.matchMedia('(max-width: 639px)').matches);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 639px)');
    const update = () => setIsMobile(mediaQuery.matches);
    mediaQuery.addEventListener('change', update);
    return () => mediaQuery.removeEventListener('change', update);
  }, []);

  return isMobile;
}

function InstallGuideDialog({ onClose }: { onClose: () => void }) {
  const { environment } = useInstall();
  const isMobile = useIsMobile();
  const guide = getInstallGuide(applyInstallGuidePreview(environment, window.location.search));
  const icons = ['upload', 'add', 'check'] as const;

  return (
    <FormDialog
      title={guide.title}
      closeLabel="Fermer les instructions d’installation"
      onClose={onClose}
      placement={isMobile ? 'bottom' : 'center'}
    >
      <div className="space-y-4">
        <p className="text-sm leading-relaxed text-[var(--fz-text-muted)]">{guide.description}</p>
        <ol className="space-y-3">
          {guide.steps.map((step, index) => (
            <li key={step} className="flex items-center gap-3 text-sm leading-relaxed text-white/85">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-violet-300/20 bg-violet-400/10 text-violet-200">
                <FzIcon name={icons[index] ?? 'check'} usageId={`install.guide.step-${index + 1}`} size="sm" />
              </span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
      </div>
    </FormDialog>
  );
}

export function InstallBanner() {
  const installContext = useContext(InstallContext);
  const [isDismissed, setIsDismissed] = useState(isDismissedRecently);
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  if (!installContext) return null;

  const { environment, isInstalledThisSession, requestNativeInstall } = installContext;
  const guideEnvironment = applyInstallGuidePreview(environment, window.location.search);
  const availability = getInstallAvailability(guideEnvironment, isInstalledThisSession);
  const isAppEnvironment = isAppHostname() || import.meta.env.DEV;

  function dismiss() {
    try {
      window.localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      // The banner remains dismissible when storage is unavailable.
    }
    setIsDismissed(true);
  }

  async function install() {
    if (availability === 'installable') {
      await requestNativeInstall();
      return;
    }
    setIsGuideOpen(true);
  }

  const canShow = isAppEnvironment
    && !isDismissed
    && (availability === 'installable' || availability === 'ios-instructions' || availability === 'manual-instructions');

  if (!canShow) return null;

  return (
    <>
      <aside className="fz-install-banner mx-auto w-full max-w-md px-3 pb-2 sm:px-4" aria-label="Installation de FaderZero">
        <div className="flex min-h-14 items-center gap-2 rounded-2xl border border-violet-300/20 bg-[linear-gradient(110deg,rgba(27,22,43,0.96),rgba(17,18,28,0.96))] px-3 py-2">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-400/10 text-violet-200">
            <FzIcon name="download" usageId="install.banner.entry" size="md" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[0.8rem] font-black text-white">Installer FaderZero</p>
            <p className="hidden truncate text-[0.68rem] leading-4 text-[var(--fz-text-muted)] min-[360px]:block">Accédez plus rapidement à vos projets, même hors ligne.</p>
          </div>
          <button
            type="button"
            onClick={() => void install()}
            className="flex min-h-11 shrink-0 items-center gap-1 rounded-xl bg-gradient-to-r from-violet-500 to-fuchsia-500 px-3 text-[0.68rem] font-black text-white transition hover:brightness-110 active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-300 motion-reduce:transition-none"
          >
            Installer
            <FzIcon name="next" usageId="install.banner.action" size="sm" />
          </button>
          <button
            type="button"
            onClick={dismiss}
            aria-label="Masquer la bannière d’installation pendant 7 jours"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white/55 transition hover:bg-white/5 hover:text-white active:scale-[0.95] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-300 motion-reduce:transition-none"
          >
            <FzIcon name="close" usageId="install.banner.dismiss" size="md" />
          </button>
        </div>
      </aside>
      {isGuideOpen ? <InstallGuideDialog onClose={() => setIsGuideOpen(false)} /> : null}
    </>
  );
}
