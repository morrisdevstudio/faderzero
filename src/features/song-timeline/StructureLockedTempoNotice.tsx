import { Button } from '@/ui/components/Button';

export const STRUCTURE_LOCKED_TEMPO_MESSAGE =
  'Une structure est déjà définie. Le tempo se règle dans chaque section.';

export function StructureLockedTempoNotice({
  bpm,
  onOpenStructure,
  onUseSingleTempo,
}: {
  bpm: number;
  onOpenStructure: () => void;
  onUseSingleTempo?: () => void;
}) {
  return (
    <div className="space-y-5">
      <p
        role="status"
        className="rounded-xl border border-amber-400/25 bg-amber-400/10 p-3 text-sm font-semibold leading-6 text-amber-100"
      >
        {STRUCTURE_LOCKED_TEMPO_MESSAGE}
      </p>
      <p className="text-center text-4xl font-black tabular-nums text-white">
        {bpm}{' '}
        <span className="text-sm font-black uppercase tracking-[0.16em] text-[var(--fz-text-muted)]">BPM</span>
      </p>
      <div className="space-y-3">
        <Button variant="primary" fullWidth onClick={onOpenStructure}>
          Modifier la structure
        </Button>
        {onUseSingleTempo ? (
          <Button variant="secondary" fullWidth onClick={onUseSingleTempo}>
            Utiliser un tempo unique
          </Button>
        ) : null}
      </div>
    </div>
  );
}
