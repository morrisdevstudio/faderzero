import { FzIcon } from '@/ui/icons';
import { SmartphoneFrame } from './SmartphoneFrame';
import {
  PhonePrompterView,
  PhoneSetlistView,
  PhoneMetronomeView,
  PhoneSongsView,
  PhoneCalendarView,
} from './RealAppScreenshots';
import { type Language, type LANDING_CONTENT } from '../i18n/landingContent';

interface LandingFeaturesGridProps {
  content: (typeof LANDING_CONTENT)[Language];
}

export function LandingFeaturesGrid({ content }: LandingFeaturesGridProps) {
  return (
    <section id="features" className="py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="flex flex-col items-center text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/5 px-3.5 py-1.5 text-xs font-black uppercase tracking-[0.18em] text-white/80">
            {content.features.badge}
          </div>
          <h2 className="mt-4 max-w-3xl text-2xl font-black uppercase tracking-[0.06em] text-white sm:text-4xl">
            {content.features.title}
          </h2>
          <p className="mt-4 max-w-2xl text-sm sm:text-base text-white/65">
            {content.features.subtitle}
          </p>
        </div>

        {/* Real Product Showcases in Smartphone Formats */}
        <div className="mt-14 space-y-16 sm:space-y-24">
          {/* 1. REAL PROMPTER IN SMARTPHONE */}
          <div id="prompter-showcase" className="rounded-[2.5rem] border border-sky-500/25 bg-[#0e1118]/90 p-6 sm:p-10 shadow-2xl backdrop-blur-xl">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
              <div className="lg:col-span-6 space-y-5">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-500/20 text-sky-400">
                    <FzIcon name="prompter" usageId="features.prompter.icon" size="md" />
                  </span>
                  <span className="text-xs font-black uppercase tracking-[0.18em] text-sky-400">
                    Module 01 · Prompteur Scène
                  </span>
                </div>
                <h3 className="text-2xl sm:text-3xl font-black uppercase tracking-[0.06em] text-white">
                  Prompteur de scène haute lisibilité avec repères de structure
                </h3>
                <p className="text-sm sm:text-base leading-relaxed text-white/70">
                  Défilement automatique fluide, repères visuels clairs (Couplets, Refrains, Ponts) en vert contrasté, tempo et tonalité rappelés en direct et mode plein écran pour pupitre et smartphone.
                </p>
                <div className="flex flex-wrap gap-2 pt-2">
                  <span className="rounded-lg border border-sky-500/25 bg-sky-500/10 px-3 py-1 text-xs font-bold text-sky-300">Sections Couplet / Refrain</span>
                  <span className="rounded-lg border border-sky-500/25 bg-sky-500/10 px-3 py-1 text-xs font-bold text-sky-300">Auto-scroll réglable</span>
                  <span className="rounded-lg border border-sky-500/25 bg-sky-500/10 px-3 py-1 text-xs font-bold text-sky-300">Mode plein écran ⛶</span>
                  <span className="rounded-lg border border-sky-500/25 bg-sky-500/10 px-3 py-1 text-xs font-bold text-sky-300">Maintien de l’écran allumé</span>
                </div>
              </div>

              {/* Smartphone Frame with Real Prompter View */}
              <div className="lg:col-span-6 flex justify-center">
                <SmartphoneFrame notchLabel="Prompteur Live">
                  <PhonePrompterView />
                </SmartphoneFrame>
              </div>
            </div>
          </div>

          {/* 2. REAL SETLIST IN SMARTPHONE */}
          <div className="rounded-[2.5rem] border border-fuchsia-500/25 bg-[#0e1118]/90 p-6 sm:p-10 shadow-2xl backdrop-blur-xl">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
              <div className="lg:col-span-6 space-y-5">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-fuchsia-500/20 text-fuchsia-400">
                    <FzIcon name="setlist" usageId="features.setlist.icon" size="md" />
                  </span>
                  <span className="text-xs font-black uppercase tracking-[0.18em] text-fuchsia-400">
                    Module 02 · Setlists & Transitions
                  </span>
                </div>
                <h3 className="text-2xl sm:text-3xl font-black uppercase tracking-[0.06em] text-white">
                  Ordre de passage de concert et transitions personnalisées
                </h3>
                <p className="text-sm sm:text-base leading-relaxed text-white/70">
                  Organisez vos morceaux dans l’ordre exact du show, réagencez vos titres d’un geste (↑ ↓), insérez des notes de transition entre chaque chanson et calculez le temps de jeu total.
                </p>
                <div className="flex flex-wrap gap-2 pt-2">
                  <span className="rounded-lg border border-fuchsia-500/25 bg-fuchsia-500/10 px-3 py-1 text-xs font-bold text-fuchsia-300">Réorganisation ↑ ↓</span>
                  <span className="rounded-lg border border-fuchsia-500/25 bg-fuchsia-500/10 px-3 py-1 text-xs font-bold text-fuchsia-300">Notes de transition</span>
                  <span className="rounded-lg border border-fuchsia-500/25 bg-fuchsia-500/10 px-3 py-1 text-xs font-bold text-fuchsia-300">Calcul des durées</span>
                  <span className="rounded-lg border border-fuchsia-500/25 bg-fuchsia-500/10 px-3 py-1 text-xs font-bold text-fuchsia-300">Export régie</span>
                </div>
              </div>

              {/* Smartphone Frame with Real Setlist View */}
              <div className="lg:col-span-6 flex justify-center">
                <SmartphoneFrame notchLabel="Setlist Concert">
                  <PhoneSetlistView />
                </SmartphoneFrame>
              </div>
            </div>
          </div>

          {/* 3. REAL METRONOME IN SMARTPHONE */}
          <div className="rounded-[2.5rem] border border-amber-500/25 bg-[#0e1118]/90 p-6 sm:p-10 shadow-2xl backdrop-blur-xl">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
              <div className="lg:col-span-6 space-y-5">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/20 text-amber-400">
                    <FzIcon name="metronome" usageId="features.metro.icon" size="md" />
                  </span>
                  <span className="text-xs font-black uppercase tracking-[0.18em] text-amber-400">
                    Module 03 · Métronome Scène
                  </span>
                </div>
                <h3 className="text-2xl sm:text-3xl font-black uppercase tracking-[0.06em] text-white">
                  Métronome visuel synchronisé à votre liste de morceaux
                </h3>
                <p className="text-sm sm:text-base leading-relaxed text-white/70">
                  Cadran de BPM précis avec flash visuel des temps de la mesure (4/4, 3/4) et sélection directe du tempo enregistré pour chaque chanson de votre groupe.
                </p>
                <div className="flex flex-wrap gap-2 pt-2">
                  <span className="rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-1 text-xs font-bold text-amber-300">BPM calé par morceau</span>
                  <span className="rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-1 text-xs font-bold text-amber-300">Barres visuelles de mesure</span>
                  <span className="rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-1 text-xs font-bold text-amber-300">Signatures rythmiques</span>
                </div>
              </div>

              {/* Smartphone Frame with Real Metronome View */}
              <div className="lg:col-span-6 flex justify-center">
                <SmartphoneFrame notchLabel="Métronome 93 BPM">
                  <PhoneMetronomeView />
                </SmartphoneFrame>
              </div>
            </div>
          </div>

          {/* 4. REAL SONGS REPERTOIRE IN SMARTPHONE */}
          <div className="rounded-[2.5rem] border border-indigo-500/25 bg-[#0e1118]/90 p-6 sm:p-10 shadow-2xl backdrop-blur-xl">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
              <div className="lg:col-span-6 space-y-5">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/20 text-indigo-400">
                    <FzIcon name="songs" usageId="features.songs.icon" size="md" />
                  </span>
                  <span className="text-xs font-black uppercase tracking-[0.18em] text-indigo-400">
                    Module 04 · Répertoire de Morceaux
                  </span>
                </div>
                <h3 className="text-2xl sm:text-3xl font-black uppercase tracking-[0.06em] text-white">
                  Bibliothèque centralisée des paroles et fichiers audio
                </h3>
                <p className="text-sm sm:text-base leading-relaxed text-white/70">
                  Retrouvez tous les titres de votre groupe avec leurs paroles complètes, tempos, tonalités, durées et fichiers audio de référence rattachés.
                </p>
                <div className="flex flex-wrap gap-2 pt-2">
                  <span className="rounded-lg border border-indigo-500/25 bg-indigo-500/10 px-3 py-1 text-xs font-bold text-indigo-300">Paroles & structures</span>
                  <span className="rounded-lg border border-indigo-500/25 bg-indigo-500/10 px-3 py-1 text-xs font-bold text-indigo-300">Tempos & tonalités</span>
                  <span className="rounded-lg border border-indigo-500/25 bg-indigo-500/10 px-3 py-1 text-xs font-bold text-indigo-300">Fichiers audio rattachés</span>
                </div>
              </div>

              {/* Smartphone Frame with Real Songs View */}
              <div className="lg:col-span-6 flex justify-center">
                <SmartphoneFrame notchLabel="Répertoire Morceaux">
                  <PhoneSongsView />
                </SmartphoneFrame>
              </div>
            </div>
          </div>

          {/* 5. REAL CALENDAR IN SMARTPHONE */}
          <div className="rounded-[2.5rem] border border-teal-500/25 bg-[#0e1118]/90 p-6 sm:p-10 shadow-2xl backdrop-blur-xl">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
              <div className="lg:col-span-6 space-y-5">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-500/20 text-teal-400">
                    <FzIcon name="calendar" usageId="features.calendar.icon" size="md" />
                  </span>
                  <span className="text-xs font-black uppercase tracking-[0.18em] text-teal-400">
                    Module 05 · Planning & Balances
                  </span>
                </div>
                <h3 className="text-2xl sm:text-3xl font-black uppercase tracking-[0.06em] text-white">
                  Calendrier de répétitions, balances et dates de concert
                </h3>
                <p className="text-sm sm:text-base leading-relaxed text-white/70">
                  Visualisez les dates à venir pour tout le groupe avec adresses des salles, horaires d’arrivée et de balances, et plannings de répétitions.
                </p>
                <div className="flex flex-wrap gap-2 pt-2">
                  <span className="rounded-lg border border-teal-500/25 bg-teal-500/10 px-3 py-1 text-xs font-bold text-teal-300">Horaires de balances</span>
                  <span className="rounded-lg border border-teal-500/25 bg-teal-500/10 px-3 py-1 text-xs font-bold text-teal-300">Adresses & Lieux</span>
                  <span className="rounded-lg border border-teal-500/25 bg-teal-500/10 px-3 py-1 text-xs font-bold text-teal-300">Disponibilités groupe</span>
                </div>
              </div>

              {/* Smartphone Frame with Real Calendar View */}
              <div className="lg:col-span-6 flex justify-center">
                <SmartphoneFrame notchLabel="Calendrier Groupe">
                  <PhoneCalendarView />
                </SmartphoneFrame>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
