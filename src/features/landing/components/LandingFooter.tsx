import { FaderLogo } from '@/ui/components/FaderLogo';
import { type Language, type LANDING_CONTENT } from '../i18n/landingContent';
import { getAppUrl } from '@/utils/domainRouting';

interface LandingFooterProps {
  content: (typeof LANDING_CONTENT)[Language];
  currentLang: Language;
  onSelectLang: (lang: Language) => void;
}

export function LandingFooter({ content, currentLang, onSelectLang }: LandingFooterProps) {
  const appUrl = getAppUrl('/?view=app');

  return (
    <footer className="border-t border-white/10 bg-[#07080b] py-14 text-white">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
          {/* Brand & Mission */}
          <div className="md:col-span-6 space-y-4">
            <div role="img" aria-label="FaderZero">
              <FaderLogo className="h-10 w-28 text-white" preserveAspectRatio="none" />
            </div>
            <p className="max-w-md text-xs sm:text-sm text-white/60 leading-relaxed">
              {content.footer.tagline}
            </p>
            <div className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-1 text-[0.7rem] font-bold text-white/60">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              <span>{content.footer.offlineGuaranteed}</span>
            </div>
          </div>

          {/* Navigation Links */}
          <div className="md:col-span-3 space-y-3">
            <h4 className="text-xs font-black uppercase tracking-[0.16em] text-white/40">
              {content.footer.linksTitle}
            </h4>
            <ul className="space-y-2 text-xs font-bold text-white/70">
              <li>
                <a href="#features" className="hover:text-white transition">
                  {content.nav.setlists}
                </a>
              </li>
              <li>
                <a href="#offline" className="hover:text-white transition">
                  {content.nav.offline}
                </a>
              </li>
              <li>
                <a href="#demo" className="hover:text-white transition">
                  {content.demo.tabs.prompter}
                </a>
              </li>
              <li>
                <a href="#faq" className="hover:text-white transition">
                  {content.nav.faq}
                </a>
              </li>
              <li>
                <a href={appUrl} className="text-rose-400 hover:text-rose-300 font-black transition">
                  → {content.footer.openApp}
                </a>
              </li>
            </ul>
          </div>

          {/* Language and Legal */}
          <div className="md:col-span-3 space-y-3">
            <h4 className="text-xs font-black uppercase tracking-[0.16em] text-white/40">
              Langue / Language
            </h4>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onSelectLang('fr')}
                className={`rounded-lg px-3 py-1.5 text-xs font-black transition ${
                  currentLang === 'fr' ? 'bg-white/20 text-white' : 'border border-white/10 text-white/50 hover:text-white'
                }`}
              >
                Français
              </button>
              <button
                type="button"
                onClick={() => onSelectLang('en')}
                className={`rounded-lg px-3 py-1.5 text-xs font-black transition ${
                  currentLang === 'en' ? 'bg-white/20 text-white' : 'border border-white/10 text-white/50 hover:text-white'
                }`}
              >
                English
              </button>
            </div>
            <p className="text-[0.7rem] text-white/40 pt-4">
              {content.footer.copyright}
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
