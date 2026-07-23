import React, { useEffect, useState } from 'react';
import { listAvailableTargetWorkspaces, copySongToWorkspace, type CopySongResult } from '@/services/supabase/copy';
import type { Workspace } from '@/services/supabase/workspace';

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/80 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
          <div>
            <h2 className="text-lg font-bold text-zinc-100">Copier vers un autre espace</h2>
            <p className="text-xs text-zinc-400">Titre d'origine : {songTitle}</p>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 disabled:opacity-30"
          >
            Fermer
          </button>
        </div>

        {error && (
          <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-400">
            {error}
          </div>
        )}

        <div className="mt-4 space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-2">
              Espace de destination
            </label>
            {targetWorkspaces.length === 0 ? (
              <p className="text-xs text-zinc-500 italic">Aucun autre espace accessible en écriture.</p>
            ) : (
              <select
                value={selectedTargetId}
                onChange={(e) => setSelectedTargetId(e.target.value)}
                disabled={loading}
                className="w-full rounded-xl border border-zinc-700 bg-zinc-950 p-3 text-sm text-zinc-100 focus:outline-none"
              >
                {targetWorkspaces.map((ws) => (
                  <option key={ws.id} value={ws.id}>
                    {ws.name} ({ws.type === 'personal' ? 'Mon espace' : 'Groupe'})
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-950/60 p-3.5">
            <input
              id="includeAudioOption"
              type="checkbox"
              checked={includeAudio}
              onChange={(e) => setIncludeAudio(e.target.checked)}
              disabled={loading || targetWorkspaces.length === 0}
              className="h-4 w-4 rounded border-zinc-700 bg-zinc-900 text-orange-500 focus:ring-orange-500"
            />
            <label htmlFor="includeAudioOption" className="cursor-pointer text-xs text-zinc-300">
              Inclure les fichiers audio (référence partagée sans duplication R2)
            </label>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-end gap-3 border-t border-zinc-800 pt-4">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="rounded-xl border border-zinc-700 px-4 py-2 text-xs font-semibold text-zinc-300 hover:bg-zinc-800 disabled:opacity-30"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={handleCopy}
            disabled={loading || targetWorkspaces.length === 0}
            className="rounded-xl bg-orange-500 px-4 py-2 text-xs font-bold text-white hover:bg-orange-400 disabled:opacity-40"
          >
            {loading ? 'Copie en cours...' : 'Copier la chanson'}
          </button>
        </div>
      </div>
    </div>
  );
};
