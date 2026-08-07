import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Check, ChevronLeft, ChevronRight, CircleHelp, CloudUpload, icons, Search, SlidersHorizontal, X, type LucideIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { useAuthStore } from '@/stores/authStore';
import {
  isPlatformAdmin,
  loadIconCatalog,
  requestIconPublication,
  saveIconDecision,
  type IconCatalog,
  type IconOccurrence,
} from './iconCatalogService';

type View = 'all' | 'unassigned' | 'roles' | 'exceptions';

function kebabIconName(value: string) {
  return value.replace(/([a-z0-9])([A-Z])/g, '$1-$2').replace(/([A-Z])([A-Z][a-z])/g, '$1-$2').replace(/([A-Za-z])(\d)/g, '$1-$2').toLowerCase();
}

const lucideCandidates = Object.entries(icons).map(([componentName, component]) => ({ name: kebabIconName(componentName), component }));
const lucideByName = new Map<string, LucideIcon>(lucideCandidates.map(({ name, component }) => [name, component]));

function CandidateIcon({ name, ...props }: { name: string; size?: number; strokeWidth?: number }) {
  const Icon = lucideByName.get(name) ?? CircleHelp;
  return <Icon {...props} />;
}

export function legacySvgUrl(source: string) {
  if (!source.trim().startsWith('<svg')) return null;
  const svg = source
    .replace(/^\s*<svg/, '<svg xmlns="http://www.w3.org/2000/svg"')
    .replace(/\{\.\.\.props\}/g, '')
    .replace(/strokeWidth=/g, 'stroke-width=')
    .replace(/strokeLinecap=/g, 'stroke-linecap=')
    .replace(/strokeLinejoin=/g, 'stroke-linejoin=')
    .replace(/className=/g, 'class=')
    .replace(/currentColor/g, '#f4f4f5');
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function LegacyPreview({ occurrence }: { occurrence: IconOccurrence }) {
  const source = legacySvgUrl(occurrence.source);
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [source]);
  if (source && !failed) return <img src={source} alt="" className="h-8 w-8 object-contain" onError={() => setFailed(true)} />;
  return <span className="text-xl font-black text-white/70">{occurrence.name.slice(0, 1).toUpperCase()}</span>;
}

function iconFor(occurrence: IconOccurrence, catalog: IconCatalog) {
  if (occurrence.overrideIconName) return occurrence.overrideIconName;
  return catalog.roles.find(({ key }) => key === occurrence.assignedRoleKey)?.iconName ?? null;
}

function AdminNotFound() {
  return (
    <main className="grid min-h-dvh place-items-center bg-[#090909] px-6 text-center text-white">
      <div><p className="text-6xl font-black text-white/15">404</p><p className="mt-3 text-sm text-white/55">Cette page n’existe pas.</p></div>
    </main>
  );
}

