import { useEffect, useMemo, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/db';
import { useAuthStore } from '@/stores/authStore';
import { pushPendingMutations, pullRemoteChanges, resolveConflict } from '@/services/supabase/sync';
import { FeatureCard } from '@/components/FeatureCard';
import { StatusPill } from '@/components/StatusPill';
import {
  applySyncImport,
  deserializeSyncQrFragment,
  prepareSyncTransfer,
  previewSyncImport,
  reconstructSyncExportPayload,
  type SyncExportPayload,
  type PreparedSyncTransfer,
  type SyncImportResult,
  type SyncImportPreview,
  type SyncQrFragment,
} from '@/features/sync/qrTransfer';
import type { Html5Qrcode } from 'html5-qrcode';

const QR_ROTATION_INTERVAL_MS = 1200;
const SCANNER_ELEMENT_ID = 'faderzero-sync-scanner';

interface ReceiveState {
  transferId: string;
  total: number;
  payloadHash: string;
  fragments: Record<number, SyncQrFragment>;
}

function getScannerStartError() {
  if (typeof window === 'undefined') {
    return null;
  }

  if (!window.isSecureContext) {
    return "La camera web est bloquee ici car la page n'est pas en contexte securise. Sur telephone, il faut ouvrir la PWA en HTTPS ou depuis localhost.";
  }

  if (!navigator.mediaDevices?.getUserMedia) {
    return "Ce navigateur ne permet pas l'acces camera pour ce contexte.";
  }

  return null;
}

export function SyncPage() {
  const [transfer, setTransfer] = useState<PreparedSyncTransfer | null>(null);
  
  // États et hooks pour la synchronisation Supabase
  const { session, activeWorkspace, signOut } = useAuthStore();
  const [isCloudSyncing, setIsCloudSyncing] = useState(false);
  const [cloudSyncError, setCloudSyncError] = useState<string | null>(null);
  const [cloudSyncSuccess, setCloudSyncSuccess] = useState<boolean>(false);

  const pendingCount = useLiveQuery(async () => {
    if (!activeWorkspace) return 0;
    return db.syncQueue
      .where('workspaceId')
      .equals(activeWorkspace.id)
      .filter((item) => item.status === 'pending' || item.status === 'failed')
      .count();
  }, [activeWorkspace]);

  const conflicts = useLiveQuery(async () => {
    if (!activeWorkspace) return [];
    return db.syncConflicts
      .where('workspaceId')
      .equals(activeWorkspace.id)
      .toArray();
  }, [activeWorkspace]);

  const lastState = useLiveQuery(async () => {
    if (!activeWorkspace) return [];
    return db.syncState
      .where('workspaceId')
      .equals(activeWorkspace.id)
      .toArray();
  }, [activeWorkspace]);

  async function handleCloudSync() {
    if (!activeWorkspace || isCloudSyncing) return;
    setIsCloudSyncing(true);
    setCloudSyncError(null);
    setCloudSyncSuccess(false);

    try {
      const pushReport = await pushPendingMutations(activeWorkspace.id, { includeFailed: true });
      await pullRemoteChanges(activeWorkspace.id);

      if (pushReport.failedCount > 0) {
        setCloudSyncError('Certaines modifications n ont pas pu etre synchronisees. Reessayez.');
      } else {
        setCloudSyncSuccess(true);
      }
    } catch (err: any) {
      console.error(err);
      setCloudSyncError(err.message || 'Erreur lors de la synchronisation.');
    } finally {
      setIsCloudSyncing(false);
    }
  }

  async function handleResolveConflict(conflictId: string, resolution: 'local' | 'remote') {
    try {
      await resolveConflict(conflictId, resolution);
    } catch (err: any) {
      console.error(err);
      setCloudSyncError('Erreur de résolution : ' + err.message);
    }
  }

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentQrDataUrl, setCurrentQrDataUrl] = useState<string | null>(null);
  const [isScannerActive, setIsScannerActive] = useState(false);
  const [receiveState, setReceiveState] = useState<ReceiveState | null>(null);
  const [receiveError, setReceiveError] = useState<string | null>(null);
  const [receiveSuccess, setReceiveSuccess] = useState<string | null>(null);
  const [manualFragment, setManualFragment] = useState('');
  const [importResult, setImportResult] = useState<SyncImportResult | null>(null);
  const [pendingImportPayload, setPendingImportPayload] = useState<SyncExportPayload | null>(null);
  const [importPreview, setImportPreview] = useState<SyncImportPreview | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const isImportingRef = useRef(false);

  useEffect(() => {
    let isMounted = true;

    async function loadTransfer() {
      try {
        const nextTransfer = await prepareSyncTransfer();
        if (!isMounted) {
          return;
        }

        setTransfer(nextTransfer);
        setCurrentIndex(0);
        setError(null);
      } catch (nextError) {
        if (!isMounted) {
          return;
        }

        console.error('[SyncPage] Unable to prepare sync transfer', nextError);
        setError('Impossible de preparer le transfert QR.');
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadTransfer();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!transfer || transfer.qrValues.length <= 1) {
      return;
    }

    const interval = window.setInterval(() => {
      setCurrentIndex((previousIndex) => (previousIndex + 1) % transfer.qrValues.length);
    }, QR_ROTATION_INTERVAL_MS);

    return () => {
      window.clearInterval(interval);
    };
  }, [transfer]);

  useEffect(() => {
    let isMounted = true;

    async function generateQrImage() {
      if (!transfer) {
        setCurrentQrDataUrl(null);
        return;
      }

      const qrValue = transfer.qrValues[currentIndex] ?? transfer.qrValues[0];
      if (!qrValue) {
        setCurrentQrDataUrl(null);
        return;
      }

      try {
        const nextDataUrl = await QRCode.toDataURL(qrValue, {
          errorCorrectionLevel: 'M',
          margin: 1,
          width: 320,
        });

        if (isMounted) {
          setCurrentQrDataUrl(nextDataUrl);
        }
      } catch (nextError) {
        console.error('[SyncPage] Unable to generate QR image', nextError);
        if (isMounted) {
          setError('Impossible de generer le QR code.');
        }
      }
    }

    generateQrImage();

    return () => {
      isMounted = false;
    };
  }, [currentIndex, transfer]);

  useEffect(() => {
    let cancelled = false;

    async function stopScanner() {
      const scanner = scannerRef.current;
      scannerRef.current = null;

      if (!scanner) {
        return;
      }

      try {
        if (scanner.isScanning) {
          await scanner.stop();
        }
      } catch (scannerError) {
        console.error('[SyncPage] Unable to stop scanner', scannerError);
      }

      try {
        await scanner.clear();
      } catch (clearError) {
        console.error('[SyncPage] Unable to clear scanner', clearError);
      }
    }

    async function startScanner() {
      if (!isScannerActive || scannerRef.current || typeof window === 'undefined') {
        return;
      }

      try {
        const { Html5Qrcode } = await import('html5-qrcode');
        if (cancelled) {
          return;
        }

        const scanner = new Html5Qrcode(SCANNER_ELEMENT_ID, false);
        scannerRef.current = scanner;

        await scanner.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 220, height: 220 } },
          (decodedText) => {
            void handleIncomingFragment(decodedText);
          },
        );
      } catch (scannerError) {
        console.error('[SyncPage] Unable to start scanner', scannerError);
        setReceiveError('Impossible de demarrer la camera pour le scan QR.');
        setIsScannerActive(false);
        await stopScanner();
      }
    }

    if (isScannerActive) {
      void startScanner();
    } else {
      void stopScanner();
    }

    return () => {
      cancelled = true;
      void stopScanner();
    };
  }, [isScannerActive]);

  const summary = useMemo(() => {
    if (!transfer) {
      return null;
    }

    return {
      songs: transfer.exportPayload.payload.songs.length,
      setlists: transfer.exportPayload.payload.setlists.length,
      setlistSongs: transfer.exportPayload.payload.setlistSongs.length,
      fragments: transfer.fragments.length,
    };
  }, [transfer]);

  const receivedCount = receiveState ? Object.keys(receiveState.fragments).length : 0;
  const isSecureContextAvailable = typeof window === 'undefined' ? true : window.isSecureContext;

  function goToPreviousQr() {
    if (!transfer) {
      return;
    }

    setCurrentIndex((previousIndex) => (previousIndex - 1 + transfer.qrValues.length) % transfer.qrValues.length);
  }

  function goToNextQr() {
    if (!transfer) {
      return;
    }

    setCurrentIndex((previousIndex) => (previousIndex + 1) % transfer.qrValues.length);
  }

  async function handleCompletedTransfer(nextState: ReceiveState) {
    if (isImportingRef.current) {
      return;
    }

    isImportingRef.current = true;
    setReceiveError(null);
    setReceiveSuccess('Analyse du transfert...');

    try {
      const exportPayload = await reconstructSyncExportPayload(Object.values(nextState.fragments));
      const nextImportPreview = await previewSyncImport(exportPayload);
      setPendingImportPayload(exportPayload);
      setImportPreview(nextImportPreview);
      setImportResult(null);
      setReceiveSuccess('Transfert reconstitue. Verifiez le resume avant import.');
      setIsScannerActive(false);
    } catch (nextError) {
      console.error('[SyncPage] Unable to import transfer', nextError);
      setReceiveError("Impossible de reconstituer ou d'analyser ce transfert.");
      setReceiveSuccess(null);
    } finally {
      isImportingRef.current = false;
    }
  }

  async function handleIncomingFragment(rawValue: string) {
    try {
      const fragment = deserializeSyncQrFragment(rawValue);

      setReceiveError(null);
      setReceiveSuccess(null);

      setReceiveState((previousState) => {
        if (!previousState) {
          const nextState: ReceiveState = {
            transferId: fragment.transferId,
            total: fragment.total,
            payloadHash: fragment.payloadHash,
            fragments: {
              [fragment.index]: fragment,
            },
          };

          if (fragment.total === 1) {
            void handleCompletedTransfer(nextState);
          }

          return nextState;
        }

        if (
          previousState.transferId !== fragment.transferId ||
          previousState.total !== fragment.total ||
          previousState.payloadHash !== fragment.payloadHash
        ) {
          setReceiveError('Le fragment scanne ne correspond pas au transfert en cours.');
          return previousState;
        }

        if (previousState.fragments[fragment.index]) {
          return previousState;
        }

        const nextState: ReceiveState = {
          ...previousState,
          fragments: {
            ...previousState.fragments,
            [fragment.index]: fragment,
          },
        };

        if (Object.keys(nextState.fragments).length === nextState.total) {
          void handleCompletedTransfer(nextState);
        }

        return nextState;
      });
    } catch {
      setReceiveError('Fragment QR invalide.');
    }
  }

  function resetReceiveState() {
    setReceiveState(null);
    setReceiveError(null);
    setReceiveSuccess(null);
    setManualFragment('');
    setImportResult(null);
    setPendingImportPayload(null);
    setImportPreview(null);
  }

  async function handleManualSubmit() {
    const value = manualFragment.trim();
    if (!value) {
      return;
    }

    await handleIncomingFragment(value);
    setManualFragment('');
  }

  async function confirmImport() {
    if (!pendingImportPayload || isImportingRef.current) {
      return;
    }

    isImportingRef.current = true;
    setReceiveError(null);
    setReceiveSuccess("Import en cours...");

    try {
      const nextImportResult = await applySyncImport(pendingImportPayload);
      setImportResult(nextImportResult);
      setPendingImportPayload(null);
      setImportPreview(null);
      setReceiveSuccess(
        `Import termine: ${nextImportResult.songsImported} songs, ${nextImportResult.setlistsImported} setlists, ${nextImportResult.setlistSongsImported} setlistSongs.`,
      );
    } catch (nextError) {
      console.error('[SyncPage] Unable to confirm import', nextError);
      setReceiveError("Impossible d'importer ce transfert.");
      setReceiveSuccess(null);
    } finally {
      isImportingRef.current = false;
    }
  }

  return (
    <div className="space-y-4">
      {/* SECTION SUPABASE SYNC */}
      <FeatureCard
        eyebrow="Supabase"
        title="Synchronisation Cloud"
        description="Statut de connexion de votre groupe et file d'attente."
        aside="Cloud"
      >
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-[1.35rem] border border-white/8 bg-black/20 p-4">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-[var(--fz-text-muted)]">Compte</p>
              <p className="mt-2 text-sm font-semibold text-white truncate">{session?.user?.email || 'Non connecté'}</p>
            </div>
            <div className="rounded-[1.35rem] border border-white/8 bg-black/20 p-4">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-[var(--fz-text-muted)]">Groupe Actif</p>
              <p className="mt-2 text-sm font-semibold text-white">{activeWorkspace?.name || 'Aucun'}</p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-[1.35rem] border border-white/8 bg-black/20 p-4">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-[var(--fz-text-muted)]">En attente de sync</p>
              <p className="mt-2 text-base font-black text-white">{pendingCount ?? 0} modifications</p>
            </div>
            <div className="rounded-[1.35rem] border border-white/8 bg-black/20 p-4">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-[var(--fz-text-muted)]">Checkpoints</p>
              <div className="mt-2 space-y-1 text-xs text-white/80">
                {lastState && lastState.length > 0 ? (
                  lastState.map(s => (
                    <div key={s.id} className="flex justify-between">
                      <span className="capitalize">{s.tableName} :</span>
                      <span className="font-mono">v{s.lastPulledVersion}</span>
                    </div>
                  ))
                ) : (
                  <p className="text-white/40">Aucun historique de sync</p>
                )}
              </div>
            </div>
          </div>

          {/* LISTE DES CONFLITS */}
          {conflicts && conflicts.length > 0 && (
            <div className="rounded-[1.35rem] border border-orange-500/20 bg-orange-500/5 p-4 space-y-3">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-orange-400">Conflits Détectés ({conflicts.length})</p>
              <div className="space-y-3.5">
                {conflicts.map((conflict) => (
                  <div key={conflict.id} className="rounded-xl border border-white/5 bg-white/3 p-3.5 space-y-3">
                    <div>
                      <p className="text-[0.62rem] font-bold uppercase tracking-[0.1em] text-white/50">{conflict.entityType}</p>
                      <p className="text-sm font-semibold text-white mt-0.5">
                        {conflict.localRecord?.title || conflict.localRecord?.name || conflict.entityId}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleResolveConflict(conflict.id, 'local')}
                        className="flex-1 rounded-lg border border-orange-500/20 bg-orange-500/10 py-2 text-[0.65rem] font-bold uppercase tracking-[0.1em] text-orange-300 hover:bg-orange-500/20 transition"
                      >
                        Garder ma version
                      </button>
                      <button
                        type="button"
                        onClick={() => handleResolveConflict(conflict.id, 'remote')}
                        className="flex-1 rounded-lg border border-white/10 bg-white/5 py-2 text-[0.65rem] font-bold uppercase tracking-[0.1em] text-white/80 hover:bg-white/10 transition"
                      >
                        Garder version groupe
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {cloudSyncError && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
              {cloudSyncError}
            </div>
          )}

          {cloudSyncSuccess && (
            <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs">
              Synchronisation réussie !
            </div>
          )}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleCloudSync}
              disabled={isCloudSyncing || !activeWorkspace}
              className="fz-button-primary flex-1 py-3.5 text-sm font-black uppercase tracking-[0.16em]"
            >
              {isCloudSyncing ? 'Synchronisation...' : 'Synchroniser maintenant'}
            </button>
            <button
              type="button"
              onClick={() => signOut()}
              className="fz-button-secondary px-4 py-3.5 text-sm font-black uppercase tracking-[0.16em] text-white"
            >
              Déconnexion
            </button>
          </div>
        </div>
      </FeatureCard>

      <FeatureCard
        eyebrow="Sync"
        title="Transmission QR"
        description="Export local compresse, fragmente et affiche en sequence QR pour transmettre songs, setlists et setlistSongs sans backend."
        aside="Export"
      >
        <div className="grid gap-3">
          <div className="rounded-[1.35rem] border border-white/8 bg-black/20 p-4">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-[var(--fz-text-muted)]">Payload</p>
            <p className="mt-2 text-base font-black text-white">Protocol `faderzero-sync` v1, source `faderzero-pwa`.</p>
          </div>
          <div className="rounded-[1.35rem] border border-white/8 bg-black/20 p-4">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-[var(--fz-text-muted)]">Contenu</p>
            <p className="mt-2 text-sm text-white/88">
              {summary
                ? `${summary.songs} songs · ${summary.setlists} setlists · ${summary.setlistSongs} setlistSongs`
                : 'Preparation du contenu local...'}
            </p>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          <StatusPill label="QR transfer" tone="accent" />
          <StatusPill label="LZ-String" />
          <StatusPill label="Offline safe" tone="success" />
        </div>
      </FeatureCard>

      <FeatureCard
        eyebrow="Transmit"
        title={isLoading ? 'Preparation...' : error ? 'Transmission indisponible' : 'Exporter les donnees locales'}
        description={
          error
            ? error
            : 'La sequence tourne automatiquement comme dans l app Expo. Vous pouvez aussi naviguer manuellement entre les QR.'
        }
        aside={transfer ? `QR ${currentIndex + 1}/${transfer.fragments.length}` : '...'}
      >
        <div className="rounded-[1.5rem] border border-white/8 bg-black/20 p-4">
          <div className="flex min-h-[20rem] items-center justify-center rounded-[1.3rem] bg-white p-4">
            {isLoading ? (
              <div className="text-center text-sm font-black uppercase tracking-[0.18em] text-zinc-500">Preparation</div>
            ) : error ? (
              <div className="max-w-[16rem] text-center text-sm font-semibold text-rose-500">{error}</div>
            ) : currentQrDataUrl ? (
              <img src={currentQrDataUrl} alt={`QR ${currentIndex + 1}`} className="h-auto w-full max-w-[18rem]" />
            ) : (
              <div className="text-center text-sm font-black uppercase tracking-[0.18em] text-zinc-500">QR indisponible</div>
            )}
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={goToPreviousQr}
              disabled={!transfer || transfer.fragments.length <= 1}
              className="fz-button-secondary flex-1 px-4 py-3 text-sm font-black uppercase tracking-[0.16em] text-white disabled:opacity-40"
            >
              Precedent
            </button>
            <div className="w-full rounded-full border border-white/10 bg-white/5 px-4 py-2 text-center text-[0.72rem] font-black uppercase tracking-[0.16em] text-white/90 sm:w-auto">
              {transfer ? `QR ${currentIndex + 1}/${transfer.fragments.length}` : '...'}
            </div>
            <button
              type="button"
              onClick={goToNextQr}
              disabled={!transfer || transfer.fragments.length <= 1}
              className="fz-button-secondary flex-1 px-4 py-3 text-sm font-black uppercase tracking-[0.16em] text-white disabled:opacity-40"
            >
              Suivant
            </button>
          </div>
        </div>
      </FeatureCard>

      <FeatureCard
        eyebrow="Receive"
        title="Recevoir un transfert QR"
        description="Scan progressif des fragments, verification du hash global puis import propre dans IndexedDB."
        aside={receiveState ? `QR ${receivedCount}/${receiveState.total}` : 'Scan'}
      >
        <div className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => {
                const scannerStartError = getScannerStartError();
                if (scannerStartError && !isScannerActive) {
                  setReceiveError(scannerStartError);
                  setReceiveSuccess(null);
                  return;
                }

                setIsScannerActive((value) => !value);
              }}
              className="fz-button-primary px-4 py-3 text-sm font-black uppercase tracking-[0.16em]"
            >
              {isScannerActive ? 'Arreter le scan' : 'Demarrer le scan'}
            </button>
            <button
              type="button"
              onClick={resetReceiveState}
              className="fz-button-secondary px-4 py-3 text-sm font-black uppercase tracking-[0.16em] text-white"
            >
              Reinitialiser
            </button>
          </div>

          <div className="rounded-[1.5rem] border border-white/8 bg-black/20 p-4">
            <div
              id={SCANNER_ELEMENT_ID}
              className="min-h-[18rem] overflow-hidden rounded-[1.25rem] border border-dashed border-white/15 bg-black/30"
            />
            <div className="mt-4 flex flex-wrap gap-2">
              <StatusPill label={isScannerActive ? 'Camera active' : 'Camera inactive'} tone={isScannerActive ? 'accent' : 'default'} />
              <StatusPill label={receiveState ? `Fragments ${receivedCount}/${receiveState.total}` : 'Aucun fragment'} />
            </div>
            {!isSecureContextAvailable ? (
              <p className="mt-4 text-sm text-amber-300">
                La camera ne fonctionnera probablement pas depuis `http://192.168.x.x`. Utilise HTTPS pour le scan mobile,
                ou colle les fragments manuellement en attendant.
              </p>
            ) : null}
          </div>

          <div className="rounded-[1.35rem] border border-white/8 bg-black/20 p-4">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-[var(--fz-text-muted)]">Ajout manuel</p>
            <textarea
              value={manualFragment}
              onChange={(event) => setManualFragment(event.target.value)}
              rows={4}
              placeholder="Coller ici un fragment QR serialize..."
              className="fz-input mt-3 min-h-28 resize-y text-sm"
            />
            <button
              type="button"
              onClick={() => void handleManualSubmit()}
              className="fz-button-secondary mt-3 w-full px-4 py-3 text-sm font-black uppercase tracking-[0.16em] text-white"
            >
              Ajouter le fragment
            </button>
          </div>

          {receiveError ? <p className="text-sm font-semibold text-rose-400">{receiveError}</p> : null}
          {receiveSuccess ? <p className="text-sm font-semibold text-emerald-400">{receiveSuccess}</p> : null}

          {importPreview ? (
            <div className="rounded-[1.2rem] border border-white/8 bg-white/4 px-4 py-4">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-[var(--fz-text-muted)]">Revue avant import</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <div className="rounded-[1rem] border border-white/8 bg-black/20 px-3 py-3 text-sm text-white/90">
                  {`${importPreview.songsToCreate} songs a creer`}
                  <br />
                  {`${importPreview.songsToUpdate} songs a mettre a jour`}
                  <br />
                  {`${importPreview.songsToSkip} songs ignores`}
                </div>
                <div className="rounded-[1rem] border border-white/8 bg-black/20 px-3 py-3 text-sm text-white/90">
                  {`${importPreview.setlistsToCreate} setlists a creer`}
                  <br />
                  {`${importPreview.setlistsToUpdate} setlists a mettre a jour`}
                  <br />
                  {`${importPreview.setlistsToSkip} setlists ignorees`}
                </div>
                <div className="rounded-[1rem] border border-white/8 bg-black/20 px-3 py-3 text-sm text-white/90">
                  {`${importPreview.setlistSongsToCreate} setlistSongs a creer`}
                  <br />
                  {`${importPreview.setlistSongsToUpdate} setlistSongs a mettre a jour`}
                  <br />
                  {`${importPreview.setlistSongsToSkip} setlistSongs ignores`}
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => void confirmImport()}
                  className="fz-button-primary px-4 py-3 text-sm font-black uppercase tracking-[0.16em]"
                >
                  Confirmer l'import
                </button>
                <button
                  type="button"
                  onClick={resetReceiveState}
                  className="fz-button-secondary px-4 py-3 text-sm font-black uppercase tracking-[0.16em] text-white"
                >
                  Annuler ce transfert
                </button>
              </div>
            </div>
          ) : null}

          {receiveState ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-[1.2rem] border border-white/8 bg-white/4 px-4 py-3">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-[var(--fz-text-muted)]">Transfer ID</p>
                <p className="mt-2 break-all text-sm text-white/88">{receiveState.transferId}</p>
              </div>
              <div className="rounded-[1.2rem] border border-white/8 bg-white/4 px-4 py-3">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-[var(--fz-text-muted)]">Payload hash</p>
                <p className="mt-2 break-all text-sm text-white/88">{receiveState.payloadHash}</p>
              </div>
            </div>
          ) : null}

          {importResult ? (
            <div className="rounded-[1.2rem] border border-emerald-500/20 bg-emerald-500/8 px-4 py-3 text-sm text-emerald-100">
              {`${importResult.songsImported} songs importes, ${importResult.setlistsImported} setlists importees, ${importResult.setlistSongsImported} setlistSongs importes.`}
            </div>
          ) : null}
        </div>
      </FeatureCard>
    </div>
  );
}

