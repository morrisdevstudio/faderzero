import { FzIcon } from '@/ui/icons';
import { FaderLogo } from '@/ui/components/FaderLogo';
import { AppHeader } from '@/ui/components/AppHeader';

/**
 * Authentic FaderZero Bottom Navigation Bar Component
 */
export function RealBottomNav({ activeTab = 'setlist' }: { activeTab?: 'home' | 'calendar' | 'record' | 'songs' | 'setlist' }) {
  return (
    <nav className="sticky bottom-0 -mx-3.5 -mb-3.5 mt-auto border-t border-white/10 bg-[#0c0d10]/98 backdrop-blur-xl px-1 py-1.5 z-20">
      <div className="flex items-center justify-around">
        {/* 1. Accueil */}
        <div className={`flex flex-1 flex-col items-center justify-center gap-0.5 py-0.5 text-center ${activeTab === 'home' ? 'text-[#ff3a63] font-bold' : 'text-white/40'}`}>
          <FzIcon name="home" usageId="nav.mock.home" className={`h-4 w-4 ${activeTab === 'home' ? 'text-[#ff3a63]' : 'text-white/40'}`} />
          <span className="text-[0.55rem] uppercase tracking-wider">Accueil</span>
          <span className={`h-1 w-1 rounded-full ${activeTab === 'home' ? 'bg-[#ff3a63]' : 'bg-transparent'}`} />
        </div>

        {/* 2. Calendrier */}
        <div className={`flex flex-1 flex-col items-center justify-center gap-0.5 py-0.5 text-center ${activeTab === 'calendar' ? 'text-teal-400 font-bold' : 'text-white/40'}`}>
          <FzIcon name="calendar" usageId="nav.mock.cal" className={`h-4 w-4 ${activeTab === 'calendar' ? 'text-teal-400' : 'text-white/40'}`} />
          <span className="text-[0.55rem] uppercase tracking-wider">Calendrier</span>
          <span className={`h-1 w-1 rounded-full ${activeTab === 'calendar' ? 'bg-teal-400' : 'bg-transparent'}`} />
        </div>

        {/* 3. Central Red Glowing Record Button */}
        <div className="relative -top-2 flex flex-1 flex-col items-center justify-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-b from-red-500 to-red-700 shadow-[0_0_18px_rgba(239,68,68,0.65)] ring-2 ring-red-400 ring-offset-2 ring-offset-[#0c0d10]">
            <span className="h-3 w-3 rounded-full bg-white shadow-inner animate-pulse" />
          </div>
        </div>

        {/* 4. Morceaux */}
        <div className={`flex flex-1 flex-col items-center justify-center gap-0.5 py-0.5 text-center ${activeTab === 'songs' ? 'text-indigo-400 font-bold' : 'text-white/40'}`}>
          <FzIcon name="songs" usageId="nav.mock.songs" className={`h-4 w-4 ${activeTab === 'songs' ? 'text-indigo-400' : 'text-white/40'}`} />
          <span className="text-[0.55rem] uppercase tracking-wider">Morceaux</span>
          <span className={`h-1 w-1 rounded-full ${activeTab === 'songs' ? 'bg-indigo-400' : 'bg-transparent'}`} />
        </div>

        {/* 5. Setlist */}
        <div className={`flex flex-1 flex-col items-center justify-center gap-0.5 py-0.5 text-center ${activeTab === 'setlist' ? 'text-fuchsia-400 font-bold' : 'text-white/40'}`}>
          <FzIcon name="setlist" usageId="nav.mock.setlist" className={`h-4 w-4 ${activeTab === 'setlist' ? 'text-fuchsia-400' : 'text-white/40'}`} />
          <span className="text-[0.55rem] uppercase tracking-wider">Setlist</span>
          <span className={`h-1 w-1 rounded-full ${activeTab === 'setlist' ? 'bg-fuchsia-400' : 'bg-transparent'}`} />
        </div>
      </div>
    </nav>
  );
}

/**
 * 1. REAL PROMPTER VIEW (Exact replica of PrompterPage)
 */
