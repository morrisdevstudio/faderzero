import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const bookingMocks = vi.hoisted(() => ({
  listLeads: vi.fn(), listWorkspaceContacts: vi.fn(), listLeadOverviews: vi.fn(), listContactOverviews: vi.fn(), listNotes: vi.fn(), listLeadContacts: vi.fn(),
  updateLead: vi.fn(), addNote: vi.fn(), linkContact: vi.fn(), unlinkContact: vi.fn(),
  createLead: vi.fn(), createLeadWithContact: vi.fn(), createWorkspaceContact: vi.fn(), updateWorkspaceContact: vi.fn(), deleteWorkspaceContact: vi.fn(), confirmLead: vi.fn(), archiveLead: vi.fn(),
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

const lead = { id: 'lead-1', workspaceId: 'workspace-1', venueName: 'Le Chabada', city: 'Angers', stage: 'contacted' as const, priority: 'normal' as const, targetDate: '2026-08-22', ownerId: 'user-1', nextAction: 'Relancer après le festival', nextActionAt: new Date('2026-08-01T10:00:00').getTime(), summary: 'Dossier de presse déjà envoyé.', createdAt: 1, updatedAt: 1, syncStatus: 'synced' as const, contactIds: ['contact-1'], contactNames: ['Clara Martin'] };
const contact = { id: 'contact-1', workspaceId: 'workspace-1', name: 'Clara Martin', organization: 'Le Chabada', role: 'Programmation', city: 'Angers', email: 'clara@example.test', createdAt: 1, updatedAt: 1, syncStatus: 'synced' as const, linkedLeads: [lead] };

describe('BookingPage detail', () => {
  beforeEach(() => {
    authMocks.role = 'admin';
    vi.mocked(useLiveQuery).mockImplementation((querier) => {
      const source = String(querier);
      if (source.includes('listLeadOverviews') || source.includes('listLeads')) return [lead] as never;
      if (source.includes('listContactOverviews') || source.includes('listLeadContacts')) return [contact] as never;
      return [] as never;
    });
    Object.values(bookingMocks).forEach((mock) => mock.mockReset());
  });

  function renderBooking(initialEntry = '/booking') {
    render(
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/booking" element={<BookingPage />} />
          <Route path="/booking/:bookingId" element={<BookingPage />} />
          <Route path="/calendar" element={<p>Calendrier</p>} />
        </Routes>
      </MemoryRouter>,
    );
  }

  function openDetail() {
    renderBooking('/booking/lead-1');
  }

  it('uses the proposition wording and consistent labels in the creation sheet', () => {
    renderBooking();
    expect(screen.getByRole('heading', { level: 1, name: 'Booking' })).toBeInTheDocument();
    expect(screen.queryByText('Les salles à relancer et leurs interlocuteurs.')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ajouter une proposition' }).querySelector('svg')).toHaveAttribute('data-icon-usage', 'booking-header.add-proposition');
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter une proposition' }));
    const dialog = screen.getByRole('dialog', { name: 'Nouvelle proposition' });
    fireEvent.change(within(dialog).getByLabelText('Mode d’association du contact'), { target: { value: 'new' } });
    expect(within(dialog).getByRole('textbox', { name: /Nom du contact/ })).toBeRequired();
    expect(within(dialog).getByRole('textbox', { name: /Structure, salle ou association/ })).toBeRequired();
    expect(within(dialog).getByRole('textbox', { name: /Téléphone/ })).toBeRequired();
    expect(within(dialog).getByLabelText('Rôle')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Créer la proposition' })).toBeInTheDocument();
  });

  it('switches between booking and contacts with independent search and filters', () => {
    renderBooking();
    expect(screen.getByRole('tab', { name: 'Booking' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('searchbox', { name: 'Rechercher une proposition' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: 'Contacts' }));
    expect(screen.getByRole('searchbox', { name: 'Rechercher un contact' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Filtrer les contacts' }));
    expect(screen.getByRole('dialog', { name: 'Filtrer les contacts' })).toBeInTheDocument();
    expect(screen.getByLabelText('Filtrer par joignabilité')).toBeInTheDocument();
    expect(screen.getByLabelText('Filtrer par proposition liée')).toBeInTheDocument();
  });

  it('supports keyboard tabs and applies then resets booking filters', () => {
    renderBooking();
    const bookingTab = screen.getByRole('tab', { name: 'Booking' });
    const contactsTab = screen.getByRole('tab', { name: 'Contacts' });
    bookingTab.focus();
    fireEvent.keyDown(bookingTab, { key: 'ArrowRight' });
    expect(contactsTab).toHaveAttribute('aria-selected', 'true');
    expect(contactsTab).toHaveFocus();
    expect(document.getElementById('booking-panel-booking')).toBeInTheDocument();
    expect(document.getElementById('booking-panel-contacts')).toBeInTheDocument();

    fireEvent.click(bookingTab);
    fireEvent.click(screen.getByRole('button', { name: 'Filtrer les propositions' }));
    fireEvent.change(screen.getByLabelText('Filtrer par statut'), { target: { value: 'confirmed' } });
    expect(screen.queryByRole('link', { name: /Le Chabada/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Réinitialiser' }));
    expect(screen.getByRole('link', { name: /Le Chabada/ })).toBeInTheDocument();
  });

  it('searches a proposition by its linked contact name', () => {
    renderBooking();
    const search = screen.getByRole('searchbox', { name: 'Rechercher une proposition' });
    fireEvent.change(search, { target: { value: 'clara' } });
    expect(screen.getByRole('link', { name: /Le Chabada/ })).toBeInTheDocument();
    fireEvent.change(search, { target: { value: 'personne inconnue' } });
    expect(screen.queryByRole('link', { name: /Le Chabada/ })).not.toBeInTheDocument();
    expect(screen.getByText('Aucune proposition ne correspond à cette recherche.')).toBeInTheDocument();
  });

  it('opens a contact as read-only, then exposes its edit form', () => {
    renderBooking();
    fireEvent.click(screen.getByRole('tab', { name: 'Contacts' }));
    fireEvent.click(screen.getByRole('button', { name: /Clara Martin/ }));

    const sheet = screen.getByRole('dialog', { name: 'Clara Martin' });
    expect(within(sheet).getByRole('button', { name: 'Copier ce contact vers un autre espace' }).querySelector('svg'))
      .toHaveAttribute('data-icon-usage', 'booking-contact-sheet.copy');
    expect(within(sheet).getByRole('link', { name: 'Écrire' })).toHaveAttribute('href', 'mailto:clara@example.test');
    expect(within(sheet).getByRole('link', { name: /Le Chabada/ })).toHaveAttribute('href', '/booking/lead-1');
    fireEvent.click(within(sheet).getByRole('button', { name: 'Modifier' }));
    const editDialog = screen.getByRole('dialog', { name: 'Modifier le contact' });
    expect(editDialog).toBeInTheDocument();
    const phone = within(editDialog).getByRole('textbox', { name: /Téléphone/ });
    fireEvent.change(phone, { target: { value: '0612345678' } });
    expect(phone).toHaveValue('06 12 34 56 78');
    fireEvent.click(within(editDialog).getByRole('button', { name: 'Supprimer le contact' }));
    const confirmation = screen.getByRole('dialog', { name: 'Supprimer ce contact ?' });
    fireEvent.click(within(confirmation).getByRole('button', { name: 'Supprimer' }));
    expect(bookingMocks.deleteWorkspaceContact).toHaveBeenCalledWith('contact-1');
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

  it('opens a proposition on its stable detail route', () => {
    renderBooking();

    fireEvent.click(screen.getByRole('link', { name: /Le Chabada/ }));

    expect(screen.getByRole('heading', { level: 1, name: 'Le Chabada' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retour au booking' })).toBeInTheDocument();
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
    const editButton = screen.getByRole('button', { name: 'Modifier la salle' });
    expect(editButton.querySelector('svg')).toHaveAttribute('data-icon-usage', 'booking-detail.edit');
    fireEvent.click(editButton);
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
