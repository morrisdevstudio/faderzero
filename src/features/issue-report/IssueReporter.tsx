import { createPortal } from 'react-dom';
import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import type { IssueReportAnnotation, IssueReportCategory, IssueReportDraftRecord } from '@/db/schema';
import { FormDialog } from '@/components/FormDialog';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { useDialogAccessibility } from '@/components/useDialogAccessibility';
import { Button } from '@/ui/components/Button';
import { FieldLabel } from '@/ui/components/FieldLabel';
import { SelectField } from '@/ui/components/SelectField';
import { TextArea } from '@/ui/components/TextArea';
import { TextField } from '@/ui/components/TextField';
import { FzIcon } from '@/ui/icons';
import { captureViewport, collectIssueReportDiagnostics } from './captureViewport';
import { canvasPoint, drawAnnotations, renderAnnotatedScreenshot, type AnnotationTool } from './annotationCanvas';
import { deleteIssueReportDraft, listIssueReportDrafts, MAX_ISSUE_REPORT_DRAFTS, saveIssueReportDraft } from './issueReportDrafts';
import { submitIssueReport, type CreatedIssueReport } from './issueReportApi';

const AUTHORIZED_EMAIL = 'yann.chouteau@gmail.com';
const LONG_PRESS_MS = 1200;

type ReporterView = 'closed' | 'hub' | 'capturing' | 'annotating' | 'form';

interface IssueReporterProps {
  email: string | undefined;
  userId: string | undefined;
  pathname: string;
  online: boolean;
}

