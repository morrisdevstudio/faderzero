import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const bookingMocks = vi.hoisted(() => ({
  listLeads: vi.fn(), listWorkspaceContacts: vi.fn(), listNotes: vi.fn(), listLeadContacts: vi.fn(),
  updateLead: vi.fn(), addNote: vi.fn(), linkContact: vi.fn(), unlinkContact: vi.fn(),
  createLead: vi.fn(), createWorkspaceContact: vi.fn(), updateWorkspaceContact: vi.fn(), confirmLead: vi.fn(), archiveLead: vi.fn(),
}));
const authMocks = vi.hoisted(() => ({ role: 'admin' }));

vi.mock('dexie-react-hooks', () => ({ useLiveQuery: vi.fn() }));
vi.mock('@/db/repositories/bookingRepository', () => ({
  bookingRepository: bookingMocks,
  BOOKING_STAGE_LABELS: { to_contact: 'À contacter', contacted: 'Contacté', in_discussion: 'En échange', option: 'Option', confirmed: 'Confirmé', closed: 'Clos' },
}));
vi.mock('@/stores/authStore', () => ({
  useAuthStore: (selector: (state: { activeWorkspace: { id: string; role: string }; session: { user: { id: string } } }) => unknown) => selector({ activeWorkspace: { id: 'workspace-1', role: authMocks.role }, session: { user: { id: 'user-1' } } }),
}));

import { useLiveQuery } from 'dexie-react-hooks';
import { BookingPage } from '@/features/booking/BookingPage';

const lead = { id: 'lead-1', workspaceId: 'workspace-1', venueName: 'Le Chabada', city: 'Angers', stage: 'contacted' as const, priority: 'normal' as const, targetDate: '2026-08-22', ownerId: 'user-1', nextAction: 'Relancer après le festival', nextActionAt: new Date('2026-08-01T10:00:00').getTime(), summary: 'Dossier de presse déjà envoyé.', createdAt: 1, updatedAt: 1, syncStatus: 'synced' as const };
const contact = { id: 'contact-1', workspaceId: 'workspace-1', name: 'Clara Martin', role: 'Programmation', email: 'clara@example.test', createdAt: 1, updatedAt: 1, syncStatus: 'synced' as const };

describe('BookingPage detail', () => {
  beforeEach(() => {
    authMocks.role = 'admin';
    let queryIndex = 0;
    vi.mocked(useLiveQuery).mockImplementation(() => [ [lead], [], [], [contact] ][queryIndex++ % 4] as never);
    Object.values(bookingMocks).forEach((mock) => mock.mockReset());
  });

  function openDetail() {
    render(<BookingPage />);
    fireEvent.click(screen.getByRole('button', { name: /Le Chabada/ }));
  }

  it('uses the proposition wording and consistent labels in the creation sheet', () => {
    render(<BookingPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter une proposition' }));
    const dialog = screen.getByRole('dialog', { name: 'Nouvelle proposition' });
    expect(within(dialog).getByLabelText('Nom du contact')).toBeInTheDocument();
    expect(within(dialog).getByLabelText('Rôle')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Créer la proposition' })).toBeInTheDocument();
  });

  it('shows compact venue details and every active stage', () => {
    openDetail();
    expect(screen.getByRole('heading', { name: 'Le Chabada' })).toBeInTheDocument();
    expect(screen.getByText(/Angers.*22 août 2026/)).toBeInTheDocument();
    ['À contacter', 'En discussion', 'Confirmé'].forEach((label) => expect(screen.getByRole('button', { name: label })).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: 'Contacté' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Option' })).not.toBeInTheDocument();
    expect(screen.queryByText('Négociation')).not.toBeInTheDocument();
    expect(screen.queryByText('À faire maintenant')).not.toBeInTheDocument();
  });

  it('renders the compact contact actions, global notes and the future action in the timeline', () => {
    openDetail();
    expect(screen.getByText('Clara Martin')).toBeInTheDocument();
    expect(screen.getByText('Programmation · contact principal')).toBeInTheDocument();
    expect(screen.getByLabelText('Appeler Clara Martin')).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByRole('link', { name: 'Envoyer un e-mail à Clara Martin' })).toHaveAttribute('href', 'mailto:clara@example.test');
    expect(screen.getByText('Notes globales')).toBeInTheDocument();
    expect(screen.getByText('Dossier de presse déjà envoyé.')).toBeInTheDocument();
    expect(screen.getByText('Timeline')).toBeInTheDocument();
    expect(screen.getByText('Relancer après le festival')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ajouter une note' })).toBeInTheDocument();
  });

  it('opens the existing exchange and details forms', () => {
    openDetail();
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter une note' }));
    expect(screen.getByRole('dialog', { name: 'Consigner un échange' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Fermer' }));
    fireEvent.click(screen.getByRole('button', { name: 'Modifier la salle' }));
    const dialog = screen.getByRole('dialog', { name: 'Détails de la salle' });
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByLabelText('Notes globales')).toHaveValue('Dossier de presse déjà envoyé.');
  });

  it('keeps the detail read-only for guests', () => {
    authMocks.role = 'guest';
    openDetail();
    expect(screen.queryByRole('button', { name: 'Ajouter une note' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Modifier la salle' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'En discussion' })).toBeDisabled();
  });
});
