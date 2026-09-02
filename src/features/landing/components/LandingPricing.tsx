import { FzIcon } from '@/ui/icons';
import { getAppUrl } from '@/utils/domainRouting';
import { type Language, type LANDING_CONTENT } from '../i18n/landingContent';

export function LandingPricing({ content }: { content: (typeof LANDING_CONTENT)[Language] }) {
  const appUrl = getAppUrl('/?view=app');
  const labels = content.pricing;

  return <section id="pricing" className="border-y border-white/10 bg-[#090a0d] py-20 sm:py-28">
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl text-center">
        <p className="inline-flex rounded-full border border-rose-500/30 bg-rose-500/10 px-3.5 py-1.5 text-xs font-black uppercase tracking-[.18em] text-rose-300">{labels.badge}</p>
        <h2 className="mt-4 text-2xl font-black uppercase tracking-[.06em] text-white sm:text-4xl">{labels.title}</h2>
        <p className="mt-4 text-sm text-white/65 sm:text-base">{labels.subtitle}</p>
      </div>
      <div className="mt-12 grid gap-5 md:grid-cols-3">
        {labels.plans.map((plan, index) => <article key={plan.name} className={`flex flex-col rounded-[1.8rem] border p-6 ${index === 2 ? 'border-rose-400/60 bg-rose-500/[.08]' : 'border-white/10 bg-[#12141c]'}`}>
          <div className="flex items-start justify-between gap-3"><h3 className="text-xl font-black uppercase tracking-[.08em] text-white">{plan.name}</h3>{index > 0 ? <span className="rounded-full bg-rose-500/15 px-2 py-1 text-[.62rem] font-black uppercase tracking-[.12em] text-rose-200">{labels.launch}</span> : null}</div>
          <p className="mt-5 text-3xl font-black text-white">{plan.monthly}<span className="ml-1 text-xs font-bold text-white/50">/ {labels.monthly.toLowerCase()}</span></p>
          <p className="mt-1 text-sm font-bold text-rose-200">{plan.annual} / {labels.annual.toLowerCase()} · {plan.group}</p>
          <dl className="mt-6 space-y-3 border-t border-white/10 pt-5 text-sm text-white/75"><div className="flex justify-between gap-3"><dt>{labels.includedAudio}</dt><dd className="font-black text-white">{plan.audio}</dd></div><div className="flex justify-between gap-3"><dt>{labels.epk}</dt><dd className="font-black text-white">{plan.epk}</dd></div></dl>
          <a href={appUrl} className="fz-button-primary mt-8 flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-xs font-black uppercase tracking-[.14em]"><span>{labels.cta}</span><FzIcon name="add" usageId={`landing.pricing.${index}.cta`} size="sm" /></a>
        </article>)}
      </div>
    </div>
  </section>;
}
