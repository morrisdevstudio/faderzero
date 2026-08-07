import { useCallback, useEffect, useMemo, useState } from 'react';
import * as Lucide from 'lucide-react';
import { loadInventory, type LoadedInventory } from './api/inventoryClient';
import { CurrentIconPreview } from './components/CurrentIconPreview';
import { useIconCatalogEdits, type CatalogOccurrence, type EditableKey } from './hooks/useIconCatalogEdits';
import { useIconCatalogSave } from './hooks/useIconCatalogSave';
import './edits.css';

type Icon = CatalogOccurrence & Record<string, unknown>;
const statuses = ['discovered', 'review', 'proposed', 'approved', 'rejected', 'migrated', 'verified', 'custom-kept'];
const lucideNames = Object.keys(Lucide).filter((name) => /^[A-Z]/.test(name) && typeof (Lucide as Record<string, unknown>)[name] === 'object').sort();

function FieldError({ message }: { message?: string }) { return message ? <small className="field-error" role="alert">{message}</small> : null; }
function LucidePicker({ value, onChange, error }: { value?: string; onChange: (value: string) => void; error?: string }) {
  const [query, setQuery] = useState(value ?? '');
  const names = lucideNames.filter((name) => name.toLowerCase().includes(query.toLowerCase())).slice(0, 30);
  const Selected = value ? (Lucide as Record<string, React.ComponentType<{ size?: number }>>)[value] : undefined;
  return <label className="picker"><strong>Proposition Lucide</strong><input aria-label="Rechercher une icône Lucide" value={query} placeholder="Rechercher Lucide" onChange={(event) => setQuery(event.target.value)} />{Selected ? <div className="sizes">{[16, 20, 24, 28].map((size) => <Selected key={size} size={size} />)}</div> : <small>Aucune proposition Lucide</small>}<select aria-label="Nom Lucide proposé" value={value ?? ''} onChange={(event) => onChange(event.target.value)}><option value="">Choisir une icône</option>{names.map((name) => <option key={name}>{name}</option>)}</select><FieldError message={error} /></label>;
}

export function CatalogApp({ loader = loadInventory }: { loader?: () => Promise<LoadedInventory> }) {
  const [inventory, setInventory] = useState<{ icons: Icon[] }>({ icons: [] });
  const [revision, setRevision] = useState('');
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState({ route: '', format: '', status: '', duplicateGroup: '', dirty: false });
  const [view, setView] = useState('all'); const [error, setError] = useState('');
  const edits = useIconCatalogEdits(inventory.icons);
  const updateServerOccurrence = useCallback((id: string, occurrence: CatalogOccurrence) => setInventory((current) => ({ icons: current.icons.map((icon) => icon.occurrenceId === id ? { ...icon, ...occurrence } : icon) })), []);
  const saver = useIconCatalogSave({ revision, setRevision, getDraft: edits.getDraft, getDirtyFields: edits.getDirtyFields, commitOccurrence: edits.commitOccurrence, replaceServerValues: edits.replaceServerValues, updateServerOccurrence, load: loader, replaceInventory: (next) => setInventory(next as { icons: Icon[] }), dirtyOccurrenceIds: edits.dirtyOccurrenceIds });
  const loadInitial = useCallback(async () => { try { const loaded = await loader(); setInventory(loaded.inventory as { icons: Icon[] }); setRevision(loaded.revision); setError(''); } catch { setError('Impossible de recharger le catalogue.'); } }, [loader]);
  useEffect(() => { void loadInitial(); }, [loadInitial]);
  const reload = useCallback(async () => {
    if (edits.hasUnsavedChanges && !window.confirm(`Recharger et abandonner ${edits.dirtyCount} ligne(s) modifiée(s) ?`)) return;
    edits.resetAll(); saver.clearStates(); await loadInitial();
  }, [edits, loadInitial, saver]);
  useEffect(() => { if (!edits.hasUnsavedChanges) return; const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; }; window.addEventListener('beforeunload', warn); return () => window.removeEventListener('beforeunload', warn); }, [edits.hasUnsavedChanges]);
  const items = useMemo(() => inventory.icons.filter((icon) => {
    const draft = edits.getDraft(icon.occurrenceId); const haystack = JSON.stringify({ ...icon, proposal: { ...icon.proposal, lucideIcon: draft.lucideIcon, faderzeroName: draft.faderzeroName, reason: draft.reason }, decision: { ...icon.decision, status: draft.status, notes: draft.notes } }).toLowerCase();
    if (query && !haystack.includes(query.toLowerCase())) return false;
    if (filters.route && !String(icon.route ?? '').includes(filters.route)) return false;
    if (filters.format && !String(icon.format ?? '').includes(filters.format)) return false;
    if (filters.status && draft.status !== filters.status) return false;
    if (filters.duplicateGroup && !String(icon.fingerprint ?? '').includes(filters.duplicateGroup)) return false;
    if (filters.dirty && !edits.isOccurrenceDirty(icon.occurrenceId)) return false;
    if (view === 'duplicates' && inventory.icons.filter((other) => other.fingerprint && other.fingerprint === icon.fingerprint).length < 2) return false;
    return !(view === 'conflicts' && !icon.semanticConflict);
  }), [inventory.icons, query, filters, view, edits]);
  const unique = new Set(inventory.icons.map((icon) => icon.fingerprint).filter(Boolean)).size;
  const cancelAll = () => { if (saver.isBulkSaving || (edits.dirtyCount > 1 && !window.confirm(`Annuler les modifications de ${edits.dirtyCount} lignes ?`))) return; edits.resetAll(); saver.clearStates(); };
  const bulkLabel = saver.bulkSaveState.status === 'saving' ? `Enregistrement ${saver.bulkSaveState.completed + 1} sur ${saver.bulkSaveState.total}…` : `Enregistrer les ${edits.dirtyCount} lignes modifiées`;
  return <main><header><div><p>FaderZero · outil local</p><h1>Catalogue des icônes</h1><span>{inventory.icons.length} occurrences · {unique} formes uniques · </span><span aria-live="polite" data-testid="dirty-count">{edits.dirtyCount === 0 ? '0 modification' : edits.dirtyCount === 1 ? '1 ligne modifiée' : `${edits.dirtyCount} lignes modifiées`}</span></div><div className="catalog-actions"><button type="button" disabled={saver.isBulkSaving} onClick={() => void reload()}>Recharger</button>{edits.dirtyCount > 0 && <><button type="button" disabled={saver.isBulkSaving} onClick={cancelAll}>Tout annuler</button><button type="button" disabled={saver.isBulkSaving} onClick={() => void saver.saveAllDirtyOccurrences()}>{bulkLabel}</button></>}{saver.bulkSaveState.status === 'completed' && <span role="status">{saver.bulkSaveState.saved} lignes enregistrées</span>}{saver.bulkSaveState.status === 'stopped' && <span role="alert">Sauvegarde interrompue après {saver.bulkSaveState.saved} lignes sur {saver.bulkSaveState.total}.</span>}</div></header>{error && <p role="alert">{error}</p>}<section className="filters"><input aria-label="Recherche plein texte" placeholder="Recherche plein texte" value={query} onChange={(event) => setQuery(event.target.value)} />{(['route', 'format', 'status', 'duplicateGroup'] as const).map((key) => <input key={key} aria-label={`Filtre ${key}`} placeholder={key} value={filters[key]} onChange={(event) => setFilters({ ...filters, [key]: event.target.value })} />)}<label><input type="checkbox" checked={filters.dirty} onChange={(event) => setFilters({ ...filters, dirty: event.target.checked })} />Afficher uniquement les lignes modifiées</label></section><nav><button type="button" onClick={() => setView('all')}>Toutes</button><button type="button" onClick={() => setView('duplicates')}>Doublons exacts</button><button type="button" onClick={() => setView('conflicts')}>Conflits</button></nav><div className="table">{items.map((icon) => <IconRow key={icon.occurrenceId} icon={icon} edits={edits} saver={saver} />)}{items.length === 0 && <p className="empty-state">Aucune occurrence ne correspond aux filtres actifs.</p>}</div></main>;
}