export function PhonePrompterView() {
  return (
    <div className="flex h-full flex-col justify-between text-left font-sans bg-[#07080b] -m-3.5 p-3.5">
      {/* Top Header */}
      <div className="flex items-center justify-between border-b border-white/10 pb-2 text-xs">
        <span className="text-white/60 text-sm cursor-pointer">✕</span>
        <div className="text-center">
          <p className="text-[0.62rem] font-black uppercase tracking-[0.14em] text-white">FaderZero</p>
          <p className="text-[0.52rem] font-bold text-white/40 uppercase tracking-wider">Prompteur - AEFAZF</p>
        </div>
        <div className="flex items-center gap-2 text-white/60 text-xs">
          <span>⛶</span>
          <span>⚙</span>
        </div>
      </div>

      {/* Song Title Bar */}
      <div className="text-center pt-2 pb-1 border-b border-white/5">
        <h3 className="text-sm font-black text-white">Rien à perdre</h3>
        <p className="text-[0.62rem] text-white/50 font-mono">93 BPM · 03:07 · A</p>
      </div>

      {/* Real Stage Lyrics Area */}
      <div className="flex-1 space-y-4 py-3 text-center text-xs leading-relaxed overflow-y-auto scrollbar-none">
        <div className="space-y-1.5">
          <h4 className="text-emerald-400 font-bold text-[0.72rem]">Couplet</h4>
          <div className="text-white font-medium text-[0.78rem] space-y-1">
            <p>J'ai laissé mes doutes sur le quai</p>
            <p>Avec les trains que j'ai manqués</p>
            <p>Je prends la route sans savoir</p>
            <p>Ce qui m'attend après ce soir</p>
          </div>
        </div>

        <div className="space-y-1.5 pt-1">
          <h4 className="text-emerald-400 font-bold text-[0.72rem]">Refrain</h4>
          <div className="text-white font-medium text-[0.78rem] space-y-1">
            <p>On n'a plus rien à perdre</p>
            <p>Plus aucune raison d'attendre</p>
            <p>On va courir, tomber, se relever</p>
            <p>On n'a plus rien à perdre</p>
            <p>Même si le monde veut nous prendre</p>
            <p>Ce qu'il nous reste de Liberté</p>
          </div>
        </div>

        <div className="space-y-1.5 pt-1">
          <h4 className="text-emerald-400 font-bold text-[0.72rem]">Couplet</h4>
          <div className="text-white font-medium text-[0.78rem] space-y-1">
            <p>Les portes fermées, les faux départs</p>
            <p>Ne changeront pas notre histoire</p>
            <p>On a le bruit, on a le cœur</p>
            <p>Et quelques rêves à toute heure</p>
          </div>
        </div>
      </div>

      {/* Floating Action Button */}
      <div className="flex justify-end pt-1">
        <div className="rounded-xl border border-white/10 bg-[#12151e] px-3 py-1 text-[0.62rem] font-bold text-white/80 shadow-lg">
          New ›
        </div>
      </div>
    </div>
  );
}

/**
 * 2. REAL METRONOME VIEW (Exact replica of MetronomePage)
 */
export function PhoneMetronomeView() {
  return (
    <div className="flex h-full flex-col justify-between text-left font-sans bg-[#07080b] -m-3.5 p-3.5">
      {/* Top Header */}
      <div className="flex items-center justify-between border-b border-white/10 pb-2 text-xs">
        <span className="text-white/60 text-sm cursor-pointer">✕</span>
        <div className="text-center">
          <p className="text-[0.62rem] font-black uppercase tracking-[0.14em] text-white">FaderZero</p>
          <p className="text-[0.52rem] font-bold text-white/40 uppercase tracking-wider">Métronome - AEFAZF</p>
        </div>
        <span className="text-white/60 text-xs">⛶</span>
      </div>

      {/* Big Metronome Dial Card */}
      <div className="my-2 rounded-2xl border border-white/10 bg-[#12141c] p-3 shadow-inner">
        <div className="flex items-center justify-between">
          <div>
            <span className="font-mono text-3xl font-black text-white">93</span>
            <span className="ml-1 text-[0.6rem] font-bold uppercase text-white/40">BPM</span>
          </div>

          {/* Round Amber Play Button */}
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-amber-500 shadow-[0_0_16px_rgba(245,158,11,0.5)]">
            <span className="ml-0.5 text-black text-sm font-black">▶</span>
          </div>

          <div className="text-right">
            <span className="font-mono text-xl font-black text-white">4/4</span>
            <span className="ml-1 text-sm text-white/80">♩</span>
          </div>
        </div>

        {/* 4 Beat Rectangles (First active in amber) */}
        <div className="mt-3 grid grid-cols-4 gap-1.5">
          <div className="h-2 rounded bg-amber-400 shadow-[0_0_8px_#fbbf24]" />
          <div className="h-2 rounded bg-white/10" />
          <div className="h-2 rounded bg-white/10" />
          <div className="h-2 rounded bg-white/10" />
        </div>
      </div>

      {/* Song list with BPM attached */}
      <div className="flex-1 space-y-1.5 overflow-y-auto scrollbar-none py-1">
        {/* Active Song 1 (amber highlighted border) */}
        <div className="flex items-center justify-between rounded-xl border border-amber-500/80 bg-[#171a24] p-2 text-xs shadow-[0_0_12px_rgba(245,158,11,0.15)]">
          <div className="flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/10 text-[0.6rem] font-bold text-white">
              1
            </span>
            <span className="font-bold text-white text-[0.72rem]">Rien à perdre</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="rounded bg-white/10 px-1.5 py-0.5 text-[0.6rem] font-mono text-white/80">A</span>
            <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[0.62rem] font-mono font-bold text-amber-300">
              93 BPM
            </span>
          </div>
        </div>

        {/* Song 2 */}
        <div className="flex items-center justify-between rounded-xl border border-white/5 bg-[#12141c] p-2 text-xs">
          <div className="flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/10 text-[0.6rem] font-bold text-white">
              2
            </span>
            <span className="font-bold text-white text-[0.72rem]">New</span>
          </div>
          <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[0.62rem] font-mono font-bold text-amber-300">
            84 BPM
          </span>
        </div>

        {/* Song 3 */}
        <div className="flex items-center justify-between rounded-xl border border-white/5 bg-[#12141c] p-2 text-xs">
          <div className="flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/10 text-[0.6rem] font-bold text-white">
              3
            </span>
            <span className="font-bold text-white text-[0.72rem]">Hors ligne scrib</span>
          </div>
          <span className="text-[0.62rem] font-mono text-white/40">BPM --</span>
        </div>
      </div>

      {/* Bottom Action */}
      <div className="flex justify-end pt-1">
        <div className="rounded-xl border border-white/10 bg-[#12151e] px-3 py-1 text-[0.62rem] font-bold text-white/80">
          New ›
        </div>
      </div>
    </div>
  );
}

