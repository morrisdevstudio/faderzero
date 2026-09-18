import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { TimelineSectionRecord } from '@/db/schema';
import { useGoBack } from '@/hooks/useGoBack';
import { songTimelinesRepository } from '@/db/repositories/songTimelinesRepository';
import { songsRepository } from '@/db/repositories/songsRepository';
import { normalizeBeatSounds } from '@/features/metronome/metronomeEngine';
import { MetronomeBeatGrid, SubdivisionIcon, SubdivisionSelector, type MetronomeSubdivision } from '@/features/metronome/MetronomePage';
import { canWriteWorkspace } from '@/services/supabase/workspace';
import { useAuthStore } from '@/stores/authStore';
import { FormDialog } from '@/components/FormDialog';
import { PickerDialog, WheelColumn } from '@/components/PickerDialog';
import { Button } from '@/ui/components/Button';
import { DetailHeader } from '@/ui/components/DetailHeader';
import { FieldLabel } from '@/ui/components/FieldLabel';
import { SelectField } from '@/ui/components/SelectField';
import { TextField } from '@/ui/components/TextField';
import { FzIcon } from '@/ui/icons';
import { compileTimeline, getTimelinePosition, TIMELINE_LIMITS, type CompiledTimelineEvent } from './timelineCompiler';
import { TimelinePlaybackEngine } from './timelinePlaybackEngine';

const TEMPO_OPTIONS = Array.from({ length: TIMELINE_LIMITS.tempo.max - TIMELINE_LIMITS.tempo.min + 1 }, (_, index) => String(index + TIMELINE_LIMITS.tempo.min));
const BAR_OPTIONS = Array.from({ length: TIMELINE_LIMITS.bars.max }, (_, index) => String(index + 1));
const NUMERATOR_OPTIONS = Array.from({ length: 12 }, (_, index) => String(index + 1));
const COUNT_IN_OPTIONS = [
  { value: 'none', label: 'Aucun' },
  { value: 'inserted', label: 'Inséré' },
  { value: 'overlay', label: 'Superposé' },
] as const;