export function IssueReporter({ email, userId, pathname, online }: IssueReporterProps) {
  const authorized = Boolean(userId) && email?.trim().toLowerCase() === AUTHORIZED_EMAIL;
  const [view, setView] = useState<ReporterView>('closed');
  const [drafts, setDrafts] = useState<IssueReportDraftRecord[]>([]);
  const [draft, setDraft] = useState<IssueReportDraftRecord | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [createdIssue, setCreatedIssue] = useState<CreatedIssueReport | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<IssueReportDraftRecord | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [publicConfirmed, setPublicConfirmed] = useState(false);
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pressStart = useRef<{ x: number; y: number } | null>(null);
  const suppressNextClick = useRef(false);
  const activatingRef = useRef(false);
  const viewRef = useRef(view);
  viewRef.current = view;

  const refreshDrafts = useCallback(async () => {
    if (!userId) return [];
    const values = await listIssueReportDrafts(userId);
    setDrafts(values);
    return values;
  }, [userId]);

  const startNew = useCallback(async () => {
    setMessage(null);
    setCreatedIssue(null);
    setPublicConfirmed(false);
    if (!userId) return;
    const existing = await listIssueReportDrafts(userId);
    if (existing.length >= MAX_ISSUE_REPORT_DRAFTS) {
      setDrafts(existing);
      setMessage('Supprimez ou envoyez un brouillon avant d’en créer un nouveau.');
      setView('hub');
      return;
    }

    setView('capturing');
    let screenshot: Blob | undefined;
    try {
      screenshot = await captureViewport();
    } catch {
      setMessage('La capture a échoué. Vous pouvez continuer avec un signalement texte.');
    }
    const timestamp = Date.now();
    const next: IssueReportDraftRecord = {
      id: crypto.randomUUID(),
      userId,
      stage: screenshot ? 'annotating' : 'editing',
      category: 'bug',
      title: '',
      description: '',
      ...(screenshot ? { screenshot } : {}),
      annotations: [],
      diagnostics: collectIssueReportDiagnostics(pathname, online),
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    await saveIssueReportDraft(next);
    setDraft(next);
    setView(screenshot ? 'annotating' : 'form');
  }, [online, pathname, userId]);

  const activate = useCallback(async () => {
    try {
      const existing = await refreshDrafts();
      if (existing.length > 0) setView('hub');
      else await startNew();
    } catch {
      activatingRef.current = false;
      setMessage('Impossible d’ouvrir les brouillons locaux.');
    }
  }, [refreshDrafts, startNew]);

  const closeReporter = useCallback(() => {
    activatingRef.current = false;
    setView('closed');
  }, []);

  useEffect(() => {
    if (!authorized) return;
    const clearPress = () => {
      if (pressTimer.current) window.clearTimeout(pressTimer.current);
      pressTimer.current = null;
      pressStart.current = null;
    };
    const onPointerDown = (event: PointerEvent) => {
      if (viewRef.current !== 'closed' || activatingRef.current || event.clientX > 44 || event.clientY > 44 || event.button > 0) return;
      clearPress();
      pressStart.current = { x: event.clientX, y: event.clientY };
      pressTimer.current = window.setTimeout(() => {
        pressTimer.current = null;
        pressStart.current = null;
        suppressNextClick.current = true;
        activatingRef.current = true;
        void activate();
      }, LONG_PRESS_MS);
    };
    const onPointerMove = (event: PointerEvent) => {
      const start = pressStart.current;
      if (start && Math.hypot(event.clientX - start.x, event.clientY - start.y) > 10) clearPress();
    };
    const onClick = (event: MouseEvent) => {
      if (!suppressNextClick.current) return;
      suppressNextClick.current = false;
      event.preventDefault();
      event.stopImmediatePropagation();
    };
    const onContextMenu = (event: MouseEvent) => {
      if (pressTimer.current && event.clientX <= 44 && event.clientY <= 44) event.preventDefault();
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('pointermove', onPointerMove, true);
    document.addEventListener('pointerup', clearPress, true);
    document.addEventListener('pointercancel', clearPress, true);
    document.addEventListener('click', onClick, true);
    document.addEventListener('contextmenu', onContextMenu, true);
    return () => {
      clearPress();
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('pointermove', onPointerMove, true);
      document.removeEventListener('pointerup', clearPress, true);
      document.removeEventListener('pointercancel', clearPress, true);
      document.removeEventListener('click', onClick, true);
      document.removeEventListener('contextmenu', onContextMenu, true);
    };
  }, [activate, authorized]);

  useEffect(() => {
    if (!authorized) {
      setView('closed');
      activatingRef.current = false;
      setDraft(null);
    }
  }, [authorized]);

  async function updateDraft(next: IssueReportDraftRecord) {
    setDraft(next);
    await saveIssueReportDraft(next);
  }

  async function openDraft(value: IssueReportDraftRecord) {
    setDraft(value);
    setMessage(value.lastError ?? null);
    setPublicConfirmed(false);
    setView(value.screenshot && value.stage === 'annotating' ? 'annotating' : 'form');
  }

  async function returnToHub() {
    await refreshDrafts();
    setView('hub');
  }

  async function handleSubmit() {
    if (!draft || !draft.title.trim() || !draft.description.trim() || !publicConfirmed) return;
    const ready: IssueReportDraftRecord = { ...draft, stage: 'ready', updatedAt: Date.now() };
    await updateDraft(ready);
    if (!online) {
      setMessage('Brouillon enregistré. Revenez ici pour l’envoyer lorsque la connexion sera revenue.');
      setView('hub');
      await refreshDrafts();
      return;
    }
    setIsSending(true);
    setMessage(null);
    try {
      const rendered = ready.screenshot ? await renderAnnotatedScreenshot(ready.screenshot, ready.annotations) : undefined;
      const result = await submitIssueReport(ready, rendered);
      await deleteIssueReportDraft(ready.userId, ready.id);
      setCreatedIssue(result);
      setDraft(null);
      setView('hub');
      await refreshDrafts();
    } catch (error) {
      const text = error instanceof Error ? error.message : 'Envoi impossible.';
      const failed: IssueReportDraftRecord = { ...ready, stage: 'failed', lastError: text, updatedAt: Date.now() };
      await updateDraft(failed);
      setMessage(text);
    } finally {
      setIsSending(false);
    }
  }

  if (!authorized || view === 'closed') return null;

  return (
    <>
      {view === 'capturing' ? createPortal(
        <div data-issue-reporter-ui className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70" role="status" aria-live="polite">
          <p className="rounded-2xl bg-[#15171c] px-5 py-4 text-sm font-black text-white shadow-2xl">Capture en cours…</p>
        </div>, document.body,
      ) : null}

      {view === 'annotating' && draft?.screenshot ? (
        <AnnotationEditor
          screenshot={draft.screenshot}
          annotations={draft.annotations}
          onChange={(annotations) => void updateDraft({ ...draft, annotations, stage: 'annotating', updatedAt: Date.now() })}
          onCancel={() => void returnToHub()}
          onValidate={() => void updateDraft({ ...draft, stage: 'editing', updatedAt: Date.now() }).then(() => setView('form'))}
        />
      ) : null}

      {view === 'hub' ? (
        <FormDialog title="Signalements GitHub" onClose={closeReporter} closeDisabled={isSending}>
          <div data-issue-reporter-ui className="space-y-4">
            {createdIssue ? (
              <div className="rounded-2xl border border-emerald-400/25 bg-emerald-400/10 p-4 text-sm text-emerald-100" role="status">
                Issue #{createdIssue.issueNumber} créée.{' '}
                <a className="font-black underline" href={createdIssue.issueUrl} target="_blank" rel="noreferrer">Ouvrir sur GitHub</a>
              </div>
            ) : null}
            {message ? <p className="rounded-2xl border border-amber-400/25 bg-amber-400/10 p-3 text-sm text-amber-100" role="status">{message}</p> : null}
            {drafts.length ? (
              <div className="space-y-2">
                <p className="fz-field-label">Brouillons sur cet appareil</p>
                {drafts.map((value) => (
                  <div key={value.id} className="rounded-2xl border border-white/10 bg-white/5 p-3">
                    <p className="truncate text-sm font-black text-white">{value.title || 'Signalement sans titre'}</p>
                    <p className="mt-1 text-xs text-white/55">{value.category} · {new Date(value.updatedAt).toLocaleString('fr-FR')}</p>
                    <div className="mt-3 flex gap-2">
                      <Button size="sm" variant="secondary" onClick={() => void openDraft(value)}>Ouvrir</Button>
                      <Button size="sm" variant="danger" onClick={() => setDeleteTarget(value)}>Supprimer</Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : <p className="text-sm text-white/60">Aucun brouillon en attente.</p>}
            <Button variant="primary" fullWidth disabled={drafts.length >= MAX_ISSUE_REPORT_DRAFTS} onClick={() => void startNew()}>Nouveau signalement</Button>
          </div>
        </FormDialog>
      ) : null}

      {view === 'form' && draft ? (
        <FormDialog title="Créer une issue GitHub" closeDisabled={isSending} onClose={() => void returnToHub()}>
          <form data-issue-reporter-ui className="space-y-4" onSubmit={(event) => { event.preventDefault(); void handleSubmit(); }}>
            {message ? <p role="alert" className="rounded-2xl border border-amber-400/25 bg-amber-400/10 p-3 text-sm text-amber-100">{message}</p> : null}
            {draft.screenshot ? <><ScreenshotPreview screenshot={draft.screenshot} annotations={draft.annotations} /><Button variant="secondary" fullWidth onClick={() => setView('annotating')}>Modifier les annotations</Button></> : null}
            <div>
              <FieldLabel htmlFor="issue-category" required>Catégorie</FieldLabel>
              <SelectField id="issue-category" value={draft.category} onChange={(event) => void updateDraft({ ...draft, category: event.target.value as IssueReportCategory, updatedAt: Date.now() })}>
                <option value="bug">Bug — comportement incorrect</option>
                <option value="amélioration">Amélioration — comportement existant</option>
                <option value="notes">Notes — observation</option>
                <option value="feature">Feature — nouvelle capacité</option>
              </SelectField>
            </div>
            <div>
              <FieldLabel htmlFor="issue-title" required>Titre</FieldLabel>
              <TextField id="issue-title" required maxLength={120} value={draft.title} onChange={(event) => void updateDraft({ ...draft, title: event.target.value, updatedAt: Date.now() })} />
            </div>
            <div>
              <FieldLabel htmlFor="issue-description" required>Description</FieldLabel>
              <TextArea id="issue-description" required maxLength={10000} rows={6} value={draft.description} onChange={(event) => void updateDraft({ ...draft, description: event.target.value, updatedAt: Date.now() })} />
            </div>
            <label className="flex gap-3 rounded-2xl border border-rose-400/30 bg-rose-400/10 p-3 text-sm leading-5 text-rose-100">
              <input className="mt-1 h-5 w-5 shrink-0 accent-rose-500" type="checkbox" checked={publicConfirmed} onChange={(event) => setPublicConfirmed(event.target.checked)} />
              <span>Je confirme que cette issue et sa capture seront publiques et ne contiennent aucune donnée confidentielle.</span>
            </label>
            <Button type="submit" variant="primary" fullWidth loading={isSending} disabled={!draft.title.trim() || !draft.description.trim() || !publicConfirmed}>
              {online ? 'Créer l’issue' : 'Enregistrer le brouillon'}
            </Button>
          </form>
        </FormDialog>
      ) : null}

      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        title="Supprimer ce brouillon ?"
        description="La capture, les annotations et le texte seront supprimés de cet appareil."
        confirmLabel="Supprimer"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={async () => {
          if (!deleteTarget) return;
          await deleteIssueReportDraft(deleteTarget.userId, deleteTarget.id);
          setDeleteTarget(null);
          await refreshDrafts();
        }}
      />
    </>
  );
}

function AnnotationEditor({ screenshot, annotations, onChange, onCancel, onValidate }: {
  screenshot: Blob;
  annotations: IssueReportAnnotation[];
  onChange: (annotations: IssueReportAnnotation[]) => void;
  onCancel: () => void;
  onValidate: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const [tool, setTool] = useState<AnnotationTool>('freehand');
  const [annotationText, setAnnotationText] = useState('');
  const [preview, setPreview] = useState<IssueReportAnnotation | undefined>();
  const [redo, setRedo] = useState<IssueReportAnnotation[]>([]);
  const annotationsRef = useRef(annotations);
  const previewRef = useRef(preview);
  const dialogRef = useDialogAccessibility(onCancel);

  annotationsRef.current = annotations;
  previewRef.current = preview;

  const repaint = useCallback(() => {
    const canvas = canvasRef.current;
    const image = imageRef.current;
    if (!canvas || !image) return;
    const context = canvas.getContext('2d');
    if (!context) return;
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    drawAnnotations(context, annotationsRef.current, previewRef.current);
  }, []);

  useEffect(() => {
    const url = URL.createObjectURL(screenshot);
    const image = new Image();
    image.onload = () => {
      imageRef.current = image;
      const canvas = canvasRef.current;
      if (canvas) {
        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;
        repaint();
      }
    };
    image.src = url;
    return () => URL.revokeObjectURL(url);
  }, [repaint, screenshot]);

  useEffect(repaint, [annotations, preview, repaint]);
  function start(event: ReactPointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = canvasPoint(canvas, event.clientX, event.clientY);
    const id = crypto.randomUUID();
    if (tool === 'text') {
      if (!annotationText.trim()) return;
      onChange([...annotations, { id, type: 'text', at: point, text: annotationText.trim().slice(0, 80) }]);
      setRedo([]);
      return;
    }
    setPreview(tool === 'freehand' ? { id, type: 'freehand', points: [point] } : { id, type: tool, start: point, end: point });
  }

  function move(event: ReactPointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas || !preview) return;
    const point = canvasPoint(canvas, event.clientX, event.clientY);
    setPreview(preview.type === 'freehand' ? { ...preview, points: [...preview.points, point] } : preview.type === 'text' ? preview : { ...preview, end: point });
  }

  function finish(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (!preview) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    onChange([...annotations, preview]);
    setRedo([]);
    setPreview(undefined);
  }

  function addTextAtCenter() {
    if (!annotationText.trim()) return;
    onChange([...annotations, {
      id: crypto.randomUUID(),
      type: 'text',
      at: { x: 0.5, y: 0.5 },
      text: annotationText.trim().slice(0, 80),
    }]);
    setRedo([]);
  }

  return createPortal(
    <div ref={dialogRef} tabIndex={-1} data-issue-reporter-ui className="fixed inset-0 z-[100] flex flex-col bg-[#0c0d10] text-white" role="dialog" aria-modal="true" aria-label="Annoter la capture">
      <header className="flex items-center justify-between gap-3 border-b border-white/10 px-3 pb-3 pt-[max(.75rem,env(safe-area-inset-top))]">
        <button type="button" onClick={onCancel} className="fz-dialog-close" aria-label="Fermer l’éditeur"><FzIcon name="close" usageId="issue-reporter.editor.close" size="md" /></button>
        <p className="text-sm font-black">Annoter la capture</p>
        <Button iconOnly size="sm" variant="primary" aria-label="Valider les annotations" title="Valider" leadingIcon={<FzIcon name="check" usageId="issue-reporter.editor.validate" />} onClick={onValidate} />
      </header>
      <div className="flex min-h-0 flex-1 items-start justify-start overflow-x-hidden overflow-y-auto bg-black p-2">
        <canvas ref={canvasRef} tabIndex={0} aria-label="Capture à annoter au pointeur" className="h-auto w-full shrink-0 touch-none shadow-2xl" onPointerDown={start} onPointerMove={move} onPointerUp={finish} onPointerCancel={finish} />
      </div>
      <div className="border-t border-white/10 bg-[#15171c] pb-[max(.75rem,env(safe-area-inset-bottom))] pt-2">
        <div className="flex justify-center gap-2 px-3 pb-2">
          {([['freehand', 'Trait libre', 'draw'], ['ellipse', 'Ellipse', 'ellipse'], ['arrow', 'Flèche', 'arrow'], ['text', 'Texte', 'text'], ['mask', 'Masquer une zone', 'mask']] as const).map(([value, label, icon]) => (
            <Button key={value} iconOnly size="sm" variant={tool === value ? 'primary' : 'secondary'} aria-label={label} aria-pressed={tool === value} title={label} leadingIcon={<FzIcon name={icon} usageId={`issue-reporter.editor.tool.${value}`} />} onClick={() => setTool(value)} />
          ))}
        </div>
        {tool === 'text' ? <div className="flex gap-2 px-3 pb-2"><div className="min-w-0 flex-1"><TextField aria-label="Texte à placer" placeholder="Saisissez puis touchez la capture" maxLength={80} value={annotationText} onChange={(event) => setAnnotationText(event.target.value)} /></div><Button iconOnly size="sm" variant="secondary" aria-label="Ajouter le texte au centre" title="Ajouter au centre" leadingIcon={<FzIcon name="add" usageId="issue-reporter.editor.text-center" />} disabled={!annotationText.trim()} onClick={addTextAtCenter} /></div> : null}
        <div className="flex justify-center gap-6 px-3">
          <Button iconOnly size="sm" variant="ghost" aria-label="Annuler la dernière annotation" title="Annuler" leadingIcon={<FzIcon name="undo" usageId="issue-reporter.editor.undo" />} disabled={!annotations.length} onClick={() => { const last = annotations.at(-1); if (!last) return; setRedo([last, ...redo]); onChange(annotations.slice(0, -1)); }} />
          <Button iconOnly size="sm" variant="ghost" aria-label="Rétablir la dernière annotation" title="Rétablir" leadingIcon={<FzIcon name="redo" usageId="issue-reporter.editor.redo" />} disabled={!redo.length} onClick={() => { const [first, ...rest] = redo; if (!first) return; onChange([...annotations, first]); setRedo(rest); }} />
          <Button iconOnly size="sm" variant="ghost" aria-label="Effacer toutes les annotations" title="Effacer tout" leadingIcon={<FzIcon name="clear" usageId="issue-reporter.editor.clear" />} disabled={!annotations.length} onClick={() => { setRedo([...annotations]); onChange([]); }} />
        </div>
      </div>
    </div>,
    document.body,
  );
}

function ScreenshotPreview({ screenshot, annotations }: { screenshot: Blob; annotations: IssueReportAnnotation[] }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;
    void renderAnnotatedScreenshot(screenshot, annotations).then((blob) => {
      if (!active) return;
      objectUrl = URL.createObjectURL(blob);
      setUrl(objectUrl);
    }).catch(() => setUrl(null));
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [annotations, screenshot]);
  return url ? <img className="max-h-48 w-full rounded-2xl border border-white/10 object-contain" src={url} alt="Aperçu de la capture annotée" /> : null;
}