/**
 * 3. REAL SETLIST VIEW (Exact replica of SetlistDetailPage)
 */
export function PhoneSetlistView() {
  return (
    <div className="flex h-full flex-col justify-between text-left font-sans bg-[#07080b] -m-3.5 p-3.5">
      {/* Real AppHeader */}
      <div className="-mx-3.5 -mt-3.5 mb-2 border-b border-white/10">
        <AppHeader
          logo={<FaderLogo className="h-6 w-auto text-white" />}
          currentGroup={{
            name: 'GROUPE1',
            initials: 'GR',
            badgeColor: '#00e5ff',
          }}
          onChangeGroup={() => {}}
        />
      </div>

      {/* Subheader */}
      <div className="flex items-center justify-between py-1.5">
        <div className="flex items-center gap-2">
          <span className="text-white/60 text-xs">←</span>
          <div>
            <h4 className="text-xs font-black text-white leading-tight">aefazf</h4>
            <p className="text-[0.58rem] text-white/50">4 morceaux - 05:26</p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="text-cyan-400">📺</span>
          <span className="text-amber-400">📄</span>
          <span className="text-white/40">•••</span>
        </div>
      </div>

      {/* Big Pink CTA Button */}
      <button
        type="button"
        className="w-full rounded-2xl bg-[#ff2d60] py-2.5 text-xs font-black text-white shadow-[0_4px_16px_rgba(255,45,96,0.35)] my-2"
      >
        + Ajouter des chansons
      </button>

      {/* Setlist Song Items with Transitions */}
      <div className="flex-1 space-y-1 overflow-y-auto scrollbar-none">
        {/* Item 1 */}
        <div className="rounded-xl border border-white/10 bg-[#12141c] p-2 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/10 text-[0.6rem] font-bold text-white">
              1
            </span>
            <div>
              <h5 className="text-[0.7rem] font-bold text-white">Rien à perdre</h5>
              <p className="text-[0.55rem] text-white/40 font-mono">93 BPM - A - 03:07</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-white/50">
            <span>↑</span>
            <span>↓</span>
            <span className="text-rose-400">🗑</span>
          </div>
        </div>

        {/* Transition Line 1 */}
        <div className="flex items-center gap-1.5 pl-6 py-0.5 text-[0.55rem] text-white/40 font-mono">
          <div className="h-2 w-px bg-white/20" />
          <span>AJOUTER UNE TRANSITION...</span>
          <span>✎</span>
        </div>

        {/* Item 2 */}
        <div className="rounded-xl border border-white/10 bg-[#12141c] p-2 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/10 text-[0.6rem] font-bold text-white">
              2
            </span>
            <div>
              <h5 className="text-[0.7rem] font-bold text-white">New</h5>
              <p className="text-[0.55rem] text-white/40 font-mono">84 BPM - - Ton - 02:19</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-white/50">
            <span>↑</span>
            <span>↓</span>
            <span className="text-rose-400">🗑</span>
          </div>
        </div>

        {/* Transition Line 2 */}
        <div className="flex items-center gap-1.5 pl-6 py-0.5 text-[0.55rem] text-white/40 font-mono">
          <div className="h-2 w-px bg-white/20" />
          <span>AJOUTER UNE TRANSITION...</span>
          <span>✎</span>
        </div>

        {/* Item 3 */}
        <div className="rounded-xl border border-white/10 bg-[#12141c] p-2 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/10 text-[0.6rem] font-bold text-white">
              3
            </span>
            <div>
              <h5 className="text-[0.7rem] font-bold text-white">Hors ligne scrib</h5>
              <p className="text-[0.55rem] text-white/40 font-mono">-- BPM - - Ton - 00:00</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-white/50">
            <span>↑</span>
            <span>↓</span>
            <span className="text-rose-400">🗑</span>
          </div>
        </div>
      </div>

      {/* Real Bottom Bar */}
      <RealBottomNav activeTab="setlist" />
    </div>
  );
}

