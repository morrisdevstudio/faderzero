import { useEffect, useMemo, useRef, useState } from 'react';
import { FormDialog } from '@/components/FormDialog';
import { Button } from '@/ui/components/Button';
import { FieldLabel } from '@/ui/components/FieldLabel';
import { TextArea } from '@/ui/components/TextArea';
import { TextField } from '@/ui/components/TextField';
import { FzIcon } from '@/ui/icons';
import {
  MAX_EMAIL_ATTACHMENT_BYTES,
  buildContactMailto,
  listPublishedEpkShareContent,
  selectContactEmailDeliveryMode,
  totalAttachmentBytes,
  type PublishedEpkShareContent,
  type ShareableEpkAttachment,
} from './contactEmailShare';

interface ContactEmailComposerProps {
  contact: { name: string; email: string };
  workspaceId: string;
  workspaceName: string;
  onClose: () => void;
}

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} Ko`;
  return `${(bytes / (1024 * 1024)).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} Mo`;
}

function firstName(name: string) {
  return name.trim().split(/\s+/)[0] || name;
}

function AttachmentRow({
  attachment,
  checked,
  loading,
  failed,
  onChange,
}: {
  attachment: ShareableEpkAttachment;
  checked: boolean;
  loading: boolean;
  failed: boolean;
  onChange: () => void;
}) {
  return <label className="flex min-h-14 cursor-pointer items-center gap-3 py-2">
    <input
      type="checkbox"
      checked={checked}
      onChange={onChange}
      className="h-5 w-5 shrink-0 accent-rose-500"
    />
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/[0.06] text-white/70">
      <FzIcon
        name={attachment.kind === 'document' ? 'file-text' : 'audio-lines'}
        usageId={`booking-email.${attachment.kind}`}
        size="md"
      />
    </span>
    <span className="min-w-0 flex-1">
      <span className="block truncate text-sm font-bold text-white">{attachment.title}</span>
      <span className={`mt-0.5 block text-xs ${failed ? 'text-rose-300' : 'text-white/50'}`}>
        {failed ? 'Fichier indisponible · envoyé par lien' : `${formatBytes(attachment.sizeBytes)}${loading ? ' · préparation…' : ''}`}
      </span>
    </span>
  </label>;
}

export function ContactEmailComposer({ contact, workspaceId, workspaceName, onClose }: ContactEmailComposerProps) {
  const [subject, setSubject] = useState(`Dossier de presse — ${workspaceName}`);
  const [body, setBody] = useState(`Bonjour ${firstName(contact.name)},\n\nVoici les éléments de ${workspaceName}.\n\nBien cordialement,`);
  const [content, setContent] = useState<PublishedEpkShareContent | null | undefined>(undefined);
  const [contentLoadFailed, setContentLoadFailed] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [files, setFiles] = useState<Map<string, File>>(new Map());
  const [loadingIds, setLoadingIds] = useState<Set<string>>(new Set());
  const [failedIds, setFailedIds] = useState<Set<string>>(new Set());
  const [forceLink, setForceLink] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const filesRef = useRef(files);
  const loadingIdsRef = useRef(loadingIds);
  const failedIdsRef = useRef(failedIds);
  const mountedRef = useRef(true);
  filesRef.current = files;
  loadingIdsRef.current = loadingIds;
  failedIdsRef.current = failedIds;

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    let active = true;
    void listPublishedEpkShareContent(workspaceId)
      .then((value) => {
        if (!active) return;
        setContent(value);
      })
      .catch((reason) => {
        if (!active) return;
        setContent(null);
        setContentLoadFailed(true);
        setError(reason instanceof Error ? reason.message : 'Impossible de charger l’EPK publié.');
      });
    return () => { active = false; };
  }, [contact.name, workspaceId, workspaceName]);

  const selectedAttachments = useMemo(
    () => content?.attachments.filter((attachment) => selectedIds.has(attachment.id)) ?? [],
    [content, selectedIds],
  );
  const selectedBytes = totalAttachmentBytes(selectedAttachments);
  const isOverLimit = selectedBytes > MAX_EMAIL_ATTACHMENT_BYTES;
  const isPreparing = !isOverLimit && selectedAttachments.some((attachment) => loadingIds.has(attachment.id));
  const selectedFiles = selectedAttachments.flatMap((attachment) => {
    const file = files.get(attachment.id);
    return file ? [file] : [];
  });
  const hasUnavailableFile = selectedAttachments.some((attachment) => failedIds.has(attachment.id));
  const allFilesReady = selectedFiles.length === selectedAttachments.length;
  const deliveryMode = selectedAttachments.length === 0
    ? 'mailto'
    : forceLink || isOverLimit || hasUnavailableFile || !allFilesReady
      ? 'epk-link'
      : selectContactEmailDeliveryMode(selectedFiles, selectedBytes);

  useEffect(() => {
    if (selectedBytes === 0 || selectedBytes > MAX_EMAIL_ATTACHMENT_BYTES) return;
    const missing = selectedAttachments.filter((attachment) => (
      !filesRef.current.has(attachment.id)
      && !loadingIdsRef.current.has(attachment.id)
      && !failedIdsRef.current.has(attachment.id)
    ));
    if (missing.length === 0) return;

    setLoadingIds((current) => new Set([...current, ...missing.map((attachment) => attachment.id)]));
    missing.forEach((attachment) => {
      void attachment.loadFile()
        .then((file) => {
          if (!mountedRef.current) return;
          setFiles((current) => new Map(current).set(attachment.id, file));
        })
        .catch(() => {
          if (!mountedRef.current) return;
          setFailedIds((current) => new Set(current).add(attachment.id));
        })
        .finally(() => {
          if (!mountedRef.current) return;
          setLoadingIds((current) => {
            const next = new Set(current);
            next.delete(attachment.id);
            return next;
          });
        });
    });
  }, [selectedAttachments, selectedBytes]);

  function toggleAttachment(id: string) {
    setError(null);
    setFeedback(null);
    setForceLink(false);
    if (selectedIds.has(id)) {
      setFiles((current) => {
        const next = new Map(current);
        next.delete(id);
        return next;
      });
      setFailedIds((current) => {
        const next = new Set(current);
        next.delete(id);
        return next;
      });
    }
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function copyRecipient() {
    setError(null);
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Presse-papiers indisponible.');
      await navigator.clipboard.writeText(contact.email);
      setFeedback('Adresse copiée.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Impossible de copier l’adresse.');
    }
  }

  async function send() {
    setError(null);
    setFeedback(null);
    if (deliveryMode === 'native-files') {
      try {
        await navigator.share({ files: selectedFiles, title: subject, text: body });
        setFeedback('Partage ouvert. Le client choisi gère ensuite l’envoi.');
      } catch (reason) {
        if (reason instanceof DOMException && reason.name === 'AbortError') return;
        setForceLink(true);
        setError('Le partage des fichiers a échoué. Utilise le lien EPK à la place.');
      }
      return;
    }

    window.location.href = buildContactMailto({
      email: contact.email,
      subject,
      body,
      ...(deliveryMode === 'epk-link' && content ? { epkUrl: content.publicUrl } : {}),
    });
  }

  const documents = content?.attachments.filter((attachment) => attachment.kind === 'document') ?? [];
  const audio = content?.attachments.filter((attachment) => attachment.kind === 'audio') ?? [];
  const actionLabel = deliveryMode === 'native-files' ? 'Partager les fichiers' : 'Ouvrir le client mail';

  return <FormDialog title="Envoyer un e-mail" onClose={onClose} closeDisabled={isPreparing} placement="bottom">
    <div className="space-y-4">
      {error ? <p role="alert" className="rounded-xl bg-rose-500/15 p-3 text-sm text-rose-100">{error}</p> : null}
      {feedback ? <p role="status" className="rounded-xl bg-emerald-500/15 p-3 text-sm text-emerald-100">{feedback}</p> : null}

      <div>
        <p className="fz-field-label">Destinataire</p>
        <div className="mt-1 flex items-center gap-2 rounded-2xl bg-white/[0.06] p-2 pl-4">
          <span className="min-w-0 flex-1 truncate text-sm text-white">{contact.email}</span>
          <Button size="sm" variant="ghost" onClick={() => void copyRecipient()}>Copier</Button>
        </div>
      </div>
      <div><FieldLabel htmlFor="contact-email-subject">Objet</FieldLabel><TextField id="contact-email-subject" value={subject} onChange={(event) => setSubject(event.target.value)} /></div>
      <div><FieldLabel htmlFor="contact-email-body">Message</FieldLabel><TextArea id="contact-email-body" rows={6} value={body} onChange={(event) => setBody(event.target.value)} /></div>

      <section aria-labelledby="contact-email-attachments">
        <div className="flex items-end justify-between gap-3">
          <h3 id="contact-email-attachments" className="fz-field-label">Pièces jointes</h3>
          {selectedAttachments.length > 0 ? <span className={`text-xs ${isOverLimit ? 'text-amber-200' : 'text-white/50'}`}>{formatBytes(selectedBytes)} / 20 Mo</span> : null}
        </div>
        {content === undefined ? <p role="status" className="py-4 text-sm text-white/55">Chargement de l’EPK publié…</p> : null}
        {content === null && contentLoadFailed ? <p className="py-4 text-sm text-white/55">Une connexion est requise pour préparer les fichiers ou récupérer le lien EPK. Tu peux toujours ouvrir un e-mail simple.</p> : null}
        {content === null && !contentLoadFailed ? <p className="py-4 text-sm text-white/55">Publie d’abord ton EPK pour joindre ses documents et ses sons.</p> : null}
        {content?.hasUnpublishedChanges ? <p className="mt-2 rounded-xl bg-amber-400/10 p-3 text-xs text-amber-100">Seuls les éléments de la dernière publication sont proposés. Republie l’EPK pour inclure les changements récents.</p> : null}
        {documents.length > 0 ? <div className="mt-3 divide-y divide-white/10"><p className="pb-1 text-xs font-black uppercase tracking-wider text-white/45">Documents</p>{documents.map((attachment) => <AttachmentRow key={attachment.id} attachment={attachment} checked={selectedIds.has(attachment.id)} loading={loadingIds.has(attachment.id)} failed={failedIds.has(attachment.id)} onChange={() => toggleAttachment(attachment.id)} />)}</div> : null}
        {audio.length > 0 ? <div className="mt-3 divide-y divide-white/10"><p className="pb-1 text-xs font-black uppercase tracking-wider text-white/45">Sons</p>{audio.map((attachment) => <AttachmentRow key={attachment.id} attachment={attachment} checked={selectedIds.has(attachment.id)} loading={loadingIds.has(attachment.id)} failed={failedIds.has(attachment.id)} onChange={() => toggleAttachment(attachment.id)} />)}</div> : null}
        {content && content.attachments.length === 0 ? <p className="py-4 text-sm text-white/55">Aucun document ou son n’est disponible dans la dernière publication.</p> : null}
      </section>

      {deliveryMode === 'native-files' ? <p className="rounded-xl bg-white/[0.05] p-3 text-xs leading-relaxed text-white/60">Choisis ton application mail dans le menu système. Le navigateur ne peut pas renseigner automatiquement le destinataire : utilise « Copier » avant d’ouvrir le partage.</p> : null}
      {deliveryMode === 'epk-link' ? <p className="rounded-xl bg-amber-400/10 p-3 text-xs leading-relaxed text-amber-100">Ces fichiers seront envoyés via le lien de l’EPK public{isOverLimit ? ' car la sélection dépasse 20 Mo' : ''}.</p> : null}

      <Button variant="primary" fullWidth loading={isPreparing} disabled={content === undefined} leadingIcon={<FzIcon name="email" usageId="booking-email.send" size="md" />} onClick={() => void send()}>{actionLabel}</Button>
    </div>
  </FormDialog>;
}