function IconRow({ icon, edits, saver }: { icon: Icon; edits: ReturnType<typeof useIconCatalogEdits>; saver: ReturnType<typeof useIconCatalogSave> }) {
  const draft = edits.getDraft(icon.occurrenceId); const dirtyFields = edits.getDirtyFields(icon.occurrenceId); const dirty = dirtyFields.length > 0; const state = saver.getSaveState(icon.occurrenceId); const fieldErrors = saver.getFieldErrors(icon.occurrenceId); const disabled = state.status === 'saving' || saver.isBulkSaving;
  const update = (key: EditableKey, value: string) => edits.updateField(icon.occurrenceId, key, value);
  return <article data-occurrence-id={icon.occurrenceId} className={dirty ? 'catalog-row catalog-row--dirty' : 'catalog-row'}><CurrentIconPreview occurrence={icon} /><div><b>{String(icon.pageName ?? '—')}</b><small>{String(icon.route || '—')} · {String((icon.captures as Array<{ scenarioId?: string }> | undefined)?.[0]?.scenarioId || 'non couvert')}</small><small>{String(icon.format)} · {String(icon.file)}:{String(icon.line)}</small></div><div><b>{String(icon.name)}</b><small>{String(icon.kind)}</small><small>doublon {String(icon.fingerprint ?? '').slice(0, 8) || '—'}</small></div><LucidePicker value={draft.lucideIcon} error={fieldErrors.lucideIcon} onChange={(value) => update('lucideIcon', value)} /><label>Nom sémantique FaderZero<input value={draft.faderzeroName ?? ''} onChange={(event) => update('faderzeroName', event.target.value)} /><FieldError message={fieldErrors.faderzeroName} /></label><label>Motif<textarea value={draft.reason ?? ''} onChange={(event) => update('reason', event.target.value)} /><FieldError message={fieldErrors.reason} /></label><label>Statut<select value={draft.status ?? 'discovered'} onChange={(event) => update('status', event.target.value)}>{statuses.map((status) => <option key={status}>{status}</option>)}</select><FieldError message={fieldErrors.status} /></label><label>Notes<textarea value={draft.notes ?? ''} onChange={(event) => update('notes', event.target.value)} /><FieldError message={fieldErrors.notes} /></label>{dirty && <div className="dirty-indicator" role="status"><strong>Modifications non enregistrées</strong><small>{dirtyFields.length} champ(s) modifié(s) : {dirtyFields.join(', ')}</small><button type="button" disabled={disabled} onClick={() => edits.resetOccurrence(icon.occurrenceId)}>Annuler les modifications</button><button type="button" disabled={disabled} onClick={() => void saver.saveOccurrence(icon.occurrenceId)}>{disabled ? 'Enregistrement…' : 'Enregistrer'}</button></div>}{state.status === 'saved' && <p className="save-success" role="status">Enregistré</p>}{state.status === 'error' && <p className="save-error" role="alert">{state.message}</p>}{state.status === 'conflict' && <div className="save-error" role="alert"><p>{state.message}</p><button type="button" onClick={() => void saver.resolveConflictByReloading(icon.occurrenceId)}>Recharger les données serveur</button><button type="button" onClick={() => saver.dismissConflict(icon.occurrenceId)}>Conserver mon brouillon</button></div>}</article>;
}