/**
 * 4. REAL SONGS REPERTOIRE VIEW (Exact replica of SongsPage)
 */
export function PhoneSongsView() {
  return (
    <div className="flex h-full flex-col justify-between text-left font-sans bg-[#07080b] -m-3.5 p-3.5">
      {/* Real AppHeader */}
      <div className="-mx-3.5 -mt-3.5 mb-2 border-b border-white/10">
        <AppHeader
          logo={<FaderLogo className="h-6 w-auto text-white" />}
          currentGroup={{
            name: 'GROUPE1',
            initials: 'GR',
            badgeColor: '#00e5ff',
          }}
          onChangeGroup={() => {}}
        />
      </div>

      {/* Page Header */}
      <div className="flex items-center justify-between py-1.5">
        <div>
          <h4 className="text-xs font-black text-white">Morceaux</h4>
          <p className="text-[0.58rem] text-white/50">4 titres dans le répertoire</p>
        </div>
        <button type="button" className="flex h-7 w-7 items-center justify-center rounded-full bg-[#ff2d60] text-white text-sm font-black shadow">
          +
        </button>
      </div>

      {/* Search Input */}
      <div className="rounded-xl border border-white/10 bg-[#12141c] px-3 py-1.5 text-xs text-white/50 mb-2 flex items-center gap-2">
        <span>🔍</span>
        <span className="text-[0.65rem]">Rechercher un morceau...</span>
      </div>

      {/* Song Cards */}
      <div className="flex-1 space-y-1.5 overflow-y-auto scrollbar-none">
        {[
          { title: 'Rien à perdre', bpm: '93 BPM', key: 'A', dur: '03:07', hasAudio: true },
          { title: 'New', bpm: '84 BPM', key: '-', dur: '02:19', hasAudio: false },
          { title: 'Hors ligne scrib', bpm: '--', key: '-', dur: '00:00', hasAudio: false },
        ].map((song) => (
          <div
            key={song.title}
            className="flex items-center justify-between rounded-xl border border-white/5 bg-[#12141c] p-2.5 text-xs transition"
          >
            <div>
              <div className="flex items-center gap-1.5">
                <h5 className="text-[0.72rem] font-bold text-white">{song.title}</h5>
                {song.hasAudio && <span className="text-rose-400 text-[0.6rem]">🎵</span>}
              </div>
              <p className="text-[0.58rem] text-white/40 font-mono">
                {song.bpm} · Ton {song.key} · {song.dur}
              </p>
            </div>
            <span className="text-white/40 text-xs">›</span>
          </div>
        ))}
      </div>

      {/* Real Bottom Bar */}
      <RealBottomNav activeTab="songs" />
    </div>
  );
}

/**
 * 5. REAL CALENDAR VIEW (Exact replica of CalendarPage)
 */
