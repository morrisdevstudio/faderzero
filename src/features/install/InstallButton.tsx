import { useEffect, useState } from 'react';
import { FormDialog } from '@/components/FormDialog';
import { isAppHostname } from '@/utils/domainRouting';
import { FzIcon } from '@/ui/icons';
import { applyInstallGuidePreview, getInstallGuide, type InstallEnvironment } from './installEnvironment';
import { useInstall } from './InstallContext';

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => window.matchMedia('(max-width: 639px)').matches);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 639px)');
    const update = () => setIsMobile(mediaQuery.matches);
    update();
    mediaQuery.addEventListener('change', update);
    return () => mediaQuery.removeEventListener('change', update);
  }, []);

  return isMobile;
}

function InstallIllustration({ variant }: { variant: ReturnType<typeof getInstallGuide>['illustration'] }) {
  const usesBrowserMenu = variant === 'generic' || variant === 'ios-chrome';
  const label = variant === 'ios-chrome' || variant === 'generic' ? 'Chrome' : variant === 'ios-safari' ? 'Safari' : variant === 'macos-safari' ? 'Safari sur Mac' : 'Navigateur';
  const action = variant === 'macos-safari' ? 'Ajouter au Dock' : variant === 'firefox' ? 'Chrome ou Edge' : usesBrowserMenu ? 'Installer' : 'Partager';

  return (
    <div className="rounded-[1.75rem] border border-white/10 bg-black/25 p-3 shadow-[0_12px_28px_rgba(0,0,0,0.22)]" aria-hidden="true">
      <div className="mx-auto flex max-w-[13rem] items-center gap-2 rounded-2xl border border-white/15 bg-[#17191f] p-2.5 shadow-lg">
        <span className="min-w-0 flex-1 truncate text-[0.68rem] font-black text-white/75">{label}</span>
        {usesBrowserMenu ? (
          <span className="flex h-8 w-8 items-center justify-center rounded-lg text-xl leading-none text-white/75">⋮</span>
        ) : (
          <FzIcon name={variant === 'firefox' ? 'external-link' : variant === 'macos-safari' ? 'download' : 'upload'} usageId="install.guide.illustration" size="sm" className="text-[var(--fz-accent)]" />
        )}
      </div>
      <div className="mx-auto mt-3 flex max-w-[11rem] items-center justify-center gap-2 rounded-xl bg-white/8 px-3 py-2.5 text-[0.68rem] font-black text-white">
        <span>{action}</span>
        <FzIcon name="next" usageId="install.guide.illustration-next" size="sm" className="text-white/55" />
      </div>
    </div>
  );
}

function InstallDialog({ open, onClose, environment }: { open: boolean; onClose: () => void; environment: InstallEnvironment }) {
  const { requestNativeInstall } = useInstall();
  const isMobile = useIsMobile();
  const [showGuide, setShowGuide] = useState(!environment.canPromptInstall);
  const [showFallbackNotice, setShowFallbackNotice] = useState(false);
  const guide = getInstallGuide(environment);

  useEffect(() => {
    if (open) {
      setShowGuide(!environment.canPromptInstall);
      setShowFallbackNotice(false);
    }
  }, [environment.canPromptInstall, open]);

  async function handleNativeInstall() {
    const outcome = await requestNativeInstall();
    if (outcome === 'accepted') {
      onClose();
      return;
    }
    setShowGuide(true);
    setShowFallbackNotice(true);
  }

  const title = showGuide ? guide.title : 'Installer FaderZero';

  return open ? (
    <FormDialog title={title} closeLabel="Fermer le parcours d’installation" onClose={onClose} placement={isMobile ? 'bottom' : 'center'}>
      <div className="space-y-4">
        {showGuide ? (
          <>
            {showFallbackNotice ? <p className="rounded-xl border border-amber-300/25 bg-amber-300/10 p-3 text-sm text-amber-100">L’installation automatique n’a pas abouti. Suivez ces étapes manuelles.</p> : null}
            <p className="text-sm leading-relaxed text-[var(--fz-text-muted)]">{guide.description}</p>
            <InstallIllustration variant={guide.illustration} />
            <ol className="space-y-2 text-sm leading-relaxed text-white/85">
              {guide.steps.map((step, index) => <li key={step} className="flex gap-3"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--fz-accent)] text-xs font-black text-white">{index + 1}</span><span>{step}</span></li>)}
            </ol>
          </>
        ) : (
          <>
            <p className="text-sm leading-relaxed text-[var(--fz-text-muted)]">Utilisez FaderZero comme une vraie application, directement depuis votre écran d’accueil ou votre bureau.</p>
            <InstallIllustration variant="generic" />
            <button type="button" onClick={() => void handleNativeInstall()} className="fz-button-primary flex min-h-11 w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-black transition-transform active:scale-[0.96]">
              <FzIcon name="download" usageId="install.dialog.native" size="md" />
              Installer maintenant
            </button>
            <button type="button" onClick={() => setShowGuide(true)} className="w-full text-center text-sm font-bold text-white/65 underline decoration-white/30 underline-offset-4 transition hover:text-white">Voir les étapes manuelles</button>
          </>
        )}
      </div>
    </FormDialog>
  ) : null;
}

export function InstallButton() {
  const { environment, isInstalledThisSession } = useInstall();
  const [isOpen, setIsOpen] = useState(false);
  const isAppEnvironment = isAppHostname() || import.meta.env.DEV;
  const guideEnvironment = applyInstallGuidePreview(environment, window.location.search);

  if (!isAppEnvironment || environment.isStandalone || isInstalledThisSession) return null;

  return (
    <>
      <button type="button" onClick={() => setIsOpen(true)} className="flex h-10 shrink-0 items-center gap-1.5 rounded-xl border border-white/15 bg-white/5 px-2.5 text-[0.68rem] font-black uppercase tracking-[0.11em] text-white/90 transition hover:border-white/30 hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--fz-accent-strong)]">
        <FzIcon name="download" usageId="install.entry" size="sm" />
        Installer
      </button>
      <InstallDialog open={isOpen} onClose={() => setIsOpen(false)} environment={guideEnvironment} />
    </>
  );
}
