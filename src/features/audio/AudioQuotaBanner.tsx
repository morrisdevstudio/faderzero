import { useEffect, useState, type ReactNode } from 'react';
import type { Workspace } from '@/services/supabase/workspace';
import {
  getCachedAudioQuota,
  refreshAudioQuota,
  type AudioQuotaSnapshot,
} from '@/services/supabase/audioQuota';

interface AudioQuotaBannerProps {
  workspace: Workspace | null;
  isOnline: boolean;
  action?: ReactNode;
}

export function AudioQuotaBanner({ workspace, isOnline, action }: AudioQuotaBannerProps) {
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
    <aside aria-live="polite" className="mb-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[0.68rem] font-black uppercase tracking-[0.14em] text-white">
          Stockage audio
        </p>
        <div className="flex items-center gap-2">
          <p className={warning ? 'whitespace-nowrap text-xs font-black text-amber-300' : 'whitespace-nowrap text-xs font-bold text-white/65'}>
            {formatQuotaValue(consumedAmount)} / {formatQuotaValue(quota.limitAmount)}
          </p>
          {action}
        </div>
      </div>
      <div className="mt-3 flex items-end justify-between gap-3">
        <p className="whitespace-nowrap text-3xl font-black leading-none tracking-[-0.06em] text-white">
          {formatQuotaValue(consumedAmount)} <span className="text-sm font-bold tracking-normal text-white/55">utilisées</span>
        </p>
        <p className={warning ? 'whitespace-nowrap text-sm font-black text-amber-300' : 'whitespace-nowrap text-sm font-bold text-orange-400'}>
          {formatQuotaValue(quota.remainingAmount)} disponible{quota.remainingAmount >= 120 ? 's' : ''}
        </p>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-black/35">
        <div
          className={warning ? 'h-full rounded-full bg-amber-400' : 'h-full rounded-full bg-orange-500'}
          style={{ width: `${Math.min(100, quota.percentUsed)}%` }}
        />
      </div>
      <p className="mt-2 text-[0.68rem] font-semibold text-white/55">
        Limite : {formatQuotaValue(quota.limitAmount)}
        {!isOnline ? ' · dernière estimation hors ligne' : ''}
        {warning ? ' · pensez à libérer de l’espace' : ''}
      </p>
    </aside>
  );
}

function formatQuotaValue(value: number) {
  const minutes = Math.round(value / 60);
  return minutes >= 60 ? `${(minutes / 60).toFixed(minutes % 60 === 0 ? 0 : 1)} h` : `${minutes} min`;
}