export function PhoneCalendarView() {
  return (
    <div className="flex h-full flex-col justify-between text-left font-sans bg-[#07080b] -m-3.5 p-3.5">
      {/* Real AppHeader */}
      <div className="-mx-3.5 -mt-3.5 mb-2 border-b border-white/10">
        <AppHeader
          logo={<FaderLogo className="h-6 w-auto text-white" />}
          currentGroup={{
            name: 'GROUPE1',
            initials: 'GR',
            badgeColor: '#00e5ff',
          }}
          onChangeGroup={() => {}}
        />
      </div>

      {/* Header */}
      <div className="flex items-center justify-between py-1.5">
        <div>
          <h4 className="text-xs font-black text-white">Calendrier</h4>
          <p className="text-[0.58rem] text-white/50">Prochains concerts & répètes</p>
        </div>
        <button type="button" className="flex h-7 w-7 items-center justify-center rounded-full bg-[#ff2d60] text-white text-sm font-black shadow">
          +
        </button>
      </div>

      {/* Event Cards */}
      <div className="flex-1 space-y-2 overflow-y-auto scrollbar-none py-1">
        {/* Concert */}
        <div className="rounded-xl border border-teal-500/30 bg-[#0f171c] p-2.5 space-y-1">
          <div className="flex items-center justify-between text-[0.6rem]">
            <span className="rounded bg-teal-500/20 px-1.5 py-0.5 font-bold uppercase text-teal-300">
              Concert
            </span>
            <span className="text-white/50">Sam. 12 Sept</span>
          </div>
          <h5 className="text-[0.72rem] font-bold text-white">Festival Les Nuits Électriques</h5>
          <p className="text-[0.6rem] text-white/60">📍 Le Chabada, Angers</p>
          <p className="text-[0.58rem] text-white/50">⏰ Balance 17:30 · Show 21:30</p>
        </div>

        {/* Rehearsal */}
        <div className="rounded-xl border border-white/10 bg-[#12141c] p-2.5 space-y-1">
          <div className="flex items-center justify-between text-[0.6rem]">
            <span className="rounded bg-white/10 px-1.5 py-0.5 font-bold uppercase text-white/70">
              Répétition
            </span>
            <span className="text-white/50">Jeu. 10 Sept</span>
          </div>
          <h5 className="text-[0.72rem] font-bold text-white">Répète complète Setlist 45m</h5>
          <p className="text-[0.6rem] text-white/60">📍 Studio A · 19:30 - 22:30</p>
        </div>
      </div>

      {/* Real Bottom Bar */}
      <RealBottomNav activeTab="calendar" />
    </div>
  );
}

/**
 * 6. REAL HOME COCKPIT VIEW (Exact replica of HomePage)
 */
export function PhoneHomeView() {
  return (
    <div className="flex h-full flex-col justify-between text-left font-sans bg-[#07080b] -m-3.5 p-3.5">
      {/* Real AppHeader */}
      <div className="-mx-3.5 -mt-3.5 mb-2 border-b border-white/10">
        <AppHeader
          logo={<FaderLogo className="h-6 w-auto text-white" />}
          currentGroup={{
            name: 'GROUPE1',
            initials: 'GR',
            badgeColor: '#00e5ff',
          }}
          onChangeGroup={() => {}}
        />
      </div>

      <div className="flex-1 space-y-2.5 overflow-y-auto scrollbar-none py-1">
        {/* Next Concert */}
        <div className="rounded-xl border border-teal-500/30 bg-[#0f171c] p-2.5 space-y-1">
          <div className="flex items-center justify-between text-[0.58rem]">
            <span className="font-bold uppercase text-teal-400">Prochain concert</span>
            <span className="text-white/50">Sam. 12 Sept</span>
          </div>
          <h5 className="text-[0.72rem] font-bold text-white">Festival Les Nuits Électriques</h5>
          <p className="text-[0.58rem] text-white/60">📍 Le Chabada · Show 21:30</p>
        </div>

        {/* Quick Links Grid */}
        <div className="grid grid-cols-2 gap-1.5">
          <div className="rounded-xl border border-white/5 bg-[#12141c] p-2 text-center">
            <span className="text-base">🎤</span>
            <p className="text-[0.65rem] font-bold text-white mt-0.5">Prompteur</p>
          </div>
          <div className="rounded-xl border border-white/5 bg-[#12141c] p-2 text-center">
            <span className="text-base">⏱️</span>
            <p className="text-[0.65rem] font-bold text-white mt-0.5">Métronome</p>
          </div>
        </div>

        {/* Recent Song */}
        <div className="rounded-xl border border-white/10 bg-[#12141c] p-2.5">
          <div className="flex items-center justify-between text-[0.58rem] text-white/40 mb-1">
            <span>Dernière modification</span>
            <span>Il y a 2h</span>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <h5 className="text-[0.72rem] font-bold text-white">Rien à perdre</h5>
              <p className="text-[0.58rem] text-white/40 font-mono">93 BPM · Ton A</p>
            </div>
            <span className="text-rose-400 text-xs">▶</span>
          </div>
        </div>
      </div>

      {/* Real Bottom Bar */}
      <RealBottomNav activeTab="home" />
    </div>
  );
}
