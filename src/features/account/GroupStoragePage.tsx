import { useEffect, useState } from 'react';
import { Button } from '@/ui/components/Button';
import type { Workspace } from '@/services/supabase/workspace';
import { transferWorkspaceStorage, type StorageTransferReport } from '@/services/storage/storageTransfer';
import {
  listWorkspaceStorageConnections,
  setDefaultStorageConnection,
  startGoogleDriveConnection,
  type WorkspaceStorageConnection,
} from '@/services/supabase/workspaceStorage';

const statusLabels: Record<WorkspaceStorageConnection['status'], string> = {
  connected: 'Connecté',
  authorization_expired: 'Autorisation expirée',
  full: 'Stockage plein',
  unavailable: 'Indisponible',
  disconnected: 'Déconnecté',
};

export function GroupStoragePage({ workspace }: { workspace: Workspace }) {
  const [connections, setConnections] = useState<WorkspaceStorageConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyConnectionId, setBusyConnectionId] = useState<string | null>(null);
  const [transferProgress, setTransferProgress] = useState<string | null>(null);
  const [transferReport, setTransferReport] = useState<StorageTransferReport | null>(null);
  const oauthResult = typeof window === 'undefined' ? null : new URLSearchParams(window.location.search).get('storage');

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    void listWorkspaceStorageConnections(workspace.id)
      .then((items) => {
        if (active) setConnections(items);
      })
      .catch(() => {
        if (active) setError('Impossible de charger la configuration du stockage.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [workspace.id]);

  const defaultConnection = connections.find((connection) => connection.isDefault && connection.status === 'connected');
  const googleDriveConnection = connections.find((connection) => connection.providerId === 'google_drive' && connection.status === 'connected');
  const isGoogleDriveDefault = defaultConnection?.providerId === 'google_drive';

  async function connectGoogleDrive() {
    setError(null);
    setBusyConnectionId('google_drive');
    try {
      window.location.assign(await startGoogleDriveConnection(workspace.id));
    } catch {
      setError('Impossible de démarrer la connexion Google Drive.');
      setBusyConnectionId(null);
    }
  }

  async function makeDefault(connection: WorkspaceStorageConnection) {
    setBusyConnectionId(connection.id);
    setError(null);
    try {
      await setDefaultStorageConnection(connection.id);
      setConnections((items) => items.map((item) => ({ ...item, isDefault: item.id === connection.id })));
    } catch {
      setError('Impossible de changer le stockage des nouveaux fichiers.');
    } finally {
      setBusyConnectionId(null);
    }
  }

  async function transferStorage() {
    setBusyConnectionId('transfer');
    setError(null);
    setTransferReport(null);
    try {
      const report = await transferWorkspaceStorage(workspace.id, (completed, total) => {
        setTransferProgress(`Transfert ${completed}/${total}`);
      });
      setTransferReport(report);
    } catch {
      setError('Le transfert n’a pas pu démarrer. Les emplacements existants restent inchangés.');
    } finally {
      setBusyConnectionId(null);
      setTransferProgress(null);
    }
  }

  return (
    <section aria-label="Stockage du groupe" className="space-y-5">
      <p className="text-sm text-white/65">
        Choisis où les nouveaux fichiers de {workspace.name} sont stockés. Les fichiers existants restent accessibles depuis leur connexion actuelle.
      </p>
      {loading ? <p role="status" className="text-sm text-white/55">Chargement du stockage…</p> : null}
      {error ? <p role="alert" className="rounded-xl border border-rose-500/25 bg-rose-500/10 p-3 text-sm text-rose-200">{error}</p> : null}
      {oauthResult === 'connected' ? <p role="status" className="rounded-xl border border-emerald-400/25 bg-emerald-400/10 p-3 text-sm text-emerald-100">Google Drive est connecté. Les nouveaux fichiers y seront envoyés.</p> : null}
      {oauthResult && oauthResult !== 'connected' ? <p role="alert" className="rounded-xl border border-amber-400/25 bg-amber-400/10 p-3 text-sm text-amber-100">La connexion Google Drive n’a pas abouti. Tu peux la relancer.</p> : null}
      {!loading && !error && !defaultConnection ? (
        <div className="rounded-xl border border-amber-400/25 bg-amber-400/10 p-4">
          <p className="font-bold text-amber-200">Aucun stockage configuré</p>
          <p className="mt-1 text-sm text-amber-100/80">Les données du groupe continuent à se synchroniser. Un administrateur doit configurer Google Drive avant le premier envoi de fichier.</p>
        </div>
      ) : null}
      {connections.map((connection) => (
        <article key={connection.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="font-bold text-white">{connection.displayName ?? providerLabel(connection.providerId)}</h2>
              <p className="mt-1 text-sm text-white/55">{connectionSummary(connection)}</p>
              {connection.quotaUsedBytes !== null && connection.quotaLimitBytes !== null ? <p className="mt-1 text-xs text-white/45">{formatBytes(connection.quotaUsedBytes)} utilisés sur {formatBytes(connection.quotaLimitBytes)}</p> : null}
            </div>
            <span className={connectionBadgeClass(connection)}>{connectionBadgeLabel(connection)}</span>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {!connection.isDefault && connection.status === 'connected' ? <Button variant="secondary" disabled={busyConnectionId !== null} onClick={() => void makeDefault(connection)}>Utiliser pour les nouveaux fichiers</Button> : null}
            {connection.providerId === 'google_drive' && connection.rootIdentifier ? <a className="inline-flex min-h-11 items-center rounded-xl border border-white/15 px-4 text-sm font-bold text-white" href={`https://drive.google.com/drive/folders/${encodeURIComponent(connection.rootIdentifier)}`} target="_blank" rel="noreferrer">Ouvrir dans Google Drive</a> : null}
          </div>
        </article>
      ))}
      <article className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-bold text-white">Google Drive</h2>
            <p className="mt-1 text-sm text-white/55">Faderzero crée un dossier privé pour ce groupe. Aucun fichier n’est rendu public dans Drive.</p>
          </div>
          {isGoogleDriveDefault ? <span className="rounded-full bg-emerald-400/10 px-2 py-1 text-xs font-bold text-emerald-200">Nouveaux fichiers</span> : null}
        </div>
        <Button className="mt-4" disabled={busyConnectionId !== null} onClick={() => void connectGoogleDrive()}>{googleDriveConnection ? 'Reconnecter Google Drive' : 'Connecter Google Drive'}</Button>
      </article>
      {connections.filter((item) => item.status === 'connected').length > 1 ? (
        <article className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
          <h2 className="font-bold text-white">Transférer le stockage</h2>
          <p className="mt-1 text-sm text-white/55">Copie vers la connexion active les fichiers qui résident encore ailleurs. L’ancien emplacement reste principal si une copie échoue.</p>
          {transferProgress ? <p className="mt-3 text-sm text-orange-200" role="status">{transferProgress}</p> : null}
          {transferReport ? <TransferReport report={transferReport} /> : null}
          <Button className="mt-4" variant="secondary" disabled={busyConnectionId !== null} onClick={() => void transferStorage()}>Transférer les fichiers restants</Button>
        </article>
      ) : null}
      <article className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
        <h2 className="font-bold text-white">Faderzero Cloud</h2>
        <p className="mt-1 text-sm text-white/55">À venir pour les nouveaux groupes.</p>
      </article>
    </section>
  );
}

function connectionSummary(connection: WorkspaceStorageConnection): string {
  if (connection.status !== 'connected') return statusLabels[connection.status];
  return connection.isDefault ? 'Connecté · nouveaux envois' : 'Fichiers existants accessibles';
}

function connectionBadgeLabel(connection: WorkspaceStorageConnection): string {
  if (connection.status !== 'connected') return statusLabels[connection.status];
  return connection.isDefault ? 'Nouveaux fichiers' : 'Fichiers existants';
}

function connectionBadgeClass(connection: WorkspaceStorageConnection): string {
  if (connection.status === 'connected' && connection.isDefault) {
    return 'rounded-full bg-emerald-400/10 px-2 py-1 text-xs font-bold text-emerald-200';
  }
  if (connection.status === 'connected') {
    return 'rounded-full bg-white/10 px-2 py-1 text-xs font-bold text-white/65';
  }
  return 'rounded-full bg-rose-400/10 px-2 py-1 text-xs font-bold text-rose-200';
}

function TransferReport({ report }: { report: StorageTransferReport }) {
  if (report.failed.length === 0) {
    return <p className="mt-3 text-sm text-emerald-200" role="status">{report.copied} fichier(s) transféré(s).</p>;
  }
  if (report.copied === 0) {
    return <p className="mt-3 text-sm text-rose-200" role="alert">Aucun fichier n’a pu être transféré, {report.failed.length} échec(s). Tu peux réessayer.</p>;
  }
  return <p className="mt-3 text-sm text-amber-200" role="alert">{report.copied} fichier(s) transféré(s), {report.failed.length} échec(s). Tu peux relancer les échecs.</p>;
}

function formatBytes(value: number): string {
  if (value < 1024) return `${value} o`;
  const units = ['Ko', 'Mo', 'Go', 'To'];
  let amount = value / 1024;
  let unit = units[0]!;
  for (let index = 1; index < units.length && amount >= 1024; index += 1) {
    amount /= 1024;
    unit = units[index]!;
  }
  return `${amount.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} ${unit}`;
}

function providerLabel(providerId: WorkspaceStorageConnection['providerId']): string {
  if (providerId === 'faderzero_r2') return 'Faderzero Cloud';
  if (providerId === 'google_drive') return 'Google Drive';
  if (providerId === 'dropbox') return 'Dropbox';
  if (providerId === 'onedrive') return 'OneDrive';
  return 'WebDAV';
}
