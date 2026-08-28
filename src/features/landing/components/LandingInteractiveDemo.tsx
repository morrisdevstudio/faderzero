import { useState, useEffect, useRef } from 'react';
import { FzIcon } from '@/ui/icons';
import { type Language, type LANDING_CONTENT } from '../i18n/landingContent';

interface LandingInteractiveDemoProps {
  content: (typeof LANDING_CONTENT)[Language];
}

type DemoTab = 'prompter' | 'setlist' | 'metronome';

export function LandingInteractiveDemo({ content }: LandingInteractiveDemoProps) {
  const [activeTab, setActiveTab] = useState<DemoTab>('prompter');

  // Prompter interactive state
  const [isScrolling, setIsScrolling] = useState(true);
  const prompterBoxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isScrolling) return;
    const interval = window.setInterval(() => {
      if (prompterBoxRef.current) {
        prompterBoxRef.current.scrollTop += 1;
        if (
          prompterBoxRef.current.scrollTop + prompterBoxRef.current.clientHeight >=
          prompterBoxRef.current.scrollHeight - 2
        ) {
          prompterBoxRef.current.scrollTop = 0;
        }
      }
    }, 45);
    return () => clearInterval(interval);
  }, [isScrolling]);

  // Metronome interactive state
  const [bpm, setBpm] = useState(93);
  const [isPlayingMetronome, setIsPlayingMetronome] = useState(false);
  const [metronomeTick, setMetronomeTick] = useState(0);

  useEffect(() => {
    if (!isPlayingMetronome) return;
    const ms = (60 / bpm) * 1000;
    const timer = window.setInterval(() => {
      setMetronomeTick((prev) => (prev + 1) % 4);
    }, ms);
    return () => clearInterval(timer);
  }, [isPlayingMetronome, bpm]);

  const demoData = content.demo;

  return (
    <section id="demo" className="py-20 sm:py-28 bg-[#0c0d10] border-t border-white/10">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex flex-col items-center text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-sky-500/30 bg-sky-500/10 px-3.5 py-1.5 text-xs font-black uppercase tracking-[0.18em] text-sky-300">
            {demoData.badge}
          </div>
          <h2 className="mt-4 max-w-3xl text-2xl font-black uppercase tracking-[0.08em] text-white sm:text-4xl">
            {demoData.title}
          </h2>
          <p className="mt-3 max-w-2xl text-sm sm:text-base text-white/60">
            {demoData.subtitle}
          </p>
        </div>

        {/* Interactive Tabs Selector */}
        <div className="mt-10 flex items-center justify-center">
          <div className="flex flex-wrap items-center justify-center gap-2 rounded-2xl border border-white/10 bg-[#12141c] p-1.5 shadow-2xl">
            {[
              { id: 'prompter' as const, label: demoData.tabs.prompter, icon: 'prompter' as const },
              { id: 'setlist' as const, label: demoData.tabs.setlist, icon: 'setlist' as const },
              { id: 'metronome' as const, label: demoData.tabs.metronome, icon: 'metronome' as const },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 rounded-xl px-5 py-2.5 text-xs font-black uppercase tracking-[0.14em] transition ${
                  activeTab === tab.id
                    ? 'bg-rose-500 text-white shadow-[0_0_16px_rgba(255,58,99,0.5)]'
                    : 'text-white/60 hover:bg-white/5 hover:text-white'
                }`}
              >
                <FzIcon name={tab.icon} usageId={`demo.tab.${tab.id}`} size="sm" />
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Interactive Workspace Screen */}
        <div className="mt-8 mx-auto max-w-3xl rounded-[2rem] border border-white/15 bg-[#090a0f] p-4 sm:p-8 shadow-2xl">
          {/* TAB 1: REAL PROMPTER */}
          {activeTab === 'prompter' && (
            <div className="space-y-4">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div>
                  <h4 className="text-sm font-black text-white">Rien à perdre</h4>
                  <p className="text-xs text-white/40 font-mono">93 BPM · 03:07 · A</p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsScrolling(!isScrolling)}
                  className={`flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-black uppercase tracking-wider transition ${
                    isScrolling
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : 'bg-white/10 text-white/80'
                  }`}
                >
                  <span className={`h-2 w-2 rounded-full ${isScrolling ? 'bg-emerald-400 animate-pulse' : 'bg-white/40'}`} />
                  <span>{isScrolling ? 'Défilement actif' : 'En pause'}</span>
                </button>
              </div>

              {/* Scrolling Lyrics */}
              <div
                ref={prompterBoxRef}
                className="h-64 overflow-y-auto rounded-xl bg-[#07080b] p-6 text-center text-xs space-y-4 scrollbar-none"
              >
                <div className="space-y-1">
                  <h5 className="text-emerald-400 font-bold text-xs">Couplet</h5>
                  <div className="text-white font-medium text-sm space-y-1">
                    <p>J'ai laissé mes doutes sur le quai</p>
                    <p>Avec les trains que j'ai manqués</p>
                    <p>Je prends la route sans savoir</p>
                    <p>Ce qui m'attend après ce soir</p>
                  </div>
                </div>

                <div className="space-y-1 pt-2">
                  <h5 className="text-emerald-400 font-bold text-xs">Refrain</h5>
                  <div className="text-white font-medium text-sm space-y-1">
                    <p>On n'a plus rien à perdre</p>
                    <p>Plus aucune raison d'attendre</p>
                    <p>On va courir, tomber, se relever</p>
                    <p>On n'a plus rien à perdre</p>
                    <p>Même si le monde veut nous prendre</p>
                    <p>Ce qu'il nous reste de Liberté</p>
                  </div>
                </div>

                <div className="space-y-1 pt-2">
                  <h5 className="text-emerald-400 font-bold text-xs">Couplet</h5>
                  <div className="text-white font-medium text-sm space-y-1">
                    <p>Les portes fermées, les faux départs</p>
                    <p>Ne changeront pas notre histoire</p>
                    <p>On a le bruit, on a le cœur</p>
                    <p>Et quelques rêves à toute heure</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: REAL SETLIST */}
          {activeTab === 'setlist' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div>
                  <h4 className="text-sm font-black text-white">aefazf</h4>
                  <p className="text-xs text-white/40">4 morceaux - 05:26</p>
                </div>
                <button
                  type="button"
                  className="rounded-xl bg-[#ff2d60] px-3.5 py-1.5 text-xs font-black text-white"
                >
                  + Ajouter des chansons
                </button>
              </div>

              {/* Real ordered items */}
              <div className="space-y-1">
                {[
                  { pos: '1', title: 'Rien à perdre', meta: '93 BPM - A - 03:07' },
                  { pos: '2', title: 'New', meta: '84 BPM - - Ton - 02:19' },
                  { pos: '3', title: 'Hors ligne scrib', meta: '-- BPM - - Ton - 00:00' },
                ].map((item, idx) => (
                  <div key={item.pos} className="space-y-1">
                    <div className="flex items-center justify-between rounded-xl border border-white/5 bg-[#12141c] p-3 text-xs">
                      <div className="flex items-center gap-3">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/10 text-xs font-bold text-white">
                          {item.pos}
                        </span>
                        <div>
                          <h5 className="font-bold text-white text-sm">{item.title}</h5>
                          <p className="text-white/40 font-mono text-xs">{item.meta}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 text-white/50 text-sm">
                        <span>↑</span>
                        <span>↓</span>
                        <span className="text-rose-400">🗑</span>
                      </div>
                    </div>
                    {idx < 2 && (
                      <div className="flex items-center gap-2 pl-6 py-0.5 text-xs text-white/40 font-mono">
                        <div className="h-2 w-px bg-white/20" />
                        <span>AJOUTER UNE TRANSITION...</span>
                        <span>✎</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: REAL METRONOME */}
          {activeTab === 'metronome' && (
            <div className="flex flex-col items-center justify-center space-y-6 py-4">
              {/* Dial Card */}
              <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#12141c] p-5 text-center space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-mono text-4xl font-black text-white">{bpm}</span>
                    <span className="ml-1 text-xs font-bold uppercase text-white/40">BPM</span>
                  </div>

                  <button
                    type="button"
                    onClick={() => setIsPlayingMetronome(!isPlayingMetronome)}
                    className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-500 text-black font-black text-lg shadow-[0_0_20px_rgba(245,158,11,0.5)] hover:scale-105 transition"
                  >
                    {isPlayingMetronome ? '❚❚' : '▶'}
                  </button>

                  <div className="text-right">
                    <span className="font-mono text-2xl font-black text-white">4/4</span>
                    <span className="ml-1 text-white/80">♩</span>
                  </div>
                </div>

                {/* 4 Beat horizontal lights */}
                <div className="grid grid-cols-4 gap-2">
                  {[0, 1, 2, 3].map((b) => (
                    <div
                      key={b}
                      className={`h-2.5 rounded transition ${
                        isPlayingMetronome && metronomeTick === b
                          ? 'bg-amber-400 shadow-[0_0_12px_#fbbf24]'
                          : 'bg-white/10'
                      }`}
                    />
                  ))}
                </div>
              </div>

              {/* BPM adjust buttons */}
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setBpm((prev) => Math.max(40, prev - 5))}
                  className="rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-xs font-bold text-white hover:bg-white/10"
                >
                  -5 BPM
                </button>
                <button
                  type="button"
                  onClick={() => setBpm((prev) => Math.min(260, prev + 5))}
                  className="rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-xs font-bold text-white hover:bg-white/10"
                >
                  +5 BPM
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
