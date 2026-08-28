import { FzIcon } from '@/ui/icons';
import { type Language, type LANDING_CONTENT } from '../i18n/landingContent';

interface LandingOfflineBannerProps {
  content: (typeof LANDING_CONTENT)[Language];
}

export function LandingOfflineBanner({ content }: LandingOfflineBannerProps) {
  return (
    <section id="offline" className="relative py-16 sm:py-24 border-y border-white/10 bg-[#0e1017]">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
          {/* Left copy */}
          <div className="lg:col-span-6 space-y-5">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-1 text-xs font-black uppercase tracking-[0.18em] text-emerald-300">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              {content.offlineBanner.tag}
            </div>

            <h2 className="text-2xl sm:text-4xl font-black uppercase tracking-[0.08em] text-white leading-tight">
              {content.offlineBanner.title}
            </h2>

            <p className="text-sm sm:text-base leading-relaxed text-white/70">
              {content.offlineBanner.description}
            </p>

            <div className="space-y-3 pt-2">
              {content.offlineBanner.points.map((pt, i) => (
                <div key={i} className="flex items-start gap-3.5">
                  <div className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-400">
                    <FzIcon name="check" usageId={`landing.offline.check.${i}`} size="sm" />
                  </div>
                  <div>
                    <h4 className="text-xs sm:text-sm font-black uppercase tracking-[0.1em] text-white">
                      {pt.title}
                    </h4>
                    <p className="text-xs text-white/60 mt-0.5 leading-relaxed">{pt.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right visual card */}
          <div className="lg:col-span-6">
            <div className="relative rounded-[2rem] border border-white/10 bg-black/60 p-6 sm:p-8 shadow-2xl overflow-hidden">
              <div className="absolute -right-10 -bottom-10 h-48 w-48 rounded-full bg-emerald-500/10 blur-[80px]" />

              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-500/20 text-[#ff3a63]">
                    <FzIcon name="record" usageId="landing.offline.mic" size="md" />
                  </div>
                  <div>
                    <h5 className="text-xs font-black uppercase tracking-[0.14em] text-white">
                      Studio Sous-Sol / Cave
                    </h5>
                    <p className="text-[0.7rem] text-white/50">Mode déconnecté autonome</p>
                  </div>
                </div>
                <span className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-[0.68rem] font-black uppercase tracking-[0.14em] text-amber-300">
                  Mode Hors-Ligne OK
                </span>
              </div>

              <div className="mt-6 space-y-3">
                <div className="flex items-center justify-between rounded-xl bg-white/5 p-3.5 border border-white/5">
                  <div className="flex items-center gap-3">
                    <span className="text-base">📦</span>
                    <span className="text-xs font-bold text-white">Base locale IndexedDB active</span>
                  </div>
                  <span className="text-xs font-mono font-black text-emerald-400">100% DISPO</span>
                </div>

                <div className="flex items-center justify-between rounded-xl bg-white/5 p-3.5 border border-white/5">
                  <div className="flex items-center gap-3">
                    <span className="text-base">⚡</span>
                    <span className="text-xs font-bold text-white">Latence de lecture du prompteur</span>
                  </div>
                  <span className="text-xs font-mono font-black text-emerald-400">0 ms</span>
                </div>

                <div className="flex items-center justify-between rounded-xl bg-white/5 p-3.5 border border-white/5">
                  <div className="flex items-center gap-3">
                    <span className="text-base">🔄</span>
                    <span className="text-xs font-bold text-white">Synchronisation automatique cloud</span>
                  </div>
                  <span className="text-xs font-mono font-black text-sky-400">Dès reconnexion</span>
                </div>
              </div>

              <div className="mt-6 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3.5 text-center text-xs font-medium text-emerald-300/90">
                Vos répétitions ne dépendent d’aucun serveur ni d’aucun routeur.
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
