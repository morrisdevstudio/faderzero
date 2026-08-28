import { useEffect } from 'react';
import { useLandingLanguage } from './i18n/landingContent';
import { LandingHeader } from './components/LandingHeader';
import { LandingHero } from './components/LandingHero';
import { LandingOfflineBanner } from './components/LandingOfflineBanner';
import { LandingFeaturesGrid } from './components/LandingFeaturesGrid';
import { LandingInteractiveDemo } from './components/LandingInteractiveDemo';
import { LandingUseCases } from './components/LandingUseCases';
import { LandingFaq } from './components/LandingFaq';
import { LandingFooter } from './components/LandingFooter';

export function LandingPage() {
  const { lang, setLang, content } = useLandingLanguage();

  useEffect(() => {
    document.title =
      lang === 'fr'
        ? 'FaderZero — Le hub tout-en-un pour groupes et musiciens de scène (Offline-First PWA)'
        : 'FaderZero — The all-in-one hub for bands & stage musicians (Offline-First PWA)';
  }, [lang]);

  return (
    <div className="min-h-screen bg-[#0c0d10] text-[#f5f0ea] selection:bg-[#ff3a63] selection:text-white font-sans antialiased overflow-x-hidden">
      {/* Top sticky nav */}
      <LandingHeader content={content} currentLang={lang} onSelectLang={setLang} />

      <main>
        {/* Hero with interactive preview */}
        <LandingHero content={content} />

        {/* Offline superpower banner */}
        <LandingOfflineBanner content={content} />

        {/* 6 Core Pillars Grid */}
        <LandingFeaturesGrid content={content} />

        {/* Live Interactive Sandbox */}
        <LandingInteractiveDemo content={content} />

        {/* Band and Artist Use Cases */}
        <LandingUseCases content={content} />

        {/* FAQ */}
        <LandingFaq content={content} />
      </main>

      {/* Footer */}
      <LandingFooter content={content} currentLang={lang} onSelectLang={setLang} />
    </div>
  );
}
