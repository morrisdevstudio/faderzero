import { supabase } from '@/services/supabase/client';

export interface AudioQuotaSnapshot {
  unit: 'seconds' | 'bytes';
  usedAmount: number;
  reservedAmount: number;
  limitAmount: number;
  remainingAmount: number;
  percentUsed: number;
}

const CACHE_PREFIX = 'faderzero_audio_quota';

export async function refreshAudioQuota(workspaceId: string): Promise<AudioQuotaSnapshot> {
  const { data, error } = await supabase.rpc('get_audio_quota', {
    p_workspace_id: workspaceId,
  });
  if (error) throw error;

  const snapshot = parseAudioQuota(data);
  if (!snapshot) {
    throw new Error('Réponse de quota audio invalide.');
  }

  try {
    localStorage.setItem(getCacheKey(workspaceId), JSON.stringify(snapshot));
  } catch {
    // Storage can be unavailable in private browsing; the live value still works.
  }
  return snapshot;
}

export function getCachedAudioQuota(workspaceId: string): AudioQuotaSnapshot | null {
  try {
    return parseAudioQuota(JSON.parse(localStorage.getItem(getCacheKey(workspaceId)) ?? 'null'));
  } catch {
    return null;
  }
}

function getCacheKey(workspaceId: string) {
  return `${CACHE_PREFIX}:${workspaceId}`;
}

function parseAudioQuota(value: unknown): AudioQuotaSnapshot | null {
  if (!isRecord(value) || (value.unit !== 'seconds' && value.unit !== 'bytes')) return null;

  const usedAmount = toNonNegativeNumber(value.usedAmount);
  const reservedAmount = toNonNegativeNumber(value.reservedAmount);
  const limitAmount = toNonNegativeNumber(value.limitAmount);
  const remainingAmount = toNonNegativeNumber(value.remainingAmount);
  const percentUsed = toNonNegativeNumber(value.percentUsed);
  if (
    usedAmount === null ||
    reservedAmount === null ||
    limitAmount === null ||
    remainingAmount === null ||
    percentUsed === null ||
    limitAmount === 0
  ) return null;

  return { unit: value.unit, usedAmount, reservedAmount, limitAmount, remainingAmount, percentUsed };
}

function toNonNegativeNumber(value: unknown): number | null {
  const numberValue = typeof value === 'string' || typeof value === 'number' ? Number(value) : Number.NaN;
  return Number.isFinite(numberValue) && numberValue >= 0 ? numberValue : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
