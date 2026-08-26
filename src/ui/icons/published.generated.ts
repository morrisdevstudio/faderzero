import {
  ArrowLeft, CalendarDays, CalendarPlus, Check, CloudDownload, Copy, Ellipsis, Eye, EyeOff, ExternalLink, FileDown, Filter,
  House, Library, ListMusic, Maximize, Metronome, Mic, Monitor, Pause, Pencil, Play,
  Mail, Phone, Plus, Settings, Square, Trash2, Upload, X,
  createLucideIcon, type LucideIcon,
} from 'lucide-react';
const PhonePlus = createLucideIcon('PhonePlus', [
  ['path', { d: 'M13.8 18.4a1 1 0 0 1-1.1.2 17.5 17.5 0 0 1-7.3-7.3 1 1 0 0 1 .2-1.1l2-2a1 1 0 0 0 .2-1l-1-3.1a1 1 0 0 0-1-.7H3.1A1.1 1.1 0 0 0 2 4.5 17.5 17.5 0 0 0 19.5 22a1.1 1.1 0 0 0 1.1-1.1v-2.7a1 1 0 0 0-.7-1l-3.1-1a1 1 0 0 0-1 .2z', key: 'phone' }],
  ['path', { d: 'M19 2v6', key: 'plus-v' }],
  ['path', { d: 'M16 5h6', key: 'plus-h' }],
]);
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
  metronome: Metronome,
  pause: Pause,
  play: Play,
  prompter: Monitor,
  record: Mic,
  setlist: ListMusic,
  settings: Settings,
  songs: Library,
  stop: Square,
  upload: Upload,
  'show-password': Eye,
  'hide-password': EyeOff,
  'export-pdf': FileDown,
  phone: Phone,
  'phone-add': PhonePlus,
  'calendar-add': CalendarPlus,
  filter: Filter,
  email: Mail,
  'external-link': ExternalLink,
  copy: Copy,
};

export const publishedIconUsageOverrides: Record<string, LucideIcon> = {};
