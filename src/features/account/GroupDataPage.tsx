import { useMemo, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/db';
import { Button } from '@/ui/components/Button';
import { FzIcon } from '@/ui/icons';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { createStorageReadUrl } from '@/services/storage';
import {
  analyzeArchiveFile,
  analyzeFolderFiles,
  createFaderZeroArchive,
  downloadArchive,
  importPreview,
  setConflictPolicy,
} from '@/services/import-export/archive';
import type { ArchiveProgress, ImportConflictPolicy, ImportPreview, ImportReport } from '@/services/import-export/types';
import type { Workspace } from '@/services/supabase/workspace';
import type { SongAssetType } from '@/db/schema';

const assetTypeLabels: Record<SongAssetType, string> = { demo: 'Démo', rehearsal: 'Répétition', mix: 'Mix', master: 'Master', live: 'Live', other: 'Autre' };

export function GroupDataPage({ workspace }: { workspace: Workspace }) {
  const isOnline = useOnlineStatus();
  const archiveInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [includeAudio, setIncludeAudio] = useState(true);
  const [progress, setProgress] = useState<ArchiveProgress | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [report, setReport] = useState<ImportReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  const songs = useLiveQuery(
    () => db.songs.where('workspaceId').equals(workspace.id).filter((song) => song.deletedAt === undefined).toArray(),
    [workspace.id],
    [],
  );
  const assets = useLiveQuery(
    () => db.songAssets.where('workspaceId').equals(workspace.id).filter((asset) => asset.deletedAt === undefined).toArray(),
    [workspace.id],
    [],
  );
  const audioBytes = useMemo(() => assets.reduce((sum, asset) => sum + asset.sizeBytes, 0), [assets]);

  async function handleExport() {
    if (!isOnline || songs.length === 0) return;
    setBusy(true);
    setError(null);
    setReport(null);
    try {
      const blob = await createFaderZeroArchive({
        workspaceId: workspace.id,
        songs,
        assets,
        includeAudio,
        onProgress: setProgress,
        readAudio: async (asset) => {
          const url = await createStorageReadUrl(workspace.id, asset.storagePath);
          const response = await fetch(url);
          if (!response.ok) throw new Error(`Impossible de télécharger ${asset.filename}.`);
          return response.blob();
        },
      });
      downloadArchive(blob);
    } catch (caught) {
      setError(messageOf(caught));
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }

  async function analyzeArchive(file: File) {
    await analyze(async () => analyzeArchiveFile(file, { existingSongs: songs, existingAssets: assets, onProgress: setProgress }));
  }

  async function analyzeFolder(files: File[]) {
    await analyze(async () => analyzeFolderFiles(files, { existingSongs: songs, existingAssets: assets, onProgress: setProgress }));
  }

  async function analyze(run: () => Promise<ImportPreview>) {
    if (!isOnline) return;
    setBusy(true);
    setError(null);
    setReport(null);
    setPreview(null);
    try {
      setPreview(await run());
    } catch (caught) {
      setError(messageOf(caught));
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }

  async function confirmImport() {
    if (!preview || !isOnline) return;
    setBusy(true);
    setError(null);
    try {
      const result = await importPreview(workspace.id, preview, setProgress);
      setReport(result);
      setPreview(null);
    } catch (caught) {
      setError(messageOf(caught));
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }

  function updateDecision(index: number, decision: ImportConflictPolicy) {
    if (!preview) return;
    setPreview({ ...preview, songs: preview.songs.map((song, songIndex) => songIndex === index ? { ...song, decision } : song) });
  }

  function updateAssetType(songIndex: number, assetIndex: number, assetType: SongAssetType) {
    if (!preview) return;
    setPreview({
      ...preview,
      songs: preview.songs.map((song, currentSongIndex) => currentSongIndex !== songIndex ? song : {
        ...song,
        assets: song.assets.map((asset, currentAssetIndex) => currentAssetIndex === assetIndex ? { ...asset, assetType } : asset),
      }),
    });
  }

  const validCount = preview?.songs.filter((song) => song.valid && song.decision !== 'ignore').length ?? 0;
  return (
    <section className="space-y-5" aria-label="Données du groupe">
      {!isOnline ? <Notice tone="warning">Connexion requise : export et import sont indisponibles hors ligne.</Notice> : null}
      {error ? <Notice tone="error">{error}</Notice> : null}
      {progress ? (
        <div className="space-y-2 rounded-2xl border border-orange-400/25 bg-orange-400/10 p-4" aria-live="polite">
          <div className="flex items-center justify-between gap-3 text-sm"><span>{progress.label}</span><strong>{progress.progress}%</strong></div>
          <div className="h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-orange-400 transition-[width]" style={{ width: `${progress.progress}%` }} /></div>
          {progress.currentSong ? <p className="text-xs text-fz-text-muted">{progress.currentSong}</p> : null}
        </div>
      ) : null}

      <div className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.035] p-4">
        <div>
          <h2 className="font-bold text-fz-text">Exporter le répertoire</h2>
          <p className="mt-1 text-sm text-fz-text-muted">{songs.length} morceau{songs.length > 1 ? 'x' : ''}, {assets.length} audio{assets.length > 1 ? 's' : ''}, {formatBytes(audioBytes)}</p>
        </div>
        {songs.length === 0 ? <Notice tone="warning">Aucun morceau à exporter.</Notice> : null}
        <label className="flex items-start gap-3 rounded-xl border border-white/10 p-3 text-sm">
          <input type="checkbox" checked={includeAudio} onChange={(event) => setIncludeAudio(event.target.checked)} className="mt-1" />
          <span><strong>Inclure les fichiers audio</strong><span className="mt-1 block text-fz-text-muted">Décochez pour une archive légère de données uniquement.</span></span>
        </label>
        {!includeAudio ? <Notice tone="warning">Cette archive ne pourra pas restaurer les fichiers audio.</Notice> : null}
        <Button fullWidth variant="primary" leadingIcon={<FzIcon name="download" usageId="account.group-data.export" />} disabled={!isOnline || busy || songs.length === 0} loading={busy} onClick={() => void handleExport()}>
          Créer l’archive
        </Button>
      </div>

      <div className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.035] p-4">
        <div><h2 className="font-bold text-fz-text">Importer ou restaurer</h2><p className="mt-1 text-sm text-fz-text-muted">L’analyse reste locale et rien n’est envoyé avant confirmation.</p></div>
        <div className="grid gap-2 sm:grid-cols-2">
          <Button variant="secondary" leadingIcon={<FzIcon name="file-archive" usageId="account.group-data.archive" />} disabled={!isOnline || busy} onClick={() => archiveInputRef.current?.click()}>Choisir une archive</Button>
          <Button variant="secondary" leadingIcon={<FzIcon name="folder" usageId="account.group-data.folder" />} disabled={!isOnline || busy} onClick={() => folderInputRef.current?.click()}>Choisir un dossier</Button>
        </div>
        <input ref={archiveInputRef} className="sr-only" type="file" accept=".zip,application/zip" onChange={(event) => { const file = event.target.files?.[0]; if (file) void analyzeArchive(file); event.currentTarget.value = ''; }} />
        <input ref={folderInputRef} className="sr-only" type="file" multiple {...({ webkitdirectory: '', directory: '' } as Record<string, string>)} onChange={(event) => { const selected = [...(event.target.files ?? [])]; if (selected.length) void analyzeFolder(selected); event.currentTarget.value = ''; }} />
      </div>

      {preview ? (
        <div className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.035] p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div><h2 className="font-bold text-fz-text">Prévisualisation</h2><p className="text-sm text-fz-text-muted">{preview.songs.length} morceaux · {formatBytes(preview.totalAudioBytes)} · {formatBytes(preview.bytesToUpload)} à envoyer</p></div>
            {preview.songs.some((song) => song.existingSongId) ? (
              <select aria-label="Appliquer à tous les conflits" className="fz-input max-w-full" defaultValue="" onChange={(event) => { if (event.target.value) setPreview(setConflictPolicy(preview, event.target.value as ImportConflictPolicy)); }}>
                <option value="">Appliquer à tous…</option><option value="update">Mettre à jour</option><option value="create">Créer une copie</option><option value="ignore">Ignorer</option>
              </select>
            ) : null}
          </div>
          {preview.issues.map((item) => <Notice key={`${item.code}-${item.message}`} tone={item.severity === 'error' ? 'error' : 'warning'}>{item.message}</Notice>)}
          <div className="max-h-[45dvh] space-y-2 overflow-y-auto pr-1">
            {preview.songs.map((song, index) => (
              <article key={`${song.folder}-${index}`} className="rounded-xl border border-white/10 p-3">
                <div className="flex items-start justify-between gap-3"><div><h3 className="font-semibold">{song.title || 'Sans titre'}</h3><p className="text-xs text-fz-text-muted">{song.assets.length} audio{song.assets.length > 1 ? 's' : ''}{song.existingSongId ? ' · conflit détecté' : ''}</p></div>{!song.valid ? <span className="text-xs font-bold text-rose-300">Erreur</span> : null}</div>
                {[...song.issues, ...song.assets.flatMap((asset) => asset.issues)].map((item, issueIndex) => <p key={`${item.code}-${issueIndex}`} className={item.severity === 'error' ? 'mt-2 text-xs text-rose-300' : 'mt-2 text-xs text-amber-300'}>{item.message}</p>)}
                {song.assets.length ? <div className="mt-3 space-y-2">{song.assets.map((asset, assetIndex) => <div key={`${asset.filename}-${assetIndex}`} className="flex items-center gap-2 rounded-lg bg-white/5 p-2"><span className="min-w-0 flex-1 truncate text-xs">{asset.filename}</span><select className="fz-input max-w-32" aria-label={`Type de ${asset.filename}`} value={asset.assetType} onChange={(event) => updateAssetType(index, assetIndex, event.target.value as SongAssetType)}>{Object.entries(assetTypeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>)}</div> : null}
                {song.existingSongId ? <select aria-label={`Décision pour ${song.title}`} className="fz-input mt-3 w-full" value={song.decision} onChange={(event) => updateDecision(index, event.target.value as ImportConflictPolicy)}><option value="update">Mettre à jour</option><option value="create">Créer un nouveau morceau</option><option value="ignore">Ignorer</option></select> : null}
              </article>
            ))}
          </div>
          <div className="grid gap-2 sm:grid-cols-2"><Button variant="ghost" disabled={busy} onClick={() => setPreview(null)}>Annuler</Button><Button variant="primary" disabled={busy || validCount === 0} loading={busy} onClick={() => void confirmImport()}>Importer {validCount} élément{validCount > 1 ? 's' : ''}</Button></div>
        </div>
      ) : null}

      {report ? (
        <div className="space-y-3 rounded-2xl border border-emerald-400/25 bg-emerald-400/10 p-4" aria-live="polite">
          <h2 className="font-bold">Rapport d’import</h2>
          <p className="text-sm">{report.created} créés · {report.updated} mis à jour · {report.ignored} ignorés</p>
          <p className="text-sm">{report.audioUploaded} audios envoyés · {report.audioReused} déjà présents · {report.errors.length} erreurs</p>
          {report.errors.map((item, index) => <p key={`${item.song}-${item.file}-${index}`} className="text-xs text-rose-200">{item.song}{item.file ? ` / ${item.file}` : ''} : {item.message}</p>)}
        </div>
      ) : null}
    </section>
  );
}

function Notice({ tone, children }: { tone: 'warning' | 'error'; children: React.ReactNode }) {
  return <p className={`rounded-xl border p-3 text-sm ${tone === 'error' ? 'border-rose-400/30 bg-rose-400/10 text-rose-200' : 'border-amber-400/30 bg-amber-400/10 text-amber-100'}`}>{children}</p>;
}

function formatBytes(bytes: number) {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} Go`;
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)} Mo`;
  return `${Math.ceil(bytes / 1024)} Ko`;
}

function messageOf(error: unknown) { return error instanceof Error ? error.message : 'Une erreur inconnue est survenue.'; }