export function SongTimelineEditorPage() {
  const { songId = '' } = useParams();
  const navigate = useNavigate();
  const goBack = useGoBack(`/songs/${songId}`);
  const workspace = useAuthStore((state) => state.activeWorkspace);
  const canWrite = canWriteWorkspace(workspace?.role);
  const song = useLiveQuery(() => songsRepository.getById(songId), [songId, workspace?.id]);
  const bundle = useLiveQuery(() => songTimelinesRepository.getBySongId(songId), [songId, workspace?.id]);
  const [editing, setEditing] = useState<TimelineSectionRecord | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [playback, setPlayback] = useState<'stopped' | 'playing' | 'paused' | 'ended'>('stopped');
  const [position, setPosition] = useState(0);
  const [currentEvent, setCurrentEvent] = useState<CompiledTimelineEvent | undefined>();
  const engineRef = useRef<TimelinePlaybackEngine | null>(null);
  if (!engineRef.current) engineRef.current = new TimelinePlaybackEngine();
  const compiled = useMemo(() => bundle ? compileTimeline(bundle.timeline, bundle.sections) : null, [bundle]);
  const currentPosition = compiled ? getTimelinePosition(compiled, position) : null;
  const editingLocked = playback === 'playing' || playback === 'paused';
  const sectionElementsRef = useRef(new Map<string, HTMLElement>());
  const sectionPositionsRef = useRef(new Map<string, number>());
  const sectionAnimationsRef = useRef(new Map<string, Animation>());
  const movingSectionIdRef = useRef<string | null>(null);

  useEffect(() => {
    const engine = engineRef.current!;
    engine.setListener((snapshot) => {
      setPlayback(snapshot.status);
      setPosition(snapshot.position);
      if (snapshot.status === 'stopped' || snapshot.status === 'ended') setCurrentEvent(undefined);
      else if (snapshot.event) setCurrentEvent(snapshot.event);
    });
    return () => engine.stop();
  }, []);

  useLayoutEffect(() => {
    const nextPositions = new Map<string, number>();
    const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    const movingSectionId = movingSectionIdRef.current;

    for (const [sectionId, element] of sectionElementsRef.current) {
      const nextTop = element.getBoundingClientRect().top;
      const previousTop = sectionPositionsRef.current.get(sectionId);
      nextPositions.set(sectionId, nextTop);

      if (
        movingSectionId === null ||
        prefersReducedMotion ||
        previousTop === undefined ||
        previousTop === nextTop ||
        typeof element.animate !== 'function'
      ) {
        continue;
      }

      const deltaY = previousTop - nextTop;
      sectionAnimationsRef.current.get(sectionId)?.cancel();
      const animation = element.animate(
        [
          { transform: `translateY(${deltaY}px)` },
          { transform: 'translateY(0)' },
        ],
        { duration: 190, easing: 'cubic-bezier(0.2, 0, 0, 1)' },
      );
      sectionAnimationsRef.current.set(sectionId, animation);
      const forgetAnimation = () => {
        if (sectionAnimationsRef.current.get(sectionId) === animation) {
          sectionAnimationsRef.current.delete(sectionId);
        }
      };
      animation.addEventListener('finish', forgetAnimation, { once: true });
      animation.addEventListener('cancel', forgetAnimation, { once: true });
    }

    sectionPositionsRef.current = nextPositions;
    movingSectionIdRef.current = null;
  }, [bundle?.sections]);

  async function createTimeline() {
    try { setError(null); await songTimelinesRepository.create(songId, song?.bpm); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Impossible de créer la structure.'); }
  }

  async function togglePreview() {
    if (!compiled) return;
    try {
      setError(null);
      if (playback === 'playing') engineRef.current?.stop();
      else await engineRef.current?.play(compiled, 0, bundle?.timeline.volume);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Lecture audio impossible.'); }
  }

  async function handleMoveSection(sectionId: string, direction: -1 | 1) {
    if (!canWrite || editingLocked) return;
    setError(null);
    movingSectionIdRef.current = sectionId;
    try {
      await songTimelinesRepository.moveSection(sectionId, direction);
    } catch {
      movingSectionIdRef.current = null;
      setError('Impossible de reordonner cette section.');
    }
  }

  if (song === undefined || bundle === undefined) return <p className="p-6 text-sm text-white/60">Chargement de la structure…</p>;
  if (!song) return <p className="p-6 text-sm text-rose-300">Morceau introuvable.</p>;

  return (
    <div className="space-y-5 pb-28">
      <DetailHeader title="Structure" subtitle={song.title || 'Sans titre'} onBack={goBack} backLabel="Retour" />
      {error ? <p role="alert" className="rounded-xl border border-rose-400/25 bg-rose-400/10 p-3 text-sm font-semibold text-rose-300">{error}</p> : null}

      {!bundle ? (
        <section className="fz-card rounded-[1.5rem] p-5 text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-400/12 text-amber-300"><FzIcon name="metronome" usageId="timeline.empty.metronome" size="xl" /></span>
          <h2 className="mt-4 text-lg font-black text-white">Programmer ce morceau</h2>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-white/60">Découpez le morceau en sections avec leurs tempos, mesures et décomptes.</p>
          {canWrite ? <Button className="mt-5" variant="primary" onClick={() => void createTimeline()}>Créer la structure</Button> : null}
        </section>
      ) : (
        <>
          <TimelinePreviewMetronome
            sections={bundle.sections}
            currentSectionId={currentPosition?.section.id ?? bundle.sections[0]?.id}
            currentEvent={playback === 'playing' ? currentEvent : undefined}
            isRunning={playback === 'playing'}
            onToggle={() => void togglePreview()}
            onCyclePulse={canWrite && !editingLocked ? (sectionId, beatIndex, subdivisionIndex) => {
              const section = bundle.sections.find((item) => item.id === sectionId);
              if (!section) return;
              const beatSounds = normalizeBeatSounds(section.beatSounds, section.numerator, section.subdivision);
              beatSounds[beatIndex]![subdivisionIndex] = (beatSounds[beatIndex]![subdivisionIndex]! + 1) % 3;
              void songTimelinesRepository.updateSection(sectionId, { beatSounds });
            } : undefined}
            sectionName={currentPosition?.section.name ?? bundle.sections[0]?.name ?? 'Prêt'}
            positionLabel={`${formatDuration(position)} / ${formatDuration(compiled?.duration ?? 0)}`}
          />

          <section className="grid grid-cols-2 gap-3">
            <label className="block p-1">
              <FieldLabel htmlFor="timeline-count-in">Décompte initial</FieldLabel>
              <SelectField id="timeline-count-in" disabled={!canWrite || editingLocked} value={bundle.timeline.startCountInBars} onChange={(event) => void songTimelinesRepository.updateTimeline(bundle.timeline.id, { startCountInBars: Number(event.target.value) })}>
                {[0, 1, 2, 4].map((bars) => <option key={bars} value={bars}>{bars === 0 ? 'Aucun' : `${bars} mesure${bars > 1 ? 's' : ''}`}</option>)}
              </SelectField>
            </label>
            <label className="block p-1">
              <FieldLabel htmlFor="timeline-volume">Volume {Math.round(bundle.timeline.volume * 100)} %</FieldLabel>
              <input id="timeline-volume" aria-label="Volume du clic" type="range" min="0" max="1" step="0.05" disabled={!canWrite || editingLocked} value={bundle.timeline.volume} onChange={(event) => void songTimelinesRepository.updateTimeline(bundle.timeline.id, { volume: Number(event.target.value) })} className="mt-3 h-11 w-full accent-amber-300" />
            </label>
          </section>

          <section aria-labelledby="timeline-sections-title" className="space-y-3">
            <div className="flex min-h-11 items-center justify-between gap-3">
              <h2 id="timeline-sections-title" className="text-sm font-black uppercase tracking-[0.18em] text-white">Sections</h2>
              <span className="text-xs font-semibold text-white/45">Le BPM du morceau suit la première</span>
            </div>
            {bundle.sections.map((section, index) => (
              <div
                key={section.id}
                ref={(element) => {
                  if (element) sectionElementsRef.current.set(section.id, element);
                  else sectionElementsRef.current.delete(section.id);
                }}
              >
                <article className="fz-card-soft overflow-hidden rounded-[1.3rem] border border-white/8">
                  <button type="button" disabled={editingLocked} onClick={() => setEditing(section)} className="flex min-h-20 w-full items-center gap-3 px-4 py-3 text-left disabled:cursor-not-allowed">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-300/12 text-sm font-black text-amber-300">{index + 1}</span>
                    <span className="min-w-0 flex-1"><span className="block truncate font-black text-white">{section.name}</span><span className="mt-1 block text-xs font-semibold text-white/50">{section.bars} mesures · {section.tempo} BPM · {section.numerator}/{section.denominator}</span></span>
                    <FzIcon name="edit" usageId="timeline.section.edit" size="sm" className="text-white/45" />
                  </button>
                  {canWrite ? <div className="grid grid-cols-4 border-t border-white/8">
                    <SectionAction label="Monter" disabled={editingLocked || index === 0} icon="back" className="rotate-90" onClick={() => void handleMoveSection(section.id, -1)} />
                    <SectionAction label="Descendre" disabled={editingLocked || index === bundle.sections.length - 1} icon="back" className="-rotate-90" onClick={() => void handleMoveSection(section.id, 1)} />
                    <SectionAction label="Dupliquer" disabled={editingLocked} icon="copy" onClick={() => void songTimelinesRepository.addSection(bundle.timeline.id, section)} />
                    <SectionAction label="Supprimer" disabled={editingLocked || bundle.sections.length === 1} icon="delete" tone="danger" onClick={() => void songTimelinesRepository.deleteSection(section.id)} />
                  </div> : null}
                </article>
              </div>
            ))}
          </section>
          {canWrite ? <Button fullWidth disabled={editingLocked} leadingIcon={<FzIcon name="add" usageId="timeline.section.add" size="sm" />} onClick={() => void songTimelinesRepository.addSection(bundle.timeline.id)}>Ajouter une section</Button> : null}
          <Button fullWidth variant="primary" leadingIcon={<FzIcon name="fullscreen" usageId="timeline.open-live" size="sm" />} onClick={() => navigate(`/songs/${songId}/live`)}>Ouvrir le mode Live</Button>
        </>
      )}

      {editing ? <SectionDialog section={editing} onClose={() => setEditing(null)} onUpdate={(patch) => songTimelinesRepository.updateSection(editing.id, patch)} /> : null}
    </div>
  );
}

function TimelinePreviewMetronome({
  sections,
  currentSectionId,
  currentEvent,
  isRunning,
  onToggle,
  onCyclePulse,
  sectionName,
  positionLabel,
}: {
  sections: TimelineSectionRecord[];
  currentSectionId?: string | undefined;
  currentEvent?: CompiledTimelineEvent | undefined;
  isRunning: boolean;
  onToggle: () => void;
  onCyclePulse?: ((sectionId: string, beatIndex: number, subdivisionIndex: number) => void) | undefined;
  sectionName: string;
  positionLabel: string;
}) {
  const section = sections.find((item) => item.id === currentSectionId) ?? sections[0];
  if (!section) return null;
  const subdivision = section.subdivision;
  const activeBeat = currentEvent
    ? (currentEvent.countIn ? currentEvent.pulseIndex : Math.floor(currentEvent.pulseIndex / subdivision))
    : 0;
  const activeSubdivision = currentEvent && !currentEvent.countIn ? currentEvent.pulseIndex % subdivision : 0;

  return (
    <section aria-label="Aperçu du métronome">
      <div className="grid grid-cols-3 items-center gap-2">
        <div className="flex items-baseline gap-1 justify-self-start rounded-xl p-1">
          <span className="text-3xl font-black leading-none tracking-tight text-white tabular-nums">{section.tempo}</span>
          <span className="text-[0.65rem] font-black uppercase tracking-wider text-[var(--fz-text-muted)]">BPM</span>
        </div>
        <div className="flex items-center justify-center justify-self-center">
          <button
            type="button"
            onClick={onToggle}
            aria-label={isRunning ? 'Arrêter l’aperçu' : 'Lire l’aperçu'}
            title={isRunning ? 'Arrêter l’aperçu' : 'Lire l’aperçu'}
            className={[
              'flex h-12 w-12 shrink-0 items-center justify-center rounded-full shadow-lg transition transform active:scale-95',
              isRunning
                ? 'border border-rose-500/40 bg-rose-500/20 text-rose-400 shadow-[0_0_15px_rgba(244,63,94,0.3)] hover:bg-rose-500/30'
                : 'border border-amber-500/40 bg-amber-500/20 text-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.25)] hover:bg-amber-500/30',
            ].join(' ')}
          >
            <FzIcon name={isRunning ? 'pause' : 'play'} usageId="timeline.preview.toggle" size="md" />
          </button>
        </div>
        <div className="flex items-center gap-3 justify-self-end text-right">
          <span className="rounded-xl p-1 text-3xl font-black leading-none text-white tabular-nums">{section.numerator}/4</span>
          <span className="flex items-center justify-center rounded-xl p-1">
            <SubdivisionIcon value={subdivision} className="h-9 w-9 text-white" />
          </span>
        </div>
      </div>
      <div className="mt-3.5">
        <MetronomeBeatGrid
          beatsPerBar={section.numerator}
          subdivision={subdivision}
          beatSounds={normalizeBeatSounds(section.beatSounds, section.numerator, subdivision)}
          onCycleSubdivisionSound={onCyclePulse ? (beatIndex, subdivisionIndex) => onCyclePulse(section.id, beatIndex, subdivisionIndex) : undefined}
          isRunning={isRunning}
          activeBeat={activeBeat}
          activeSubdivision={activeSubdivision}
        />
      </div>
      <p className="mt-3 flex items-center justify-between gap-3 text-xs text-white/55">
        <span className="truncate">{sectionName}</span>
        <span className="shrink-0 tabular-nums">{positionLabel}</span>
      </p>
    </section>
  );
}

function SectionAction({ label, icon, disabled, onClick, className = '', tone }: { label: string; icon: 'back' | 'copy' | 'delete'; disabled: boolean; onClick: () => void; className?: string; tone?: 'danger' }) {
  return <button type="button" disabled={disabled} onClick={onClick} aria-label={label} title={label} className={`flex min-h-11 items-center justify-center border-r border-white/8 transition last:border-r-0 disabled:opacity-25 ${tone === 'danger' ? 'text-rose-300' : 'text-white/55'}`}><FzIcon name={icon} usageId={`timeline.section.${label.toLowerCase()}`} size="sm" className={className} /></button>;
}

type SectionPicker = 'tempo' | 'bars' | 'signature' | 'subdivision' | 'countIn' | null;

function SectionDialog({ section, onClose, onUpdate }: { section: TimelineSectionRecord; onClose: () => void; onUpdate: (patch: Partial<TimelineSectionRecord>) => Promise<unknown> }) {
  const [draft, setDraft] = useState(section);
  const [picker, setPicker] = useState<SectionPicker>(null);
  const [pickerValue, setPickerValue] = useState('');
  const [signatureDraft, setSignatureDraft] = useState(section.numerator);
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState(section.name);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  async function applyPatch(patch: Partial<TimelineSectionRecord>) {
    const previous = draft;
    setDraft((current) => ({ ...current, ...patch }));
    setIsSaving(true);
    setSaveError(null);
    try {
      await onUpdate(patch);
    } catch {
      setDraft(previous);
      setSaveError('Impossible d’enregistrer ce réglage. Réessaie.');
    } finally {
      setIsSaving(false);
    }
  }

  function openPicker(nextPicker: Exclude<SectionPicker, null>) {
    setSaveError(null);
    if (nextPicker === 'signature') {
      setSignatureDraft(draft.numerator);
    } else if (nextPicker === 'tempo') {
      setPickerValue(String(draft.tempo));
    } else if (nextPicker === 'bars') {
      setPickerValue(String(draft.bars));
    } else if (nextPicker === 'subdivision') {
      setPickerValue(String(draft.subdivision));
    } else {
      setPickerValue(draft.countInMode);
    }
    setPicker(nextPicker);
  }

  async function confirmPicker() {
    if (picker === 'tempo') await applyPatch({ tempo: Number(pickerValue) });
    if (picker === 'bars') await applyPatch({ bars: Number(pickerValue) });
    if (picker === 'signature') await applyPatch({
      numerator: signatureDraft,
      denominator: 4,
      beatSounds: normalizeBeatSounds(draft.beatSounds, signatureDraft, draft.subdivision),
    });
    if (picker === 'subdivision') {
      const subdivision = Number(pickerValue) as TimelineSectionRecord['subdivision'];
      await applyPatch({ subdivision, beatSounds: normalizeBeatSounds(draft.beatSounds, draft.numerator, subdivision) });
    }
    if (picker === 'countIn') await applyPatch({ countInMode: pickerValue as TimelineSectionRecord['countInMode'], countInBars: pickerValue === 'none' ? 0 : Math.max(1, draft.countInBars) });
    setPicker(null);
  }

  async function selectSubdivision(subdivision: MetronomeSubdivision) {
    await applyPatch({ subdivision, beatSounds: normalizeBeatSounds(draft.beatSounds, draft.numerator, subdivision) });
    setPicker(null);
  }

  return <FormDialog
    title={draft.name}
    placement="bottom"
    onClose={onClose}
    headerActions={<button type="button" disabled={isSaving} onClick={() => { setRenameValue(draft.name); setRenameOpen(true); }} aria-label="Renommer la section" title="Renommer la section" className="fz-dialog-close disabled:opacity-55">
      <FzIcon name="edit" usageId="timeline.section.rename" size="md" />
    </button>}
  >
    <div className="max-h-[70dvh] space-y-4 overflow-y-auto pr-1">
      <SectionRhythmDashboard section={draft} disabled={isSaving} onTempo={() => openPicker('tempo')} onSignature={() => openPicker('signature')} onSubdivision={() => openPicker('subdivision')} onCyclePulse={(beatIndex, subdivisionIndex) => {
        const beatSounds = normalizeBeatSounds(draft.beatSounds, draft.numerator, draft.subdivision);
        beatSounds[beatIndex]![subdivisionIndex] = (beatSounds[beatIndex]![subdivisionIndex]! + 1) % 3;
        void applyPatch({ beatSounds });
      }} />
      <div className="grid grid-cols-2 gap-2">
        <SectionValueButton label="Mesures" value={`${draft.bars}`} onClick={() => openPicker('bars')} disabled={isSaving} />
        <SectionValueButton label="Décompte" value={countInLabel(draft)} onClick={() => openPicker('countIn')} disabled={isSaving} />
      </div>
      {saveError ? <p role="alert" className="text-sm font-semibold text-rose-300">{saveError}</p> : null}
    </div>

    {renameOpen ? <FormDialog title="Renommer la section" placement="bottom" onClose={() => setRenameOpen(false)}>
      <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); void applyPatch({ name: renameValue.trim() || 'Section' }).then(() => setRenameOpen(false)); }}>
        <TextField aria-label="Nom de la section" autoFocus required maxLength={64} value={renameValue} onChange={(event) => setRenameValue(event.target.value)} />
        <Button type="submit" fullWidth variant="primary" loading={isSaving}>Valider</Button>
      </form>
    </FormDialog> : null}

    {picker === 'tempo' ? <SectionWheelPicker title="Sélectionner le tempo" value={pickerValue} options={TEMPO_OPTIONS} suffix="BPM" onSelect={setPickerValue} onClose={() => setPicker(null)} onConfirm={() => void confirmPicker()} /> : null}
    {picker === 'bars' ? <SectionWheelPicker title="Nombre de mesures" value={pickerValue} options={BAR_OPTIONS} suffix="mesures" onSelect={setPickerValue} onClose={() => setPicker(null)} onConfirm={() => void confirmPicker()} /> : null}
    {picker === 'subdivision' ? <PickerDialog title="Subdivision des temps" onClose={() => setPicker(null)}>
      <SubdivisionSelector value={draft.subdivision} onChange={(subdivision) => void selectSubdivision(subdivision)} />
    </PickerDialog> : null}
    {picker === 'countIn' ? <SectionWheelPicker title="Décompte avant la section" value={pickerValue} options={COUNT_IN_OPTIONS.map((option) => option.value)} labels={COUNT_IN_OPTIONS} onSelect={setPickerValue} onClose={() => setPicker(null)} onConfirm={() => void confirmPicker()} /> : null}
    {picker === 'signature' ? <PickerDialog title="Signature rythmique" description="Nombre de temps par mesure" onClose={() => setPicker(null)}>
      <WheelColumn options={NUMERATOR_OPTIONS} selectedValue={String(signatureDraft)} onSelect={(value) => setSignatureDraft(Number(value))} suffix="Temps" />
      <div className="mt-5"><Button variant="primary" fullWidth onClick={() => void confirmPicker()} loading={isSaving}>Valider</Button></div>
    </PickerDialog> : null}
  </FormDialog>;
}