function IconEditor({ occurrence, catalog, online, onClose, onSaved, onMove }: {
  occurrence: IconOccurrence;
  catalog: IconCatalog;
  online: boolean;
  onClose: () => void;
  onSaved: () => Promise<void>;
  onMove: (direction: -1 | 1) => void;
}) {
  const userId = useAuthStore((state) => state.session?.user.id);
  const initialRole = occurrence.assignedRoleKey ?? '';
  const initialIcon = iconFor(occurrence, catalog) ?? 'circle-help';
  const [roleKey, setRoleKey] = useState(initialRole);
  const [candidate, setCandidate] = useState(initialIcon);
  const [exception, setException] = useState(Boolean(occurrence.overrideIconName));
  const [query, setQuery] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const candidates = useMemo(() => lucideCandidates.filter(({ name }) => name.includes(query.trim().toLowerCase())).slice(0, 120), [query]);

  useEffect(() => {
    setRoleKey(initialRole);
    setCandidate(initialIcon);
    setException(Boolean(occurrence.overrideIconName));
    setQuery('');
  }, [occurrence.usageId, initialIcon, initialRole, occurrence.overrideIconName]);

  async function save() {
    if (!userId || !online || !roleKey) return;
    setSaving(true); setError(null);
    try {
      await saveIconDecision({ occurrence, roleKey, iconName: candidate, exception, userId });
      await onSaved();
      onClose();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Enregistrement impossible.');
    } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/70 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={`Modifier ${occurrence.name}`}>
      <section className="flex h-dvh w-full flex-col border-l border-white/10 bg-[#101010] text-white md:max-w-xl">
        <header className="flex items-center gap-3 border-b border-white/10 px-4 py-3">
          <button onClick={onClose} className="grid min-h-11 min-w-11 place-items-center rounded-xl bg-white/5" aria-label="Fermer"><X size={20} /></button>
          <div className="min-w-0 flex-1"><p className="truncate font-bold">{occurrence.name}</p><p className="truncate text-xs text-white/45">{occurrence.pageName || occurrence.route || 'Emplacement inconnu'}</p></div>
          <button onClick={() => onMove(-1)} className="grid min-h-11 min-w-11 place-items-center rounded-xl bg-white/5" aria-label="Précédente"><ChevronLeft size={20} /></button>
          <button onClick={() => onMove(1)} className="grid min-h-11 min-w-11 place-items-center rounded-xl bg-white/5" aria-label="Suivante"><ChevronRight size={20} /></button>
        </header>

        <div className="flex-1 space-y-6 overflow-y-auto px-4 py-5 pb-28 sm:px-6">
          <div className="grid grid-cols-2 gap-3">
            <div className="grid min-h-32 place-items-center rounded-3xl border border-white/10 bg-white/[0.03]"><div className="text-center"><div className="mx-auto grid h-14 w-14 place-items-center"><LegacyPreview occurrence={occurrence} /></div><p className="mt-2 text-[0.65rem] font-bold uppercase tracking-[0.16em] text-white/35">Actuelle</p></div></div>
            <div className="grid min-h-32 place-items-center rounded-3xl border border-amber-300/25 bg-amber-300/[0.06]"><div className="text-center"><CandidateIcon name={candidate} size={38} strokeWidth={1.8} /><p className="mt-2 text-[0.65rem] font-bold uppercase tracking-[0.16em] text-amber-200/70">Candidate</p></div></div>
          </div>

          <label className="block"><span className="mb-2 block text-xs font-bold uppercase tracking-[0.14em] text-white/45">Rôle sémantique</span><select value={roleKey} onChange={(event) => { const next = event.target.value; setRoleKey(next); const role = catalog.roles.find(({ key }) => key === next); if (role && !exception) setCandidate(role.iconName); }} className="min-h-12 w-full rounded-2xl border border-white/10 bg-[#1a1a1a] px-4 text-sm outline-none focus:border-amber-300/60"><option value="">Choisir un rôle</option>{catalog.roles.map((role) => <option key={role.key} value={role.key}>{role.label} · {role.iconName}</option>)}</select></label>

          <label className="flex min-h-14 items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4"><input type="checkbox" checked={exception} onChange={(event) => setException(event.target.checked)} className="h-5 w-5 accent-amber-300" /><span className="flex-1"><span className="block text-sm font-bold">Exception locale</span><span className="block text-xs text-white/45">Cette occurrence peut différer du rôle partagé.</span></span></label>

          <div><label className="relative block"><Search size={17} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-white/35" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Rechercher dans Lucide…" className="min-h-12 w-full rounded-2xl border border-white/10 bg-white/[0.04] pl-11 pr-4 text-sm outline-none focus:border-amber-300/60" /></label><div className="mt-3 grid max-h-72 grid-cols-5 gap-2 overflow-y-auto pr-1 sm:grid-cols-7">{candidates.map(({ name, component: Icon }) => <button key={name} onClick={() => setCandidate(name)} title={name} className={`grid aspect-square min-h-11 place-items-center rounded-xl border transition ${candidate === name ? 'border-amber-300 bg-amber-300/15 text-amber-200' : 'border-white/8 bg-white/[0.03] text-white/65 hover:bg-white/10'}`}><Icon size={21} /></button>)}</div></div>

          <details className="rounded-2xl border border-white/10 px-4 py-3 text-xs text-white/50"><summary className="cursor-pointer font-bold text-white/65">Détails techniques</summary><dl className="mt-3 space-y-2 break-all"><div><dt>Usage</dt><dd className="text-white/75">{occurrence.usageId}</dd></div><div><dt>Fichier</dt><dd className="text-white/75">{occurrence.file}:{occurrence.line}</dd></div><div><dt>Format</dt><dd className="text-white/75">{occurrence.format}</dd></div></dl></details>
          {error && <p className="rounded-xl bg-rose-500/10 p-3 text-sm text-rose-200">{error}</p>}
        </div>

        <footer className="absolute inset-x-0 bottom-0 flex gap-3 border-t border-white/10 bg-[#101010]/95 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur md:left-auto md:w-full md:max-w-xl">
          <button onClick={onClose} className="min-h-12 flex-1 rounded-2xl border border-white/10 text-sm font-bold">Annuler</button>
          <button onClick={() => void save()} disabled={!online || !roleKey || saving} className="flex min-h-12 flex-[1.5] items-center justify-center gap-2 rounded-2xl bg-amber-300 px-4 text-sm font-black text-black disabled:opacity-40"><Check size={18} />{saving ? 'Enregistrement…' : 'Enregistrer'}</button>
        </footer>
      </section>
    </div>
  );
}

