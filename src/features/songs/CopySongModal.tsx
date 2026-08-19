import React, { useEffect, useState } from 'react';
import { FormDialog } from '@/components/FormDialog';
import { listAvailableTargetWorkspaces, copySongToWorkspace, type CopySongResult } from '@/services/supabase/copy';
import type { Workspace } from '@/services/supabase/workspace';
import { SelectField } from '@/ui/components/SelectField';

interface CopySongModalProps {
  songId: string;
  songTitle: string;
  currentWorkspaceId: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (result: CopySongResult) => void;
}

export const CopySongModal: React.FC<CopySongModalProps> = ({
  songId,
  songTitle,
  currentWorkspaceId,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [targetWorkspaces, setTargetWorkspaces] = useState<Workspace[]>([]);
  const [selectedTargetId, setSelectedTargetId] = useState<string>('');
  const [includeAudio, setIncludeAudio] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setError(null);
      setIncludeAudio(false);
      void listAvailableTargetWorkspaces(currentWorkspaceId).then((workspaces) => {
        setTargetWorkspaces(workspaces);
        if (workspaces.length > 0) {
          setSelectedTargetId(workspaces[0]?.id || '');
        }
      });
    }
  }, [isOpen, currentWorkspaceId]);

  if (!isOpen) return null;

  const handleCopy = async () => {
    if (!selectedTargetId || loading) return;
    setLoading(true);
    setError(null);

    try {
      const result = await copySongToWorkspace(songId, selectedTargetId, { includeAudio });
      if (onSuccess) onSuccess(result);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Échec de la copie.');
      setLoading(false);
    }
  };

  return (
    <FormDialog
      title="Copier vers un autre espace"
      closeLabel="Fermer la copie"
      closeDisabled={loading}
      onClose={onClose}
    >
      <p className="text-sm leading-6 text-[var(--fz-text-muted)]">Titre d’origine : {songTitle}</p>

      {error && (
        <div role="alert" className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300">
          {error}
        </div>
      )}

      <div className="mt-4 space-y-4">
        <div>
          <label className="fz-field-label mb-2 block">Espace de destination</label>
          {targetWorkspaces.length === 0 ? (
            <p className="text-sm italic text-[var(--fz-text-muted)]">Aucun autre espace accessible en écriture.</p>
          ) : (
            <SelectField
              aria-label="Espace de destination"
              value={selectedTargetId}
              onChange={(event) => setSelectedTargetId(event.target.value)}
              disabled={loading}
            >
              {targetWorkspaces.map((workspace) => (
                <option key={workspace.id} value={workspace.id}>
                  {workspace.name} ({workspace.type === 'personal' ? 'Mon espace' : 'Groupe'})
                </option>
              ))}
            </SelectField>
          )}
        </div>

        <div className="flex min-h-11 items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-3.5">
          <input
            id="includeAudioOption"
            type="checkbox"
            checked={includeAudio}
            onChange={(event) => setIncludeAudio(event.target.checked)}
            disabled={loading || targetWorkspaces.length === 0}
            className="h-5 w-5 shrink-0 accent-[var(--fz-accent)]"
          />
          <label htmlFor="includeAudioOption" className="cursor-pointer text-sm leading-5 text-white/80">
            Inclure les fichiers audio (référence partagée sans duplication R2)
          </label>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 border-t border-white/10 pt-4">
        <button
          type="button"
          onClick={onClose}
          disabled={loading}
          className="fz-button-secondary min-h-11 px-4 text-xs font-semibold text-white/80 disabled:opacity-30"
        >
          Annuler
        </button>
        <button
          type="button"
          onClick={() => void handleCopy()}
          disabled={loading || targetWorkspaces.length === 0}
          className="fz-button-primary min-h-11 px-4 text-xs font-bold disabled:opacity-40"
        >
          {loading ? 'Copie en cours...' : 'Copier la chanson'}
        </button>
      </div>
    </FormDialog>
  );
};
