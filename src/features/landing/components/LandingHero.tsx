import { FzIcon } from '@/ui/icons';
import { getAppUrl } from '@/utils/domainRouting';
import { SmartphoneFrame } from './SmartphoneFrame';
import { PhoneHomeView, PhonePrompterView, PhoneSetlistView } from './RealAppScreenshots';
import { type Language, type LANDING_CONTENT } from '../i18n/landingContent';

export function LandingHero({ content, lang }: { content: (typeof LANDING_CONTENT)[Language]; lang: Language }) {
  const appUrl = getAppUrl('/?view=app');
  const copy = lang === 'fr'
    ? {
        eyebrow: 'L’espace de travail du groupe',
        title: 'Du premier riff',
        titleMuted: 'au dernier rappel.',
        description: 'Morceaux, audio, setlists, calendrier, prompteur et métronome dans un seul espace pensé pour la répétition et la scène — même quand le réseau décroche.',
        workflow: 'Découvrir le workflow',
        group: 'Conçu pour les groupes',
        home: 'Cockpit groupe',
        prompter: 'Prompteur',
      }
    : {
        eyebrow: 'The band workspace',
        title: 'From the first riff',
        titleMuted: 'to the final encore.',
        description: 'Songs, audio, setlists, calendar, prompter, and metronome in one workspace built for rehearsals and the stage—even when the network drops.',
        workflow: 'Explore the features',
        group: 'Built for bands',
        home: 'Band cockpit',
        prompter: 'Prompter',
      };
  return <section id="top" className="relative isolate overflow-hidden border-b border-white/10 pb-16 pt-28 sm:pb-24 sm:pt-36">
    <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[42rem] bg-[radial-gradient(ellipse_at_58%_30%,rgba(255,58,99,.16),transparent_46%),radial-gradient(ellipse_at_85%_12%,rgba(255,255,255,.07),transparent_40%)]" />
    <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 sm:px-6 lg:grid-cols-[.85fr_1.15fr] lg:gap-14 lg:px-8">
      <div><p className="mb-6 flex items-center gap-2 text-xs font-black uppercase tracking-[.16em] text-white/65 before:h-0.5 before:w-7 before:bg-[#ff3a63]">{copy.eyebrow}</p><h1 className="max-w-xl text-[3.55rem] font-black leading-[.86] tracking-[-.065em] text-white sm:text-7xl lg:text-[5.55rem]">{copy.title}<br /><span className="text-white/40">{copy.titleMuted}</span></h1><p className="mt-7 max-w-xl text-base leading-relaxed text-white/65 sm:text-lg">{copy.description}</p><div className="mt-8 flex flex-col gap-3 sm:flex-row"><a href={appUrl} className="fz-button-primary flex min-h-12 items-center justify-center gap-2 rounded-[.9rem] px-5 text-sm font-black">{content.hero.ctaPrimary} <FzIcon name="add" usageId="landing.hero.try" size="sm" /></a><a href={lang === 'fr' ? '#workflow' : '#offline'} className="flex min-h-12 items-center justify-center rounded-[.9rem] border border-white/15 bg-white/[.025] px-5 text-sm font-black text-white/85">{copy.workflow}</a></div><div className="mt-7 flex flex-wrap gap-x-5 gap-y-2 text-[.65rem] font-mono uppercase tracking-[.08em] text-white/45"><span className="flex items-center gap-2"><i className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Mobile-first</span><span>Offline-first</span><span>{copy.group}</span></div></div>
      <div className="relative mx-auto flex h-[36rem] w-full max-w-[42rem] items-center justify-center sm:h-[42rem]" aria-label={lang === 'fr' ? 'Aperçus de FaderZero' : 'FaderZero previews'}><div className="pointer-events-none absolute h-[28rem] w-[28rem] rounded-full bg-[#ff3a63]/15 blur-[90px]" /><div className="absolute left-0 top-28 hidden w-[13.8rem] -rotate-6 opacity-70 lg:block"><SmartphoneFrame notchLabel="Setlist"><PhoneSetlistView /></SmartphoneFrame></div><div className="relative z-10 w-[15.8rem] sm:w-[17.6rem]"><SmartphoneFrame notchLabel={copy.home}><PhoneHomeView /></SmartphoneFrame></div><div className="absolute right-0 top-32 hidden w-[13.8rem] rotate-6 opacity-80 lg:block"><SmartphoneFrame notchLabel={copy.prompter}><PhonePrompterView /></SmartphoneFrame></div></div>
    </div>
  </section>;
}
