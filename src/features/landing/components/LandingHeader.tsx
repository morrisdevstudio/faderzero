import { useState } from 'react';
import { FaderLogo } from '@/ui/components/FaderLogo';
import { FzIcon } from '@/ui/icons';
import { type Language, type LANDING_CONTENT } from '../i18n/landingContent';
import { getAppUrl } from '@/utils/domainRouting';

interface LandingHeaderProps {
  content: (typeof LANDING_CONTENT)[Language];
  currentLang: Language;
  onSelectLang: (lang: Language) => void;
}

export function LandingHeader({ content, currentLang, onSelectLang }: LandingHeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const appLoginUrl = getAppUrl('/?view=app');
  const appSignupUrl = getAppUrl('/?view=app');

  const navLinks = [
    { href: '#prompter-showcase', label: content.nav.prompter },
    { href: '#features', label: content.nav.setlists },
    { href: '#offline', label: content.nav.offline },
    { href: '#demo', label: content.demo.tabs.prompter },
    { href: '#faq', label: content.nav.faq },
  ];

  return (
    <header className="sticky top-0 z-40 w-full border-b border-white/10 bg-[#0c0d10]/85 backdrop-blur-xl transition-all">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        {/* Brand */}
        <a
          href="#"
          className="flex items-center gap-3 transition hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ff3a63]"
          aria-label="FaderZero Accueil"
        >
          <div role="img" aria-label="FaderZero">
            <FaderLogo className="h-9 w-24 sm:h-10 sm:w-28 text-white" preserveAspectRatio="none" />
          </div>
        </a>

        {/* Desktop Nav */}
        <nav className="hidden items-center gap-6 md:flex" aria-label="Navigation principale">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-xs font-bold uppercase tracking-[0.14em] text-white/70 transition hover:text-white"
            >
              {link.label}
            </a>
          ))}
        </nav>

        {/* Right side controls */}
        <div className="hidden items-center gap-3 md:flex">
          {/* Language toggle */}
          <div className="flex items-center rounded-xl border border-white/10 bg-black/40 p-1 text-[0.7rem] font-bold">
            <button
              type="button"
              onClick={() => onSelectLang('fr')}
              className={`rounded-lg px-2 py-1 transition ${
                currentLang === 'fr' ? 'bg-white/20 text-white font-black' : 'text-white/50 hover:text-white'
              }`}
              aria-label="Passer en français"
            >
              FR
            </button>
            <button
              type="button"
              onClick={() => onSelectLang('en')}
              className={`rounded-lg px-2 py-1 transition ${
                currentLang === 'en' ? 'bg-white/20 text-white font-black' : 'text-white/50 hover:text-white'
              }`}
              aria-label="Switch to English"
            >
              EN
            </button>
          </div>

          <a
            href={appLoginUrl}
            className="rounded-xl border border-white/15 px-3.5 py-2 text-xs font-black uppercase tracking-[0.14em] text-white/90 transition hover:border-white/30 hover:bg-white/5"
          >
            {content.nav.login}
          </a>

          <a
            href={appSignupUrl}
            className="fz-button-primary rounded-xl px-4 py-2 text-xs font-black uppercase tracking-[0.14em] shadow-[0_4px_16px_rgba(255,58,99,0.35)] transition active:scale-95"
          >
            {content.nav.createGroup}
          </a>
        </div>

        {/* Mobile menu button */}
        <div className="flex items-center gap-2 md:hidden">
          {/* Language toggle mobile */}
          <div className="flex items-center rounded-lg border border-white/10 bg-black/40 p-0.5 text-[0.65rem] font-bold">
            <button
              type="button"
              onClick={() => onSelectLang('fr')}
              className={`rounded px-1.5 py-0.5 transition ${
                currentLang === 'fr' ? 'bg-white/20 text-white font-black' : 'text-white/50'
              }`}
            >
              FR
            </button>
            <button
              type="button"
              onClick={() => onSelectLang('en')}
              className={`rounded px-1.5 py-0.5 transition ${
                currentLang === 'en' ? 'bg-white/20 text-white font-black' : 'text-white/50'
              }`}
            >
              EN
            </button>
          </div>

          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white/80 transition hover:bg-white/10"
            aria-label={mobileMenuOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
            aria-expanded={mobileMenuOpen}
          >
            <FzIcon name={mobileMenuOpen ? 'close' : 'menu'} usageId="landing.mobile-menu" size="md" />
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="border-b border-white/10 bg-[#101218]/95 px-4 py-6 shadow-2xl backdrop-blur-2xl md:hidden">
          <nav className="flex flex-col space-y-4" aria-label="Navigation mobile">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className="text-sm font-black uppercase tracking-[0.16em] text-white/80 transition hover:text-white"
              >
                {link.label}
              </a>
            ))}
            <div className="pt-4 border-t border-white/10 flex flex-col gap-3">
              <a
                href={appSignupUrl}
                className="fz-button-primary flex w-full items-center justify-center rounded-xl py-3 text-xs font-black uppercase tracking-[0.16em] shadow-[0_4px_16px_rgba(255,58,99,0.35)]"
              >
                {content.nav.createGroup}
              </a>
              <a
                href={appLoginUrl}
                className="flex w-full items-center justify-center rounded-xl border border-white/15 py-3 text-xs font-black uppercase tracking-[0.16em] text-white/90"
              >
                {content.nav.login}
              </a>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
