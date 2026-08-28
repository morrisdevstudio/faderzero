import { useState, useEffect, useRef } from 'react';
import { FzIcon } from '@/ui/icons';
import { SmartphoneFrame } from './SmartphoneFrame';
import { PhoneHomeView } from './RealAppScreenshots';
import { type Language, type LANDING_CONTENT } from '../i18n/landingContent';
import { getAppUrl } from '@/utils/domainRouting';

interface LandingHeroProps {
  content: (typeof LANDING_CONTENT)[Language];
}

const REAL_SONG_SECTIONS = [
  {
    type: 'Couplet',
    lines: [
      "J'ai laissé mes doutes sur le quai",
      "Avec les trains que j'ai manqués",
      'Je prends la route sans savoir',
      "Ce qui m'attend après ce soir",
    ],
  },
  {
    type: 'Refrain',
    lines: [
      "On n'a plus rien à perdre",
      "Plus aucune raison d'attendre",
      'On va courir, tomber, se relever',
      "On n'a plus rien à perdre",
      'Même si le monde veut nous prendre',
      "Ce qu'il nous reste de Liberté",
    ],
  },
  {
    type: 'Couplet',
    lines: [
      'Les portes fermées, les faux départs',
      'Ne changeront pas notre histoire',
      'On a le bruit, on a le cœur',
      'Et quelques rêves à toute heure',
    ],
  },
];

