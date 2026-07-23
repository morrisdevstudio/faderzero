import React, { useEffect, useState } from 'react';
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/80 p-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
          <div className="flex items-center gap-3">
            <svg className="h-6 w-6 text-amber-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            </svg>
            <div>
              <h2 className="text-lg font-bold text-zinc-100">Corbeille des contenus</h2>
              <p className="text-xs text-zinc-400">Rétention automatique pendant 7 jours avant purge</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
          >
            Fermer
          </button>
        </div>

        {error && (
          <div className="mt-4 flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-400">
            <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        {dryRunReport && (
          <div className="mt-4 flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-400">
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
            <div className="space-y-2">
              {items.map((item) => {
                const daysRemaining = Math.max(
                  0,
                  Math.ceil((new Date(item.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
                );

                return (
                  <div
                    key={`${item.entityType}-${item.id}`}
                    className="flex items-center justify-between rounded-xl border border-zinc-800/80 bg-zinc-950/50 p-3.5 transition hover:border-zinc-700"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="rounded bg-zinc-800 px-2 py-0.5 text-[10px] uppercase font-semibold text-zinc-400">
                          {item.entityType === 'songAsset'
                            ? 'Audio'
                            : item.entityType === 'setlist'
                            ? 'Setlist'
                            : 'Chanson'}
                        </span>
                        <span className="text-sm font-medium text-zinc-200">{item.title}</span>
                      </div>
                      <div className="mt-1 flex items-center gap-1.5 text-xs text-zinc-500">
                        <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <circle cx="12" cy="12" r="10" />
                          <polyline points="12 6 12 12 16 14" />
                        </svg>
                        <span>Expire dans {daysRemaining} jour(s)</span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleRestore(item)}
                      className="flex items-center gap-1.5 rounded-lg bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-200 transition hover:bg-zinc-700 hover:text-white"
                    >
                      <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                        <path d="M3 3v5h5" />
                      </svg>
                      Restaurer
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="mt-6 flex items-center justify-between border-t border-zinc-800 pt-4">
          <button
            onClick={handlePurgeDryRun}
            className="text-xs text-zinc-400 hover:text-amber-400 transition underline"
          >
            Simuler la purge des contenus expirés (Dry-Run)
          </button>
          <button
            onClick={onClose}
            className="rounded-xl bg-zinc-800 px-4 py-2 text-xs font-semibold text-zinc-200 hover:bg-zinc-700"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
};
