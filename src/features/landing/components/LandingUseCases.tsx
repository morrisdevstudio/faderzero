import { FzIcon } from '@/ui/icons';
import { type Language, type LANDING_CONTENT } from '../i18n/landingContent';

interface LandingUseCasesProps {
  content: (typeof LANDING_CONTENT)[Language];
}

export function LandingUseCases({ content }: LandingUseCasesProps) {
  const icons = ['songs', 'setlist', 'prompter'] as const;

  return (
    <section id="use-cases" className="py-20 sm:py-28 border-t border-white/10">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-rose-500/30 bg-rose-500/10 px-3.5 py-1.5 text-xs font-black uppercase tracking-[0.18em] text-rose-300">
            {content.useCases.badge}
          </div>
          <h2 className="mt-4 max-w-3xl text-2xl font-black uppercase tracking-[0.08em] text-white sm:text-4xl">
            {content.useCases.title}
          </h2>
        </div>

        <div className="mt-14 grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
          {content.useCases.items.map((item, idx) => (
            <div
              key={item.title}
              className="flex flex-col justify-between rounded-[1.8rem] border border-white/10 bg-[#101218]/90 p-6 sm:p-8 backdrop-blur-xl transition hover:border-white/20"
            >
              <div>
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/5 text-white/90 border border-white/10 mb-6">
                  <FzIcon name={icons[idx] || 'songs'} usageId={`landing.usecase.${idx}`} size="lg" />
                </div>
                <h3 className="text-base sm:text-lg font-black uppercase tracking-[0.08em] text-white">
                  {item.title}
                </h3>
                <p className="mt-3 text-xs sm:text-sm leading-relaxed text-white/65">
                  {item.desc}
                </p>
              </div>

              <div className="mt-6 border-t border-white/10 pt-4">
                <span className="inline-flex items-center gap-2 text-xs font-bold text-rose-300">
                  <span>→</span>
                  <span>{item.highlight}</span>
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
