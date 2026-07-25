import { useState, useEffect } from 'react';

export interface WorkspaceColorOption {
  id: string;
  name: string;
  hex: string;
  bgClass: string;
  borderClass: string;
  textClass: string;
}

export const WORKSPACE_COLOR_OPTIONS: WorkspaceColorOption[] = [
  {
    id: 'purple',
    name: 'Violet',
    hex: '#8b5cf6',
    bgClass: 'bg-purple-600',
    borderClass: 'border-purple-400',
    textClass: 'text-purple-200',
  },
  {
    id: 'indigo',
    name: 'Indigo',
    hex: '#6366f1',
    bgClass: 'bg-indigo-600',
    borderClass: 'border-indigo-400',
    textClass: 'text-indigo-200',
  },
  {
    id: 'teal',
    name: 'Teal',
    hex: '#0d9488',
    bgClass: 'bg-teal-600',
    borderClass: 'border-teal-400',
    textClass: 'text-teal-200',
  },
  {
    id: 'emerald',
    name: 'Émeraude',
    hex: '#059669',
    bgClass: 'bg-emerald-600',
    borderClass: 'border-emerald-400',
    textClass: 'text-emerald-200',
  },
  {
    id: 'rose',
    name: 'Rose',
    hex: '#e11d48',
    bgClass: 'bg-rose-600',
    borderClass: 'border-rose-400',
    textClass: 'text-rose-200',
  },
  {
    id: 'amber',
    name: 'Ambre',
    hex: '#d97706',
    bgClass: 'bg-amber-600',
    borderClass: 'border-amber-400',
    textClass: 'text-amber-200',
  },
  {
    id: 'blue',
    name: 'Bleu',
    hex: '#2563eb',
    bgClass: 'bg-blue-600',
    borderClass: 'border-blue-400',
    textClass: 'text-blue-200',
  },
  {
    id: 'cyan',
    name: 'Cyan',
    hex: '#0891b2',
    bgClass: 'bg-cyan-600',
    borderClass: 'border-cyan-400',
    textClass: 'text-cyan-200',
  },
];

const LOCAL_STORAGE_COLORS_KEY = 'faderzero_workspace_badge_colors';

type ColorMap = Record<string, string>;

const listeners = new Set<() => void>();

function getColorMap(): ColorMap {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_COLORS_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function notifyListeners() {
  listeners.forEach((listener) => listener());
}

export function getWorkspaceColorOption(workspaceId?: string | null, workspaceType?: string): WorkspaceColorOption {
  const fallback = WORKSPACE_COLOR_OPTIONS[0]!;
  if (!workspaceId) {
    return fallback;
  }
  const colorMap = getColorMap();
  const savedColorId = colorMap[workspaceId];
  if (savedColorId) {
    const option = WORKSPACE_COLOR_OPTIONS.find((o) => o.id === savedColorId);
    if (option) return option;
  }

  // Fallback defaults based on type or ID hash
  if (workspaceType === 'personal') {
    return fallback; // Purple for personal
  }

  let hash = 0;
  for (let i = 0; i < workspaceId.length; i++) {
    hash = (hash << 5) - hash + workspaceId.charCodeAt(i);
    hash |= 0;
  }
  const index = Math.abs(hash) % WORKSPACE_COLOR_OPTIONS.length;
  return WORKSPACE_COLOR_OPTIONS[index] ?? fallback;
}

export function setWorkspaceBadgeColor(workspaceId: string, colorId: string): void {
  const colorMap = getColorMap();
  colorMap[workspaceId] = colorId;
  try {
    localStorage.setItem(LOCAL_STORAGE_COLORS_KEY, JSON.stringify(colorMap));
  } catch {}
  notifyListeners();
}

export function useWorkspaceBadgeColors(): {
  getBadgeColor: (workspaceId?: string | null, workspaceType?: string) => WorkspaceColorOption;
  setBadgeColor: (workspaceId: string, colorId: string) => void;
} {
  const [, setTick] = useState(0);

  useEffect(() => {
    const listener = () => setTick((t) => t + 1);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  return {
    getBadgeColor: getWorkspaceColorOption,
    setBadgeColor: setWorkspaceBadgeColor,
  };
}
