import { useEffect, useState } from 'react';
import { FormDialog } from '@/components/FormDialog';
import { bookingRepository } from '@/db/repositories/bookingRepository';
import type { WorkspaceContactRecord } from '@/db/schema';
import { listAvailableTargetWorkspaces } from '@/services/supabase/copy';
import { canWriteWorkspace, type Workspace } from '@/services/supabase/workspace';
import { Button } from '@/ui/components/Button';
import { FieldLabel } from '@/ui/components/FieldLabel';
import { SelectField } from '@/ui/components/SelectField';

interface CopyContactModalProps {
  contact: WorkspaceContactRecord;
  availableWorkspaces: Workspace[];
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function CopyContactModal({ contact, availableWorkspaces, isOpen, onClose, onSuccess }: CopyContactModalProps) {
  const [targetWorkspaces, setTargetWorkspaces] = useState<Workspace[]>([]);
  const [selectedTargetId, setSelectedTargetId] = useState('');
  const [isCopying, setIsCopying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const cachedTargets = availableWorkspaces.filter((workspace) => workspace.id !== contact.workspaceId && canWriteWorkspace(workspace.role));
    setError(null);
    setIsCopying(false);
    setTargetWorkspaces(cachedTargets);
    setSelectedTargetId(cachedTargets[0]?.id ?? '');
    void listAvailableTargetWorkspaces(contact.workspaceId)
      .then((workspaces) => {
        setTargetWorkspaces(workspaces);
        setSelectedTargetId(workspaces[0]?.id ?? '');
      })
      .catch(() => {
        if (cachedTargets.length === 0) {
          setTargetWorkspaces([]);
          setError('Impossible de charger les espaces de destination.');
        }
      });
  }, [availableWorkspaces, contact.workspaceId, isOpen]);

  async function copyContact() {
    if (!selectedTargetId || isCopying) return;
    setIsCopying(true);
    setError(null);
    try {
      await bookingRepository.copyWorkspaceContactToWorkspace(contact.id, selectedTargetId);
      onSuccess();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Échec de la copie du contact.');
      setIsCopying(false);
    }
  }

  if (!isOpen) return null;

  return <FormDialog title="Copier vers un autre espace" closeLabel="Fermer la copie" closeDisabled={isCopying} onClose={onClose} placement="bottom">
    <p className="text-sm leading-6 text-[var(--fz-text-muted)]">Contact d’origine : {contact.name}</p>
    {error ? <p role="alert" className="mt-4 rounded-xl bg-rose-500/15 p-3 text-sm text-rose-100">{error}</p> : null}
    <div className="mt-4 space-y-4">
      <div>
        <FieldLabel htmlFor="contact-copy-destination">Espace de destination</FieldLabel>
        {targetWorkspaces.length === 0 ? <p className="mt-2 text-sm italic text-[var(--fz-text-muted)]">Aucun autre espace accessible en écriture.</p> : <SelectField id="contact-copy-destination" aria-label="Espace de destination" value={selectedTargetId} onChange={(event) => setSelectedTargetId(event.target.value)} disabled={isCopying}>{targetWorkspaces.map((workspace) => <option key={workspace.id} value={workspace.id}>{workspace.name} ({workspace.type === 'personal' ? 'Mon espace' : 'Groupe'})</option>)}</SelectField>}
      </div>
    </div>
    <div className="mt-6 grid grid-cols-2 gap-3 border-t border-white/10 pt-4">
      <Button variant="secondary" onClick={onClose} disabled={isCopying}>Annuler</Button>
      <Button variant="primary" onClick={() => void copyContact()} loading={isCopying} disabled={targetWorkspaces.length === 0}>Copier le contact</Button>
    </div>
  </FormDialog>;
}