function SectionRhythmDashboard({ section, disabled, onTempo, onSignature, onSubdivision, onCyclePulse }: { section: TimelineSectionRecord; disabled: boolean; onTempo: () => void; onSignature: () => void; onSubdivision: () => void; onCyclePulse: (beatIndex: number, subdivisionIndex: number) => void }) {
  const beatSounds = normalizeBeatSounds(section.beatSounds, section.numerator, section.subdivision);
  return (
    <section className="rounded-[1.5rem] border border-white/10 bg-black/40 p-4 shadow-2xl" aria-label="Réglages du métronome de la section">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4">
        <button type="button" disabled={disabled} onClick={onTempo} aria-label="Modifier le tempo" title="Changer le tempo" className="group flex items-baseline gap-1.5 rounded-xl p-1 text-left transition hover:bg-white/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300 disabled:opacity-55">
          <span className="text-4xl font-black leading-none tracking-tight text-white tabular-nums">{section.tempo}</span>
          <span className="text-xs font-black uppercase tracking-wider text-white/55 group-hover:text-white/80">BPM</span>
        </button>
        <div className="flex items-center gap-4 justify-self-end text-right">
          <button type="button" disabled={disabled} onClick={onSignature} aria-label="Modifier le nombre de temps par mesure" title="Changer la signature rythmique" className="group rounded-xl p-1 text-right transition hover:bg-white/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300 disabled:opacity-55">
            <span className="text-4xl font-black leading-none text-white tabular-nums">{section.numerator}/4</span>
          </button>
          <button type="button" disabled={disabled} onClick={onSubdivision} aria-label="Modifier la subdivision" title="Changer la subdivision" className="group flex h-11 w-11 items-center justify-center rounded-xl p-1 text-white transition hover:bg-white/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300 disabled:opacity-55">
            <SubdivisionIcon value={section.subdivision} className="h-10 w-10" />
          </button>
        </div>
      </div>
      <div className="mt-5 grid gap-2" style={{ gridTemplateColumns: `repeat(${section.numerator}, minmax(0, 1fr))` }} aria-label={`${section.numerator} temps par mesure`}>
        {Array.from({ length: section.numerator }, (_, beatIndex) => (
          <div key={beatIndex} className="grid h-8 gap-1 sm:h-9" style={{ gridTemplateColumns: `repeat(${section.subdivision}, minmax(0, 1fr))` }}>
            {Array.from({ length: section.subdivision }, (_, subdivisionIndex) => {
              const sound = beatSounds[beatIndex]?.[subdivisionIndex] ?? 1;
              const label = sound === 0 ? 'Son aigu' : sound === 1 ? 'Son médium' : 'Son grave';
              return <button key={subdivisionIndex} type="button" disabled={disabled} onClick={() => onCyclePulse(beatIndex, subdivisionIndex)} title={`Temps ${beatIndex + 1}, ${label} : cliquer pour changer`} aria-label={`Temps ${beatIndex + 1}, ${label}. Cliquer pour changer.`} className={['h-full w-full cursor-pointer rounded-lg border transition-all duration-75 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300 disabled:opacity-55', sound === 0 ? 'border-amber-500/40 bg-amber-500/20 hover:border-amber-400/60 hover:bg-amber-500/30' : sound === 1 ? 'border-sky-400/40 bg-sky-500/20 hover:border-sky-300/60 hover:bg-sky-500/30' : 'border-fuchsia-400/40 bg-fuchsia-500/20 hover:border-fuchsia-300/60 hover:bg-fuchsia-500/30'].join(' ')} />;
            })}
          </div>
        ))}
      </div>
    </section>
  );
}

