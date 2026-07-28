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
import { canWriteWorkspace } from '@/services/supabase/workspace';
import { recoverPendingItems } from '@/db/userDataMigration';

const QR_ROTATION_INTERVAL_MS = 1200;
const SCANNER_ELEMENT_ID = 'faderzero-sync-scanner';

interface ReceiveState {
  transferId: string;
  total: number;
  payloadHash: string;
  fragments: Record<number, SyncQrFragment>;
}

function SyncTabIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21.5 2v6h-6" />
      <path d="M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
    </svg>
  );
}

function getScannerStartError() {
  if (typeof window === 'undefined') {
    return null;
  }

  if (!window.isSecureContext) {
    return "La caméra web est bloquée ici car la page n'est pas en contexte sécurisé. Sur téléphone, il faut ouvrir la PWA en HTTPS ou depuis localhost.";
  }

  if (!navigator.mediaDevices?.getUserMedia) {
    return "Ce navigateur ne permet pas l'accès caméra pour ce contexte.";
  }

  return null;
}

export function SyncTab() {
  const [transfer, setTransfer] = useState<PreparedSyncTransfer | null>(null);
  
  // États et hooks pour la synchronisation Supabase
  const { session, activeWorkspace, workspaces, refreshWorkspaceAccess } = useAuthStore();
  const canWrite = canWriteWorkspace(activeWorkspace?.role);
  const [isCloudSyncing, setIsCloudSyncing] = useState(false);
  const [cloudSyncError, setCloudSyncError] = useState<string | null>(null);
  const [cloudSyncSuccess, setCloudSyncSuccess] = useState<boolean>(false);
  const [isRecovering, setIsRecovering] = useState(false);
  const [recoveryMessage, setRecoveryMessage] = useState<string | null>(null);

  const personalWorkspace = workspaces.find((workspace) => workspace.type === 'personal') ?? null;
  const pendingRecoveryCount = useLiveQuery(
    () => db.recoveryItems.where('status').equals('pending').count(),
    [session?.user.id],
    0,
  );

  async function handleRecovery() {
    if (!personalWorkspace || isRecovering) return;
    setIsRecovering(true);
    setRecoveryMessage(null);
    try {
      const recoveredCount = await recoverPendingItems(personalWorkspace.id);
      setRecoveryMessage(`${recoveredCount} element(s) rattache(s) a Mon espace et places dans la file de synchronisation.`);
    } catch (error) {
      setRecoveryMessage(error instanceof Error ? error.message : 'La recuperation locale a echoue.');
    } finally {
      setIsRecovering(false);
    }
  }

  const conflicts = useLiveQuery(async () => {
    if (!activeWorkspace) return [];
    return db.syncConflicts
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
      const verifiedWorkspaces = await refreshWorkspaceAccess();
      const verifiedWorkspace = verifiedWorkspaces.find(({ id }) => id === activeWorkspace.id);
      if (!verifiedWorkspace) {
        setCloudSyncError('Vous n avez plus acces a cet espace. Ses donnees locales ont ete retirees.');
        return;
      }
      const pushReport = canWriteWorkspace(verifiedWorkspace.role)
        ? await pushPendingMutations(activeWorkspace.id, { includeFailed: true })
        : { failedCount: 0 };
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
    if (!canWrite) return;
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
    setImportResult(null);
    setPendingImportPayload(null);
    setImportPreview(null);
  }

  async function confirmImport() {
    if (!canWrite) return;
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
      {/* Top Header Section */}
      <section className="space-y-3">
        <div>
          <div className="flex items-center gap-2.5">
            <SyncTabIcon className="h-6 w-6 text-white shrink-0" />
            <h1 className="text-[1.45rem] font-black uppercase tracking-[0.18em] text-white">Synchronisation Cloud</h1>
          </div>
          <p className="mt-1 text-sm leading-relaxed text-[var(--fz-text-muted)]">
            Gère la synchronisation cloud Supabase et le transfert d'espace hors-ligne.
          </p>
        </div>
      </section>

      {pendingRecoveryCount > 0 ? (
        <FeatureCard
          eyebrow="Récupération locale"
          title={`${pendingRecoveryCount} élément(s) historique(s) à vérifier`}
          description="Ces données provenaient de default-workspace et n'ont été attribuées à aucun groupe."
          aside="Sans perte"
        >
          <div className="space-y-3">
            <p className="text-sm leading-6 text-white/70">
              Vous pouvez les rattacher à Mon espace. Les identifiants et relations sont conservés, puis chaque élément est synchronisé comme une nouvelle création.
            </p>
            <button
              type="button"
              onClick={() => void handleRecovery()}
              disabled={!personalWorkspace || isRecovering}
              className="fz-button-primary w-full px-4 py-3 text-sm font-black uppercase tracking-[0.14em] disabled:opacity-50"
            >
              {isRecovering ? 'Récupération...' : 'Rattacher à Mon espace'}
            </button>
            {!personalWorkspace ? (
              <p className="text-sm font-semibold text-amber-300">Mon espace est requis pour terminer la récupération.</p>
            ) : null}
            {recoveryMessage ? <p className="text-sm font-semibold text-white/80">{recoveryMessage}</p> : null}
          </div>
        </FeatureCard>
      ) : null}

      {/* Main Cloud Sync Status Block */}
      <div className="flex items-center justify-between rounded-[1.45rem] border border-white/10 bg-white/[0.045] p-4 shadow-[0_16px_32px_rgba(0,0,0,0.18)]">
        <div className="flex items-center gap-3.5 min-w-0">
          <span className="flex h-3 w-3 shrink-0 rounded-full bg-emerald-400 animate-pulse" />
          <div className="min-w-0">
            <p className="text-base font-black text-white truncate">Cloud à jour</p>
            <p className="text-xs text-[var(--fz-text-muted)] truncate">Toutes les données locales sont synchronisées.</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void handleCloudSync()}
          disabled={isCloudSyncing || !session}
          className="fz-button-secondary shrink-0 px-4 py-2.5 text-xs font-black uppercase tracking-[0.14em] text-white disabled:opacity-40"
        >
          {isCloudSyncing ? 'En cours...' : 'Forcer'}
        </button>
      </div>

      {/* LISTE DES CONFLITS */}
      {canWrite && conflicts && conflicts.length > 0 && (
        <div className="rounded-[1.35rem] border border-white/20 bg-white/5 p-4 space-y-3">
          <p className="text-[0.62rem] font-black uppercase tracking-[0.2em] text-white/90">Conflits Détectés ({conflicts.length})</p>
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
                    className="flex-1 rounded-lg border border-white/20 bg-white/10 py-2 text-[0.65rem] font-bold uppercase tracking-[0.1em] text-white hover:bg-white/15 transition"
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

      {/* SECTION PWA / OFFLINE STATUS */}
      <StatusPill label="Mode PWA" />

      {/* SECTION HORS LIGNE (QR CODES) */}
      {canWrite ? (
        <section className="space-y-3 pt-4 border-t border-white/10">
          <div>
            <h2 className="text-[1.45rem] font-black uppercase tracking-[0.18em] text-white">Synchronisation hors ligne</h2>
            <p className="mt-1 text-sm leading-relaxed text-[var(--fz-text-muted)]">
              Échangez des setlists et morceaux entre appareils sans réseau grâce aux QR codes animés.
            </p>
          </div>

          <div className="space-y-5 rounded-[1.6rem] border border-white/10 bg-white/[0.045] p-5 shadow-[0_24px_48px_rgba(0,0,0,0.18)]">
            <div className="rounded-[1.4rem] border border-white/8 bg-black/20 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[0.62rem] font-black uppercase tracking-[0.2em] text-white/45">Données locales</p>
                  <p className="mt-1 text-sm font-semibold text-white">
                    {summary ? `${summary.songs} morceaux, ${summary.setlists} setlists` : 'Chargement du contenu...'}
                  </p>
                </div>
                <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-black uppercase tracking-[0.16em] text-white">
                  {summary ? `${summary.fragments} QR` : '...'}
                </span>
              </div>
            </div>

            {error ? <p className="text-sm font-semibold text-rose-400">{error}</p> : null}

            {isLoading ? (
              <div className="rounded-[1.4rem] border border-white/8 bg-white/4 p-6 text-center text-sm font-semibold text-[var(--fz-text-muted)]">
                Préparation du transfert local...
              </div>
            ) : currentQrDataUrl && transfer ? (
              <div className="space-y-4 rounded-[1.4rem] border border-white/8 bg-white/4 p-4">
                <div className="flex flex-col items-center justify-center rounded-[1.2rem] bg-white p-4">
                  <img src={currentQrDataUrl} alt="QR code de transfert" className="h-64 w-64 object-contain" />
                </div>

                <div className="flex items-center justify-between text-xs font-bold uppercase tracking-[0.14em] text-[var(--fz-text-muted)]">
                  <span>{`Code ${currentIndex + 1} / ${transfer.qrValues.length}`}</span>
                  <span>{`Rotation ${QR_ROTATION_INTERVAL_MS}ms`}</span>
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={goToPreviousQr}
                    className="fz-button-secondary flex-1 px-3 py-2.5 text-xs font-black uppercase tracking-[0.14em] text-white"
                  >
                    Précédente
                  </button>
                  <button
                    type="button"
                    onClick={goToNextQr}
                    className="fz-button-secondary flex-1 px-3 py-2.5 text-xs font-black uppercase tracking-[0.14em] text-white"
                  >
                    Suivante
                  </button>
                </div>
              </div>
            ) : null}

            <div className="border-t border-white/8 pt-4 space-y-3">
              <p className="text-[0.62rem] font-black uppercase tracking-[0.2em] text-white/45">Recevoir un transfert</p>

              {getScannerStartError() ? (
                <p className="text-sm text-amber-300">{getScannerStartError()}</p>
              ) : isSecureContextAvailable ? (
                <button
                  type="button"
                  onClick={() => setIsScannerActive((previous) => !previous)}
                  className="fz-button-primary w-full px-4 py-3.5 text-xs font-black uppercase tracking-[0.16em]"
                >
                  {isScannerActive ? 'Fermer le scanner' : 'Démarrer la caméra / Scanner'}
                </button>
              ) : null}

              <div
                id={SCANNER_ELEMENT_ID}
                className={isScannerActive ? 'overflow-hidden rounded-[1.4rem] border border-white/12 bg-black' : 'hidden'}
              />

              {receiveState ? (
                <div className="rounded-[1.2rem] border border-emerald-500/20 bg-emerald-500/8 p-4 text-xs font-semibold text-emerald-200">
                  {`Fragment reçu : ${receivedCount} / ${receiveState.total}`}
                </div>
              ) : null}
            </div>



            {receiveError ? <p className="text-sm font-semibold text-rose-400">{receiveError}</p> : null}
            {receiveSuccess ? <p className="text-sm font-semibold text-emerald-400">{receiveSuccess}</p> : null}

            {importPreview ? (
              <div className="rounded-[1.2rem] border border-white/8 bg-white/4 px-4 py-4">
                <p className="text-[0.62rem] font-black uppercase tracking-[0.2em] text-white/45">Revue avant import</p>
                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-[1rem] border border-white/8 bg-black/20 px-3 py-3 text-sm text-white/90">
                    {`${importPreview.songsToCreate} morceaux à créer`}
                    <br />
                    {`${importPreview.songsToUpdate} morceaux à mettre à jour`}
                    <br />
                    {`${importPreview.songsToSkip} morceaux ignorés`}
                  </div>
                  <div className="rounded-[1rem] border border-white/8 bg-black/20 px-3 py-3 text-sm text-white/90">
                    {`${importPreview.setlistsToCreate} setlists à créer`}
                    <br />
                    {`${importPreview.setlistsToUpdate} setlists à mettre à jour`}
                    <br />
                    {`${importPreview.setlistsToSkip} setlists ignorées`}
                  </div>
                  <div className="rounded-[1rem] border border-white/8 bg-black/20 px-3 py-3 text-sm text-white/90">
                    {`${importPreview.setlistSongsToCreate} éléments de setlist à créer`}
                    <br />
                    {`${importPreview.setlistSongsToUpdate} éléments de setlist à mettre à jour`}
                    <br />
                    {`${importPreview.setlistSongsToSkip} éléments de setlist ignorés`}
                  </div>
                </div>

                <p className="mt-3 text-sm font-semibold text-amber-200">
                  {`${importPreview.idsRegenerated} identifiants seront régénérés. ${importPreview.songIdCollisions + importPreview.setlistIdCollisions + importPreview.setlistSongIdCollisions} collision(s) détectée(s) : aucun contenu local ne sera écrasé.`}
                </p>

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
                  <p className="text-[0.62rem] font-black uppercase tracking-[0.2em] text-white/45">Transfer ID</p>
                  <p className="mt-2 break-all text-sm text-white/88">{receiveState.transferId}</p>
                </div>
                <div className="rounded-[1.2rem] border border-white/8 bg-white/4 px-4 py-3">
                  <p className="text-[0.62rem] font-black uppercase tracking-[0.2em] text-white/45">Payload hash</p>
                  <p className="mt-2 break-all text-sm text-white/88">{receiveState.payloadHash}</p>
                </div>
              </div>
            ) : null}

            {importResult ? (
              <div className="rounded-[1.2rem] border border-emerald-500/20 bg-emerald-500/8 px-4 py-3 text-sm text-emerald-100">
                {`${importResult.songsImported} morceaux importés, ${importResult.setlistsImported} setlists importées, ${importResult.setlistSongsImported} éléments de setlist importés.`}
              </div>
            ) : null}
          </div>
        </section>
      ) : null}
    </div>
  );
}
