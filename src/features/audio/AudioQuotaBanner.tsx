import { useEffect, useState } from 'react';
import type { Workspace } from '@/services/supabase/workspace';
import {
  getCachedAudioQuota,
  refreshAudioQuota,
  type AudioQuotaSnapshot,
} from '@/services/supabase/audioQuota';

interface AudioQuotaBannerProps {
  workspace: Workspace | null;
  isOnline: boolean;
}

export function AudioQuotaBanner({ workspace, isOnline }: AudioQuotaBannerProps) {
  const [quota, setQuota] = useState<AudioQuotaSnapshot | null>(null);
  const workspaceId = workspace?.id;
  const workspaceRole = workspace?.role;

  useEffect(() => {
    if (!workspaceId || workspaceRole === 'guest') {
      setQuota(null);
      return;
    }

    let active = true;
    setQuota(getCachedAudioQuota(workspaceId));
    if (isOnline) {
      void refreshAudioQuota(workspaceId)
        .then((snapshot) => {
          if (active) setQuota(snapshot);
        })
        .catch(() => undefined);
    }

    return () => {
      active = false;
    };
  }, [workspaceId, workspaceRole, isOnline]);

  if (!workspace || workspace.role === 'guest' || !quota) return null;

  const consumedAmount = quota.usedAmount + quota.reservedAmount;
  const warning = quota.percentUsed >= 80;
  return (
    <aside
      aria-live="polite"
      className={[
        'mb-3 rounded-[1.1rem] border px-4 py-3',
        warning ? 'border-amber-400/30 bg-amber-400/10' : 'border-white/8 bg-white/4',
      ].join(' ')}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-[0.68rem] font-black uppercase tracking-[0.14em] text-white">
          Stockage audio
        </p>
        <p className={warning ? 'text-xs font-black text-amber-300' : 'text-xs font-bold text-white/65'}>
          {formatQuotaValue(consumedAmount, quota.unit)} / {formatQuotaValue(quota.limitAmount, quota.unit)}
        </p>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-black/35">
        <div
          className={warning ? 'h-full rounded-full bg-amber-400' : 'h-full rounded-full bg-orange-500'}
          style={{ width: `${Math.min(100, quota.percentUsed)}%` }}
        />
      </div>
      <p className="mt-2 text-[0.68rem] font-semibold text-white/55">
        {formatQuotaValue(quota.remainingAmount, quota.unit)} restant
        {!isOnline ? ' · dernière estimation hors ligne' : ''}
        {warning ? ' · pensez à libérer de l’espace' : ''}
      </p>
    </aside>
  );
}

function formatQuotaValue(value: number, unit: AudioQuotaSnapshot['unit']) {
  if (unit === 'seconds') {
    const minutes = Math.round(value / 60);
    return minutes >= 60 ? `${(minutes / 60).toFixed(minutes % 60 === 0 ? 0 : 1)} h` : `${minutes} min`;
  }
  if (value >= 1024 ** 3) return `${(value / 1024 ** 3).toFixed(1)} Gio`;
  return `${Math.round(value / 1024 ** 2)} Mio`;
}
