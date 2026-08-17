import React, { useEffect, useState } from 'react';
import { FormDialog } from '@/components/FormDialog';
import { ContentRow } from '@/ui/components/ContentRow';
import { listTrashedItems, restoreTrashedContent, purgeExpiredTrash, type TrashedItem } from '@/services/supabase/trash';

interface TrashModalProps {
  workspaceId: string;
  isOpen: boolean;
  onClose: () => void;
  onItemRestored?: () => void;
}

export const TrashModal: React.FC<TrashModalProps> = ({
  workspaceId,
  isOpen,
  onClose,
  onItemRestored,
}) => {
  const [items, setItems] = useState<TrashedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dryRunReport, setDryRunReport] = useState<string | null>(null);

  const loadItems = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await listTrashedItems(workspaceId);
      setItems(result);
    } catch (err: any) {
      setError(err.message || 'Impossible de charger la corbeille.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      void loadItems();
    }
  }, [isOpen, workspaceId]);

  if (!isOpen) return null;

  const handleRestore = async (item: TrashedItem) => {
    setError(null);
    try {
      await restoreTrashedContent(workspaceId, item.entityType, item.id);
      await loadItems();
      if (onItemRestored) onItemRestored();
    } catch (err: any) {
      setError(err.message || 'Echec de la restauration.');
    }
  };

  const handlePurgeDryRun = async () => {
    setError(null);
    try {
      const report = await purgeExpiredTrash(workspaceId, true);
      setDryRunReport(`Dry-run termine : ${report.purgedCount} elements expirés identifies pour la purge.`);
    } catch (err: any) {
      setError(err.message || 'Echec du calcul dry-run.');
    }
  };

  return (
    <FormDialog title="Corbeille des contenus" closeLabel="Fermer la corbeille" onClose={onClose}>
      <p className="text-sm leading-6 text-[var(--fz-text-muted)]">
        Rétention automatique pendant 7 jours avant purge
      </p>

      {error && (
        <div role="alert" className="mt-4 flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300">
          <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          </svg>
          <span>{error}</span>
        </div>
      )}

      {dryRunReport && (
        <div role="status" className="mt-4 flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-300">
          <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
          <span>{dryRunReport}</span>
        </div>
      )}

      <div className="mt-4 max-h-80 overflow-y-auto pr-1">
        {loading ? (
          <div className="py-8 text-center text-sm text-zinc-400">Chargement de la corbeille...</div>
        ) : items.length === 0 ? (
          <div className="py-8 text-center text-sm text-zinc-500">Aucun élément dans la corbeille.</div>
        ) : (
          <div className="divide-y divide-white/10">
            {items.map((item) => {
              const daysRemaining = Math.max(
                0,
                Math.ceil((new Date(item.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
              );

              return (
                <ContentRow
                  key={`${item.entityType}-${item.id}`}
                  mode="controls"
                  leading={
                    <span className="shrink-0 rounded bg-white/10 px-2 py-0.5 text-[10px] font-semibold uppercase text-white/70">
                      {item.entityType === 'songAsset'
                        ? 'Audio'
                        : item.entityType === 'setlist'
                          ? 'Setlist'
                          : 'Chanson'}
                    </span>
                  }
                  title={item.title}
                  metadata={`Expire dans ${daysRemaining} jour(s)`}
                  trailing={
                    <button
                      type="button"
                      onClick={() => handleRestore(item)}
                      className="flex min-h-11 shrink-0 items-center justify-center gap-1.5 rounded-lg bg-zinc-800 px-3 text-xs font-medium text-zinc-200 transition-colors hover:bg-zinc-700 hover:text-white"
                    >
                      <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                        <path d="M3 3v5h5" />
                      </svg>
                      Restaurer
                    </button>
                  }
                />
              );
            })}
          </div>
        )}
      </div>

      <div className="mt-6 flex flex-col gap-3 border-t border-zinc-800 pt-4 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="button"
          onClick={handlePurgeDryRun}
          className="min-h-11 text-left text-xs text-zinc-300 underline transition-colors hover:text-amber-300"
        >
          Simuler la purge des contenus expirés (Dry-Run)
        </button>
        <button
          type="button"
          onClick={onClose}
          className="fz-button-secondary min-h-11 px-4 text-xs font-semibold text-zinc-200"
        >
          Fermer
        </button>
      </div>
    </FormDialog>
  );
};
