import { useEffect, useMemo, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/db';
import { useAuthStore } from '@/stores/authStore';
import { pushPendingMutations, pullRemoteChanges, resolveConflict } from '@/services/supabase/sync';
import { FeatureCard } from '@/components/FeatureCard';
import { StatusPill } from '@/ui/components/StatusPill';
import { Button } from '@/ui/components/Button';
import { SearchField } from '@/ui/components/SearchField';
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
import { FzIcon } from '@/ui/icons';

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
  const { session, activeWorkspace, workspaces, refreshWorkspaceAccess } = useAuthStore();
  const canWrite = canWriteWorkspace(activeWorkspace?.role);
  const currentWorkspaceId = activeWorkspace?.id ?? 'default-workspace';

  // Synchronisation Cloud
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
      setRecoveryMessage(`${recoveredCount} élément(s) rattaché(s) à Mon espace et placés dans la file de synchronisation.`);
    } catch (error) {
      setRecoveryMessage(error instanceof Error ? error.message : 'La récupération locale a échoué.');
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
        setCloudSyncError('Vous n avez plus accès à cet espace. Ses données locales ont été retirées.');
        return;
      }
      const pushReport = canWriteWorkspace(verifiedWorkspace.role)
        ? await pushPendingMutations(activeWorkspace.id, { includeFailed: true })
        : { failedCount: 0 };
      await pullRemoteChanges(activeWorkspace.id);

      if (pushReport.failedCount > 0) {
        setCloudSyncError('Certaines modifications n ont pas pu être synchronisées. Réessayez.');
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

  // Données de l'espace pour l'exportation
  const allWorkspaceSongs = useLiveQuery(
    () => db.songs.where('workspaceId').equals(currentWorkspaceId).filter((s) => s.deletedAt === undefined).toArray(),
    [currentWorkspaceId],
    [],
  );

  const allWorkspaceSetlists = useLiveQuery(
    () => db.setlists.where('workspaceId').equals(currentWorkspaceId).filter((s) => s.deletedAt === undefined).toArray(),
    [currentWorkspaceId],
    [],
  );

  const allWorkspaceSetlistSongs = useLiveQuery(
    () => db.setlistSongs.where('workspaceId').equals(currentWorkspaceId).filter((s) => s.deletedAt === undefined).toArray(),
    [currentWorkspaceId],
    [],
  );

  // États de sélection pour l'export QR
  const [selectedSetlistIds, setSelectedSetlistIds] = useState<string[]>([]);
  const [selectedSongIds, setSelectedSongIds] = useState<string[]>([]);
  const [songSearchQuery, setSongSearchQuery] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  // Calcul des morceaux automatiquement inclus via les setlists cochées
  const songsInSelectedSetlists = useMemo(() => {
    const selectedSetlistSet = new Set(selectedSetlistIds);
    const songIds = new Set<string>();
    for (const entry of allWorkspaceSetlistSongs) {
      if (selectedSetlistSet.has(entry.setlistId) && entry.deletedAt === undefined) {
        songIds.add(entry.songId);
      }
    }
    return songIds;
  }, [selectedSetlistIds, allWorkspaceSetlistSongs]);

  // Tous les morceaux distincts exportés
  const allIncludedSongIds = useMemo(() => {
    const set = new Set(songsInSelectedSetlists);
    for (const id of selectedSongIds) {
      set.add(id);
    }
    return set;
  }, [songsInSelectedSetlists, selectedSongIds]);

  // Map du nombre de morceaux par setlist
  const songCountBySetlist = useMemo(() => {
    const counts = new Map<string, number>();
    for (const entry of allWorkspaceSetlistSongs) {
      if (entry.deletedAt === undefined) {
        counts.set(entry.setlistId, (counts.get(entry.setlistId) ?? 0) + 1);
      }
    }
    return counts;
  }, [allWorkspaceSetlistSongs]);

  // Filtrage de la liste de morceaux pour l'affichage
  const filteredSongs = useMemo(() => {
    const query = songSearchQuery.trim().toLocaleLowerCase();
    if (!query) {
      return allWorkspaceSongs;
    }
    return allWorkspaceSongs.filter(
      (song) =>
        song.title.toLocaleLowerCase().includes(query) ||
        (song.artist && song.artist.toLocaleLowerCase().includes(query)),
    );
  }, [allWorkspaceSongs, songSearchQuery]);

  // Bascule de sélection
  function toggleSetlist(id: string) {
    setSelectedSetlistIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  }

  function toggleSong(id: string) {
    setSelectedSongIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  }

  function selectAll() {
    setSelectedSetlistIds(allWorkspaceSetlists.map((s) => s.id));
    setSelectedSongIds(allWorkspaceSongs.map((s) => s.id));
  }

  function deselectAll() {
    setSelectedSetlistIds([]);
    setSelectedSongIds([]);
  }

  // États du transfert QR actif
  const [transfer, setTransfer] = useState<PreparedSyncTransfer | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentQrDataUrl, setCurrentQrDataUrl] = useState<string | null>(null);

  // États de réception
  const [isScannerActive, setIsScannerActive] = useState(false);
  const [receiveState, setReceiveState] = useState<ReceiveState | null>(null);
  const [receiveError, setReceiveError] = useState<string | null>(null);
  const [receiveSuccess, setReceiveSuccess] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<SyncImportResult | null>(null);
  const [pendingImportPayload, setPendingImportPayload] = useState<SyncExportPayload | null>(null);
  const [importPreview, setImportPreview] = useState<SyncImportPreview | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const isImportingRef = useRef(false);

  // Génération du transfert ciblé
  async function handleGenerateTransfer() {
    if (selectedSetlistIds.length === 0 && selectedSongIds.length === 0) {
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      const nextTransfer = await prepareSyncTransfer(db, {
        workspaceId: currentWorkspaceId,
        setlistIds: selectedSetlistIds,
        songIds: selectedSongIds,
      });

      setTransfer(nextTransfer);
      setCurrentIndex(0);
    } catch (nextError: any) {
      console.error('[SyncPage] Unable to prepare sync transfer', nextError);
      setError(nextError?.message || 'Impossible de préparer le transfert QR.');
    } finally {
      setIsGenerating(false);
    }
  }

  function handleModifySelection() {
    setTransfer(null);
    setCurrentQrDataUrl(null);
    setCurrentIndex(0);
  }

  // Rotation automatique du QR code
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

  // Rendu de l'image QR
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
          setError('Impossible de générer le QR code.');
        }
      }
    }

    void generateQrImage();

    return () => {
      isMounted = false;
    };
  }, [currentIndex, transfer]);

  // Scanner de réception
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
        setReceiveError('Impossible de démarrer la caméra pour le scan QR.');
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

  const receivedCount = receiveState ? Object.keys(receiveState.fragments).length : 0;
  const isSecureContextAvailable = typeof window === 'undefined' ? true : window.isSecureContext;

  function goToPreviousQr() {
    if (!transfer) return;
    setCurrentIndex((previousIndex) => (previousIndex - 1 + transfer.qrValues.length) % transfer.qrValues.length);
  }

  function goToNextQr() {
    if (!transfer) return;
    setCurrentIndex((previousIndex) => (previousIndex + 1) % transfer.qrValues.length);
  }

  async function handleCompletedTransfer(nextState: ReceiveState) {
    if (isImportingRef.current) return;

    isImportingRef.current = true;
    setReceiveError(null);
    setReceiveSuccess('Analyse du transfert...');

    try {
      const exportPayload = await reconstructSyncExportPayload(Object.values(nextState.fragments));
      const nextImportPreview = await previewSyncImport(exportPayload, db, currentWorkspaceId);
      setPendingImportPayload(exportPayload);
      setImportPreview(nextImportPreview);
      setImportResult(null);
      setReceiveSuccess('Transfert reconstitué. Vérifiez le résumé avant import.');
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
          setReceiveError('Le fragment scanné ne correspond pas au transfert en cours.');
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
    setReceiveSuccess('Import en cours...');

    try {
      const nextImportResult = await applySyncImport(pendingImportPayload, db, currentWorkspaceId);
      setImportResult(nextImportResult);
      setPendingImportPayload(null);
      setImportPreview(null);
      setReceiveSuccess(
        `Import réussi : ${nextImportResult.songsImported} morceau(x), ${nextImportResult.setlistsImported} setlist(s).`,
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
            <Button
              variant="primary"
              fullWidth
              onClick={() => void handleRecovery()}
              disabled={!personalWorkspace || isRecovering}
              loading={isRecovering}
            >
              Rattacher à Mon espace
            </Button>
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
        <Button
          variant="secondary"
          size="sm"
          onClick={() => void handleCloudSync()}
          disabled={isCloudSyncing || !session}
          loading={isCloudSyncing}
        >
          Forcer
        </Button>
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
                    onClick={() => void handleResolveConflict(conflict.id, 'local')}
                    className="flex-1 rounded-lg border border-white/20 bg-white/10 py-2 text-[0.65rem] font-bold uppercase tracking-[0.1em] text-white hover:bg-white/15 transition"
                  >
                    Garder ma version
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleResolveConflict(conflict.id, 'remote')}
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
        <section className="space-y-4 pt-4 border-t border-white/10">
          <div>
            <h2 className="text-[1.45rem] font-black uppercase tracking-[0.18em] text-white">Synchronisation hors ligne</h2>
            <p className="mt-1 text-sm leading-relaxed text-[var(--fz-text-muted)]">
              Échangez des setlists et morceaux ciblés entre appareils sans réseau grâce aux QR codes animés.
            </p>
          </div>

          <div className="space-y-5 rounded-[1.6rem] border border-white/10 bg-white/[0.045] p-5 shadow-[0_24px_48px_rgba(0,0,0,0.18)]">

            {/* VUE 1 : QR CODE EN COURS DE DIFFUSION */}
            {transfer && currentQrDataUrl ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-400 animate-ping" />
                    <p className="text-xs font-black uppercase tracking-[0.14em] text-emerald-300">Transfert QR en cours</p>
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    leadingIcon={<FzIcon name="back" usageId="sync.back-top" size="sm" />}
                    onClick={handleModifySelection}
                  >
                    Retour
                  </Button>
                </div>

                <div className="rounded-[1.4rem] border border-white/8 bg-black/20 p-3.5 text-xs text-white/80 flex items-center justify-between">
                  <span>
                    {transfer.exportPayload.payload.setlists.length} setlist(s) · {transfer.exportPayload.payload.songs.length} morceau(x)
                  </span>
                  <span className="font-bold text-white">
                    {transfer.fragments.length} QR frame(s)
                  </span>
                </div>

                <div className="space-y-4 rounded-[1.4rem] border border-white/8 bg-white/4 p-4">
                  <div className="flex flex-col items-center justify-center rounded-[1.2rem] bg-white p-4">
                    <img src={currentQrDataUrl} alt="QR code de transfert" className="h-64 w-64 object-contain" />
                  </div>

                  <div className="flex items-center justify-between text-xs font-bold uppercase tracking-[0.14em] text-[var(--fz-text-muted)]">
                    <span>{`Code ${currentIndex + 1} / ${transfer.qrValues.length}`}</span>
                    <span>{`Rotation ${QR_ROTATION_INTERVAL_MS}ms`}</span>
                  </div>

                  <div className="flex gap-2">
                    <Button variant="secondary" fullWidth size="sm" onClick={goToPreviousQr}>
                      Précédente
                    </Button>
                    <Button variant="secondary" fullWidth size="sm" onClick={goToNextQr}>
                      Suivante
                    </Button>
                  </div>

                  <Button
                    variant="secondary"
                    fullWidth
                    leadingIcon={<FzIcon name="back" usageId="sync.back-bottom" size="sm" />}
                    onClick={handleModifySelection}
                  >
                    Retour à la sélection
                  </Button>
                </div>
              </div>
            ) : (
              /* VUE 2 : SÉLECTEUR DE DONNÉES À EXPORTER */
              <div className="space-y-5">
                {/* Actions globales de sélection */}
                <div className="flex items-center justify-between border-b border-white/8 pb-3">
                  <p className="text-[0.68rem] font-black uppercase tracking-[0.18em] text-white/70">
                    Sélectionner le contenu
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={selectAll}
                      className="text-xs font-bold text-rose-400 hover:text-rose-300 transition"
                    >
                      Tout sélectionner
                    </button>
                    <span className="text-white/20">·</span>
                    <button
                      type="button"
                      onClick={deselectAll}
                      className="text-xs font-bold text-white/50 hover:text-white/80 transition"
                    >
                      Tout désélectionner
                    </button>
                  </div>
                </div>

                {/* GROUPE 1 : SETLISTS */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-black uppercase tracking-[0.14em] text-fuchsia-400 flex items-center gap-1.5">
                      <FzIcon name="setlist" usageId="sync.setlists" size="sm" />
                      Setlists ({allWorkspaceSetlists.length})
                    </label>
                    <span className="text-[0.7rem] text-white/40">
                      {selectedSetlistIds.length} sélectionnée(s)
                    </span>
                  </div>

                  {allWorkspaceSetlists.length === 0 ? (
                    <p className="text-xs text-[var(--fz-text-muted)] italic py-2">
                      Aucune setlist dans cet espace.
                    </p>
                  ) : (
                    <div className="grid gap-2 max-h-48 overflow-y-auto pr-1">
                      {allWorkspaceSetlists.map((setlist) => {
                        const isChecked = selectedSetlistIds.includes(setlist.id);
                        const count = songCountBySetlist.get(setlist.id) ?? 0;
                        return (
                          <label
                            key={setlist.id}
                            className={`flex items-center justify-between gap-3 p-3 rounded-xl border transition cursor-pointer select-none ${
                              isChecked
                                ? 'border-fuchsia-500/50 bg-fuchsia-500/10'
                                : 'border-white/8 bg-white/2 hover:bg-white/5'
                            }`}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => toggleSetlist(setlist.id)}
                                className="h-4 w-4 rounded border-white/20 bg-black/40 text-fuchsia-500 focus:ring-fuchsia-400 shrink-0"
                              />
                              <div className="min-w-0">
                                <p className="text-sm font-semibold text-white truncate">{setlist.name}</p>
                                {setlist.date ? (
                                  <p className="text-[0.68rem] text-white/45">{setlist.date}</p>
                                ) : null}
                              </div>
                            </div>
                            <span className="shrink-0 text-[0.68rem] font-bold text-fuchsia-300 bg-fuchsia-500/20 px-2 py-0.5 rounded-md">
                              {count} morceau{count > 1 ? 'x' : ''}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* GROUPE 2 : MORCEAUX INDIVIDUELS */}
                <div className="space-y-2.5 pt-2 border-t border-white/8">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-black uppercase tracking-[0.14em] text-indigo-400 flex items-center gap-1.5">
                      <FzIcon name="songs" usageId="sync.songs" size="sm" />
                      Morceaux individuels ({allWorkspaceSongs.length})
                    </label>
                    <span className="text-[0.7rem] text-white/40">
                      {allIncludedSongIds.size} inclus au total
                    </span>
                  </div>

                  <SearchField
                    value={songSearchQuery}
                    onChange={(event) => setSongSearchQuery(event.target.value)}
                    placeholder="Rechercher un morceau..."
                    aria-label="Rechercher un morceau pour le transfert"
                  />

                  {filteredSongs.length === 0 ? (
                    <p className="text-xs text-[var(--fz-text-muted)] italic py-2">
                      Aucun morceau correspondant.
                    </p>
                  ) : (
                    <div className="grid gap-1.5 max-h-56 overflow-y-auto pr-1">
                      {filteredSongs.map((song) => {
                        const isInSetlist = songsInSelectedSetlists.has(song.id);
                        const isExplicitlyChecked = selectedSongIds.includes(song.id);
                        const isChecked = isInSetlist || isExplicitlyChecked;

                        return (
                          <label
                            key={song.id}
                            className={`flex items-center justify-between gap-3 p-2.5 rounded-xl border transition cursor-pointer select-none ${
                              isChecked
                                ? 'border-indigo-500/40 bg-indigo-500/10'
                                : 'border-white/6 bg-white/2 hover:bg-white/5'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                disabled={isInSetlist}
                                onChange={() => toggleSong(song.id)}
                                className="h-4 w-4 rounded border-white/20 bg-black/40 text-indigo-500 focus:ring-indigo-400 shrink-0 disabled:opacity-50"
                              />
                              <div className="min-w-0">
                                <p className="text-xs font-semibold text-white truncate">{song.title}</p>
                                {song.artist ? (
                                  <p className="text-[0.62rem] text-white/45 truncate">{song.artist}</p>
                                ) : null}
                              </div>
                            </div>
                            {isInSetlist ? (
                              <span className="shrink-0 text-[0.62rem] font-semibold text-fuchsia-300 bg-fuchsia-500/15 px-1.5 py-0.5 rounded">
                                via setlist
                              </span>
                            ) : song.bpm || song.key ? (
                              <span className="shrink-0 text-[0.62rem] text-white/40">
                                {[song.bpm ? `${song.bpm} BPM` : null, song.key].filter(Boolean).join(' · ')}
                              </span>
                            ) : null}
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* SIZING ESTIMATION & AVERTISSEMENTS */}
                <div className="rounded-[1.2rem] border border-white/8 bg-black/30 p-3.5 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-white/60">Éléments sélectionnés :</span>
                    <span className="font-bold text-white">
                      {selectedSetlistIds.length} setlist(s) · {allIncludedSongIds.size} morceau(x)
                    </span>
                  </div>

                  {allIncludedSongIds.size > 20 ? (
                    <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/25 text-amber-200 text-xs leading-relaxed">
                      ⚠️ <strong>Volume important ({allIncludedSongIds.size} morceaux)</strong>. Le scan du QR animé peut prendre plusieurs dizaines de secondes. Pour une transmission optimale, privilégiez l'export setlist par setlist.
                    </div>
                  ) : null}
                </div>

                {error ? <p className="text-sm font-semibold text-rose-400">{error}</p> : null}

                {/* BOUTON D'ACTION PRINCIPALE */}
                <Button
                  variant="primary"
                  fullWidth
                  onClick={() => void handleGenerateTransfer()}
                  disabled={allIncludedSongIds.size === 0 && selectedSetlistIds.length === 0}
                  loading={isGenerating}
                >
                  {allIncludedSongIds.size === 0 && selectedSetlistIds.length === 0
                    ? 'Sélectionnez des éléments à transférer'
                    : `Générer le QR code (${allIncludedSongIds.size} morceau${allIncludedSongIds.size > 1 ? 'x' : ''})`}
                </Button>
              </div>
            )}

            {/* SECTION RÉCEPTION / SCANNER */}
            <div className="border-t border-white/8 pt-4 space-y-3">
              <p className="text-[0.62rem] font-black uppercase tracking-[0.2em] text-white/45">Recevoir un transfert</p>

              {getScannerStartError() ? (
                <p className="text-sm text-amber-300">{getScannerStartError()}</p>
              ) : isSecureContextAvailable ? (
                <Button
                  variant={isScannerActive ? 'secondary' : 'primary'}
                  fullWidth
                  onClick={() => setIsScannerActive((previous) => !previous)}
                >
                  {isScannerActive ? 'Fermer le scanner' : 'Démarrer la caméra / Scanner'}
                </Button>
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

            {/* REVUE AVANT CONFIRMATION DE L'IMPORT */}
            {importPreview ? (
              <div className="rounded-[1.2rem] border border-white/8 bg-white/4 px-4 py-4 space-y-3">
                <p className="text-[0.62rem] font-black uppercase tracking-[0.2em] text-white/45">Revue avant import</p>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-[1rem] border border-white/8 bg-black/20 px-3 py-3 text-sm text-white/90">
                    {`${importPreview.songsToCreate} morceaux à importer`}
                  </div>
                  <div className="rounded-[1rem] border border-white/8 bg-black/20 px-3 py-3 text-sm text-white/90">
                    {`${importPreview.setlistsToCreate} setlists à importer`}
                  </div>
                  <div className="rounded-[1rem] border border-white/8 bg-black/20 px-3 py-3 text-sm text-white/90">
                    {`${importPreview.setlistSongsToCreate} liaisons de setlist`}
                  </div>
                </div>

                {importPreview.duplicateTitles && importPreview.duplicateTitles.length > 0 ? (
                  <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 text-xs text-amber-200 leading-relaxed">
                    💡 <strong>{importPreview.duplicateTitles.length} titre(s) déjà présent(s) en local</strong> ({importPreview.duplicateTitles.slice(0, 3).join(', ')}{importPreview.duplicateTitles.length > 3 ? '...' : ''}) : ils seront importés en tant que nouvelles versions indépendantes avec de nouveaux identifiants uniques.
                  </div>
                ) : null}

                <p className="text-xs text-emerald-300 font-medium">
                  {`${importPreview.idsRegenerated} identifiants régénérés automatiquement pour garantir l'intégrité de vos données locales.`}
                </p>

                <div className="mt-4 flex flex-wrap gap-3">
                  <Button variant="primary" onClick={() => void confirmImport()}>
                    Confirmer l'import
                  </Button>
                  <Button variant="secondary" onClick={resetReceiveState}>
                    Annuler ce transfert
                  </Button>
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
