import { useState } from 'react';
import { type Language, type LANDING_CONTENT } from '../i18n/landingContent';

interface LandingFaqProps {
  content: (typeof LANDING_CONTENT)[Language];
}

export function LandingFaq({ content }: LandingFaqProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  function toggleFaq(index: number) {
    setOpenIndex(openIndex === index ? null : index);
  }

  return (
    <section id="faq" className="py-20 sm:py-28 bg-[#090a0d] border-t border-white/10">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3.5 py-1.5 text-xs font-black uppercase tracking-[0.18em] text-white/70">
            {content.faq.badge}
          </div>
          <h2 className="mt-4 text-2xl font-black uppercase tracking-[0.08em] text-white sm:text-4xl">
            {content.faq.title}
          </h2>
        </div>

        <div className="mt-12 space-y-4">
          {content.faq.items.map((item, idx) => {
            const isOpen = openIndex === idx;

            return (
              <div
                key={idx}
                className="rounded-[1.4rem] border border-white/10 bg-[#12141c]/90 transition overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() => toggleFaq(idx)}
                  className="flex w-full items-center justify-between p-5 sm:p-6 text-left transition hover:bg-white/5"
                  aria-expanded={isOpen}
                >
                  <span className="text-sm sm:text-base font-black text-white pr-4">
                    {item.q}
                  </span>
                  <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/5 text-white/70 transition transform ${
                      isOpen ? 'rotate-180 bg-white/15 text-white' : ''
                    }`}
                  >
                    ▼
                  </span>
                </button>

                {isOpen && (
                  <div className="px-5 pb-6 sm:px-6 text-xs sm:text-sm leading-relaxed text-white/70 border-t border-white/5 pt-4">
                    {item.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
