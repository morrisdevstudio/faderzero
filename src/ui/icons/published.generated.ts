import {
  ArrowLeft, AudioWaveform, CalendarDays, Check, CloudDownload, Ellipsis, Eye, EyeOff, FileDown,
  House, Library, ListMusic, Maximize, Mic, MonitorUp, Pause, Pencil, Play,
  Plus, Settings, Square, Trash2, Upload, X,
  type LucideIcon,
} from 'lucide-react';
// Fallback registry committed for local/offline builds. The Cloudflare preparation
// step may regenerate this module from the last approved publication.
export const publishedIconComponents: Record<string, LucideIcon> = {
  add: Plus,
  back: ArrowLeft,
  calendar: CalendarDays,
  check: Check,
  close: X,
  delete: Trash2,
  download: CloudDownload,
  edit: Pencil,
  fullscreen: Maximize,
  home: House,
  menu: Ellipsis,
  metronome: AudioWaveform,
  pause: Pause,
  play: Play,
  prompter: MonitorUp,
  record: Mic,
  setlist: ListMusic,
  settings: Settings,
  songs: Library,
  stop: Square,
  upload: Upload,
  'show-password': Eye,
  'hide-password': EyeOff,
  'export-pdf': FileDown,
};

export const publishedIconUsageOverrides: Record<string, LucideIcon> = {};