export function LandingHero({ content }: LandingHeroProps) {
  const appSignupUrl = getAppUrl('/?view=app');
  const [isPaused, setIsPaused] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Live auto-scroll matching real Prompter engine
  useEffect(() => {
    if (isPaused) return;
    let animationFrameId: number;
    let lastTime = performance.now();

    const step = (time: number) => {
      const elapsed = Math.min(time - lastTime, 50);
      lastTime = time;

      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTop += elapsed * 0.032;
        if (
          scrollContainerRef.current.scrollTop + scrollContainerRef.current.clientHeight >=
          scrollContainerRef.current.scrollHeight - 2
        ) {
          scrollContainerRef.current.scrollTop = 0;
        }
      }
      animationFrameId = requestAnimationFrame(step);
    };

    animationFrameId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(animationFrameId);
  }, [isPaused]);

  return (
    <section className="relative overflow-hidden pt-10 pb-20 sm:pt-16 sm:pb-28 lg:pb-32">
      {/* Background ambient lighting */}
      <div className="pointer-events-none absolute inset-0 -z-10 flex items-center justify-center">
        <div className="h-[360px] w-[360px] sm:h-[520px] sm:w-[680px] rounded-full bg-[#ff3a63]/14 blur-[130px] sm:blur-[180px]" />
        <div className="absolute -top-12 right-1/4 h-[300px] w-[300px] rounded-full bg-indigo-600/12 blur-[140px]" />
      </div>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center text-center">
          {/* Top Stage Badge */}
          <div className="inline-flex items-center gap-2 rounded-full border border-rose-500/35 bg-rose-500/10 px-4 py-1.5 text-xs font-black uppercase tracking-[0.18em] text-rose-300 shadow-[0_0_24px_rgba(255,58,99,0.25)]">
            <span className="h-2 w-2 rounded-full bg-[#ff3a63] animate-pulse" />
            {content.hero.badge}
          </div>

          {/* Headline */}
          <h1 className="mt-6 max-w-4xl text-3xl font-black uppercase tracking-[0.06em] text-white sm:text-5xl lg:text-6xl sm:leading-[1.12]">
            <span>{content.hero.titleHighlight} </span>
            <span className="bg-gradient-to-r from-[#ff3a63] via-rose-300 to-amber-200 bg-clip-text text-transparent">
              {content.hero.titleEnd}
            </span>
          </h1>

          {/* Subtitle */}
          <p className="mt-5 max-w-2xl text-sm sm:text-base lg:text-lg leading-relaxed text-white/75 font-medium">
            {content.hero.subtitle}
          </p>

          {/* Action CTAs */}
          <div className="mt-8 flex flex-col w-full sm:w-auto sm:flex-row items-center justify-center gap-3.5">
            <a
              href={appSignupUrl}
              className="fz-button-primary flex w-full sm:w-auto items-center justify-center gap-2 rounded-2xl px-8 py-4 text-xs sm:text-sm font-black uppercase tracking-[0.18em] shadow-[0_8px_32px_rgba(255,58,99,0.45)] transition hover:scale-[1.02] active:scale-95"
            >
              <span>{content.hero.ctaPrimary}</span>
              <FzIcon name="add" usageId="landing.hero.cta.add" size="sm" />
            </a>

            <a
              href="#prompter-showcase"
              className="flex w-full sm:w-auto items-center justify-center gap-2 rounded-2xl border border-white/20 bg-white/5 px-7 py-4 text-xs sm:text-sm font-black uppercase tracking-[0.18em] text-white transition hover:bg-white/10 hover:border-white/30"
            >
              <span>{content.hero.ctaSecondary}</span>
              <FzIcon name="prompter" usageId="landing.hero.cta.prompter" size="sm" />
            </a>
          </div>

          {/* Trust proof */}
          <p className="mt-5 flex items-center justify-center gap-2 text-xs font-bold text-white/50">
            <FzIcon name="check" usageId="landing.hero.trust" size="sm" className="text-emerald-400" />
            <span>{content.hero.pwaProof}</span>
          </p>
        </div>

        {/* HERO REAL SMARTPHONE INCRUSTATIONS (COCKPIT + LIVE PROMPTER) */}
        <div className="mt-14 sm:mt-20 flex flex-col lg:flex-row items-center justify-center gap-8 lg:gap-12 max-w-5xl mx-auto">
          {/* Smartphone 1: Real Stage Prompter */}
          <div className="w-full max-w-[340px]">
            <SmartphoneFrame notchLabel="Prompteur Live">
              <div className="flex h-full flex-col justify-between text-left font-sans bg-[#07080b] -m-3.5 p-3.5">
                {/* Real Prompter Header */}
                <div className="flex items-center justify-between border-b border-white/10 pb-2.5 text-xs">
                  <span className="text-white/60 text-sm cursor-pointer">✕</span>
                  <div className="text-center">
                    <p className="text-[0.6rem] font-black uppercase tracking-[0.14em] text-white">FaderZero</p>
                    <p className="text-[0.55rem] font-bold text-white/40 uppercase tracking-wider">Prompteur · Live</p>
                  </div>
                  <div className="flex items-center gap-2 text-white/60">
                    <span className="text-xs">⛶</span>
                    <span className="text-xs">⚙</span>
                  </div>
                </div>

                {/* Song Bar */}
                <div className="text-center pt-2 pb-1 border-b border-white/5">
                  <h3 className="text-sm font-black text-white">Rien à perdre</h3>
                  <p className="text-[0.62rem] text-white/50 font-mono">93 BPM · 03:07 · A</p>
                </div>

                {/* Live Scrolling Real Lyrics */}
                <div
                  ref={scrollContainerRef}
                  className="h-64 overflow-y-auto space-y-4 py-2 text-center text-xs scrollbar-none"
                >
                  {REAL_SONG_SECTIONS.map((section, idx) => (
                    <div key={idx} className="space-y-1.5">
                      <h4 className="text-emerald-400 font-bold text-[0.72rem]">{section.type}</h4>
                      <div className="text-white font-medium text-[0.78rem] space-y-1">
                        {section.lines.map((line, lIdx) => (
                          <p key={lIdx}>{line}</p>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Bottom Bar with Auto-scroll toggle and New button */}
                <div className="flex items-center justify-between pt-1 border-t border-white/10">
                  <button
                    type="button"
                    onClick={() => setIsPaused(!isPaused)}
                    className="flex items-center gap-1.5 text-[0.62rem] font-bold text-white/80 hover:text-white"
                  >
                    <span className={`h-2 w-2 rounded-full ${isPaused ? 'bg-amber-400' : 'bg-emerald-400'}`} />
                    <span>{isPaused ? 'Reprendre' : 'Auto-scroll actif'}</span>
                  </button>
                  <div className="rounded-xl border border-white/10 bg-[#12151e] px-2.5 py-1 text-[0.6rem] font-bold text-white/80">
                    New ›
                  </div>
                </div>
              </div>
            </SmartphoneFrame>
          </div>

          {/* Smartphone 2: Cockpit Home */}
          <div className="w-full max-w-[340px] hidden sm:block">
            <SmartphoneFrame notchLabel="Cockpit Groupe">
              <PhoneHomeView />
            </SmartphoneFrame>
          </div>
        </div>
      </div>
    </section>
  );
}