function SectionValueButton({ label, value, disabled, onClick }: { label: string; value: string; disabled: boolean; onClick: () => void }) {
  return <button type="button" disabled={disabled} onClick={onClick} className="flex min-h-[4.6rem] min-w-0 flex-col justify-center rounded-2xl border border-cyan-400/55 bg-cyan-400/15 px-3 text-left transition hover:bg-cyan-400/25 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300 disabled:opacity-55"><span className="text-[0.62rem] font-black uppercase tracking-[0.13em] text-cyan-100/65">{label}</span><span className="mt-1 truncate text-sm font-black text-white">{value}</span></button>;
}

function SectionWheelPicker({ title, value, options, labels, suffix, onSelect, onClose, onConfirm }: { title: string; value: string; options: readonly string[]; labels?: readonly { value: string; label: string }[]; suffix?: string; onSelect: (value: string) => void; onClose: () => void; onConfirm: () => void }) {
  const labelFor = (option: string) => labels?.find((item) => item.value === option)?.label ?? option;
  const pickerOptions = labels ? options.map(labelFor) : options;
  const selectedValue = labels ? labelFor(value) : value;
  return <PickerDialog title={title} onClose={onClose}>
    <WheelColumn options={pickerOptions} selectedValue={selectedValue} onSelect={(next) => onSelect(labels?.find((item) => item.label === next)?.value ?? next)} {...(suffix ? { suffix } : {})} />
    <div className="mt-5"><Button variant="primary" fullWidth onClick={onConfirm}>Valider</Button></div>
  </PickerDialog>;
}

function countInLabel(section: TimelineSectionRecord) {
  if (section.countInMode === 'none') return 'Aucun';
  return `${section.countInBars} mes. · ${COUNT_IN_OPTIONS.find((option) => option.value === section.countInMode)?.label ?? ''}`;
}

function formatDuration(seconds: number) {
  const total = Math.max(0, Math.round(seconds));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}
