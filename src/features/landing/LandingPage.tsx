import { useEffect } from 'react';
import { useLandingLanguage } from './i18n/landingContent';
import { LandingHeader } from './components/LandingHeader';
import { LandingHero } from './components/LandingHero';
import { LandingFooter } from './components/LandingFooter';
import { LandingPricing } from './components/LandingPricing';
import { LandingNarrative } from './components/LandingNarrative';
import { LandingOfflineBanner } from './components/LandingOfflineBanner';
import { LandingFeaturesGrid } from './components/LandingFeaturesGrid';
import { LandingInteractiveDemo } from './components/LandingInteractiveDemo';
import { LandingUseCases } from './components/LandingUseCases';
import { LandingFaq } from './components/LandingFaq';

export function LandingPage() {
  const { lang, setLang, content } = useLandingLanguage();

  useEffect(() => {
    document.documentElement.lang = lang;
    document.title = content.seo.title;
    const description = document.querySelector('meta[name="description"]') ?? document.head.appendChild(document.createElement('meta'));
    description.setAttribute('name', 'description');
    description.setAttribute('content', content.seo.description);
  }, [content.seo.description, content.seo.title, lang]);

  return (
    <div className="min-h-screen bg-[#0c0d10] text-[#f5f0ea] selection:bg-[#ff3a63] selection:text-white font-sans antialiased overflow-x-hidden">
      {/* Top sticky nav */}
      <LandingHeader content={content} currentLang={lang} onSelectLang={setLang} />

      <main>
        {/* Hero with interactive preview */}
        <LandingHero content={content} lang={lang} />

        {lang === 'fr' ? (
          <LandingNarrative />
        ) : (
          <>
            <LandingOfflineBanner content={content} />
            <LandingFeaturesGrid content={content} />
            <LandingInteractiveDemo content={content} />
            <LandingUseCases content={content} />
          </>
        )}

        <LandingPricing content={content} />

        <LandingFaq content={content} />
      </main>

      {/* Footer */}
      <LandingFooter content={content} currentLang={lang} onSelectLang={setLang} />
    </div>
  );
}