export function IconDesignSystemPage() {
  const navigate = useNavigate();
  const userId = useAuthStore((state) => state.session?.user.id);
  const online = useOnlineStatus();
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [catalog, setCatalog] = useState<IconCatalog | null>(null);
  const [query, setQuery] = useState('');
  const [view, setView] = useState<View>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  async function reload() { setCatalog(await loadIconCatalog()); }
  useEffect(() => { if (!userId) { setAuthorized(false); return; } void isPlatformAdmin(userId).then((allowed) => { setAuthorized(allowed); if (allowed) void reload(); }); }, [userId]);

  const filtered = useMemo(() => {
    if (!catalog) return [];
    const term = query.trim().toLowerCase();
    return catalog.occurrences.filter((item) => {
      if (view === 'unassigned' && item.assignedRoleKey) return false;
      if (view === 'roles' && !item.assignedRoleKey) return false;
      if (view === 'exceptions' && !item.overrideIconName) return false;
      return !term || [item.name, item.route, item.pageName, item.assignedRoleKey, item.overrideIconName].some((value) => value?.toLowerCase().includes(term));
    });
  }, [catalog, query, view]);
  const selectedIndex = filtered.findIndex(({ usageId }) => usageId === selectedId);
  const selected = selectedIndex >= 0 ? filtered[selectedIndex] : null;

  async function publish() {
    setPublishing(true); setNotice(null);
    try { await requestIconPublication(); setNotice('Publication lancée. Cloudflare prépare la nouvelle version.'); await reload(); }
    catch (reason) { setNotice(reason instanceof Error ? reason.message : 'Publication impossible.'); }
    finally { setPublishing(false); }
  }

  if (authorized === false) return <AdminNotFound />;
  if (authorized === null || !catalog) return <main className="grid min-h-dvh place-items-center bg-[#090909] text-xs font-bold uppercase tracking-[0.18em] text-white/35">Chargement du catalogue…</main>;

  return (
    <main className="min-h-dvh bg-[#090909] pb-20 text-white">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-[#090909]/90 px-4 py-3 backdrop-blur-xl sm:px-6">
        <div className="mx-auto flex max-w-7xl items-center gap-3"><button onClick={() => navigate('/home')} className="grid min-h-11 min-w-11 place-items-center rounded-xl border border-white/10 bg-white/[0.04]" aria-label="Retour"><ArrowLeft size={20} /></button><div className="min-w-0 flex-1"><h1 className="truncate text-base font-black sm:text-lg">Système d’icônes</h1><p className="text-xs text-white/40">{catalog.occurrences.length} usages · {catalog.roles.length} rôles</p></div><button onClick={() => void publish()} disabled={!online || publishing} className="flex min-h-11 items-center gap-2 rounded-xl bg-amber-300 px-3 text-xs font-black text-black disabled:opacity-40"><CloudUpload size={17} /><span className="hidden sm:inline">{publishing ? 'Publication…' : 'Publier'}</span></button></div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6">
        {!online && <div className="mb-4 rounded-2xl border border-amber-300/20 bg-amber-300/[0.07] px-4 py-3 text-sm text-amber-100">Mode hors ligne : consultation du dernier catalogue, modifications désactivées.</div>}
        {notice && <button onClick={() => setNotice(null)} className="mb-4 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-left text-sm text-white/75">{notice}</button>}
        <div className="sticky top-[69px] z-20 -mx-4 space-y-3 bg-[#090909]/95 px-4 py-3 backdrop-blur-xl sm:-mx-6 sm:px-6">
          <label className="relative block"><Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/35" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Nom, page, rôle…" className="min-h-12 w-full rounded-2xl border border-white/10 bg-[#151515] pl-11 pr-4 text-sm outline-none focus:border-amber-300/60" /></label>
          <div className="flex gap-2 overflow-x-auto pb-1">{([['all', 'Tous'], ['unassigned', 'À classer'], ['roles', 'Rôles'], ['exceptions', 'Exceptions']] as const).map(([key, label]) => <button key={key} onClick={() => setView(key)} className={`min-h-10 shrink-0 rounded-xl px-4 text-xs font-bold ${view === key ? 'bg-white text-black' : 'border border-white/10 bg-white/[0.03] text-white/55'}`}>{key === 'all' && <SlidersHorizontal size={14} className="mr-2 inline" />}{label}</button>)}</div>
        </div>

        <section className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6">{filtered.map((occurrence) => { const iconName = iconFor(occurrence, catalog); return <button key={occurrence.usageId} onClick={() => setSelectedId(occurrence.usageId)} className="group min-h-44 rounded-3xl border border-white/10 bg-[#121212] p-3 text-left transition hover:-translate-y-0.5 hover:border-white/25 hover:bg-[#171717]"><div className="grid h-20 place-items-center rounded-2xl bg-white/[0.035]">{iconName ? <CandidateIcon name={iconName} size={31} strokeWidth={1.8} /> : <LegacyPreview occurrence={occurrence} />}</div><p className="mt-3 truncate text-sm font-bold">{occurrence.name}</p><p className="mt-1 truncate text-[0.68rem] text-white/38">{occurrence.pageName || occurrence.route || 'Sans page'}</p><div className="mt-3 flex items-center gap-1.5"><span className={`h-1.5 w-1.5 rounded-full ${occurrence.overrideIconName ? 'bg-violet-300' : occurrence.assignedRoleKey ? 'bg-emerald-300' : 'bg-amber-300'}`} /><span className="truncate text-[0.62rem] font-bold uppercase tracking-[0.1em] text-white/35">{occurrence.overrideIconName ? 'Exception' : occurrence.assignedRoleKey ?? 'À classer'}</span></div></button>; })}</section>
        {!filtered.length && <div className="py-24 text-center text-sm text-white/35">Aucune icône ne correspond à cette vue.</div>}
      </div>

      {selected && <IconEditor occurrence={selected} catalog={catalog} online={online} onClose={() => setSelectedId(null)} onSaved={reload} onMove={(direction) => { const next = (selectedIndex + direction + filtered.length) % filtered.length; setSelectedId(filtered[next]?.usageId ?? null); }} />}
    </main>
  );
}
