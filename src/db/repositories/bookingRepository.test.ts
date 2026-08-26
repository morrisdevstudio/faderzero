import { activateDatabase, getLegacyDatabase, type FaderZeroDatabase } from '@/db/db';
import { bookingRepository } from '@/db/repositories/bookingRepository';
import { useAuthStore } from '@/stores/authStore';
import { createTestDatabase, destroyTestDatabase } from '@/test/dbTestUtils';

describe('bookingRepository', () => {
  let database: FaderZeroDatabase;

  beforeEach(async () => {
    database = await createTestDatabase('booking-repository');
    activateDatabase(database);
    useAuthStore.setState({
      session: { user: { id: 'user-1' } } as never,
      activeWorkspace: { id: 'workspace-1', role: 'admin' } as never,
    });
  });

  afterEach(async () => {
    activateDatabase(getLegacyDatabase());
    await destroyTestDatabase(database);
  });

  it('creates a lead, a contact and their relation atomically in the offline outbox', async () => {
    const result = await bookingRepository.createLeadWithContact({
      venueName: ' Le Chabada ',
      city: ' Angers ',
      targetDate: '2026-10-12',
      nextAction: ' Appeler Clara ',
      nextActionAt: new Date('2026-08-28T10:00:00').getTime(),
    }, {
      newContact: {
        name: ' Clara Martin ',
        organization: ' Le Chabada ',
        role: ' Programmation ',
        city: ' Angers ',
        email: ' clara@example.test ',
      },
    });

    expect(result.lead).toMatchObject({ venueName: 'Le Chabada', city: 'Angers' });
    expect(result.contact).toMatchObject({ name: 'Clara Martin', organization: 'Le Chabada', city: 'Angers' });
    expect(await database.bookingLeadContacts.toArray()).toEqual([
      expect.objectContaining({ leadId: result.lead.id, contactId: result.contact?.id }),
    ]);
    expect((await database.syncQueue.orderBy('id').toArray()).map((item) => item.entityType)).toEqual([
      'workspaceContact', 'bookingLead', 'bookingLeadContact',
    ]);
  });

  it('derives lead and contact overviews without persisting duplicated search data', async () => {
    const firstContact = await bookingRepository.createWorkspaceContact({ name: 'Clara Martin', organization: 'Le Chabada' });
    const unlinkedContact = await bookingRepository.createWorkspaceContact({ name: 'Benoît Libre' });
    const lead = await bookingRepository.createLeadWithContact({
      venueName: 'Le Chabada',
      targetDate: '2026-10-12',
      nextAction: 'Relancer',
      nextActionAt: new Date('2026-08-28T10:00:00').getTime(),
    }, { existingContactId: firstContact.id });

    const leadOverviews = await bookingRepository.listLeadOverviews('workspace-1');
    expect(leadOverviews).toEqual([
      expect.objectContaining({ id: lead.lead.id, contactIds: [firstContact.id], contactNames: ['Clara Martin'] }),
    ]);

    const contactOverviews = await bookingRepository.listContactOverviews('workspace-1');
    expect(contactOverviews.find((contact) => contact.id === firstContact.id)?.linkedLeads).toEqual([
      expect.objectContaining({ id: lead.lead.id, venueName: 'Le Chabada' }),
    ]);
    expect(contactOverviews.find((contact) => contact.id === unlinkedContact.id)?.linkedLeads).toEqual([]);
  });

  it('normalizes website and social profile shortcuts before storing a contact', async () => {
    const contact = await bookingRepository.createWorkspaceContact({
      name: 'Contact générique',
      website: 'www.site.com',
      instagramUrl: '@faderzero',
      facebookUrl: 'faderzero.officiel',
    });

    expect(contact).toMatchObject({
      website: 'https://www.site.com',
      instagramUrl: 'https://www.instagram.com/faderzero',
      facebookUrl: 'https://www.facebook.com/faderzero.officiel',
    });

    const updated = await bookingRepository.updateWorkspaceContact(contact.id, {
      website: 'artiste.fr',
      instagramUrl: 'instagram.com/artiste',
      facebookUrl: 'https://www.facebook.com/artiste',
    });
    expect(updated).toMatchObject({
      website: 'https://artiste.fr',
      instagramUrl: 'https://instagram.com/artiste',
      facebookUrl: 'https://www.facebook.com/artiste',
    });
  });

  it('formats phone numbers and soft-deletes a contact with its linked proposals', async () => {
    const contact = await bookingRepository.createWorkspaceContact({ name: 'Clara Martin', phone: '0612345678' });
    const { lead } = await bookingRepository.createLeadWithContact({
      venueName: 'Le Chabada',
      targetDate: '2026-10-12',
      nextAction: 'Relancer',
      nextActionAt: new Date('2026-08-28T10:00:00').getTime(),
    }, { existingContactId: contact.id });

    expect(contact.phone).toBe('06 12 34 56 78');
    expect((await bookingRepository.createWorkspaceContact({ name: 'International', phone: '+33612345678' })).phone)
      .toBe('+33 6 12 34 56 78');
    await database.syncQueue.clear();
    await bookingRepository.deleteWorkspaceContact(contact.id);

    expect(await database.workspaceContacts.get(contact.id)).toMatchObject({ deletedAt: expect.any(Number) });
    expect(await database.bookingLeadContacts.where('[leadId+contactId]').equals([lead.id, contact.id]).first())
      .toMatchObject({ deletedAt: expect.any(Number) });
    expect((await database.syncQueue.toArray()).filter((item) => item.operation === 'soft_delete').map((item) => item.entityType))
      .toEqual(['bookingLeadContact', 'workspaceContact']);
  });

  it('copies a contact to another workspace without its linked proposals', async () => {
    const contact = await bookingRepository.createWorkspaceContact({ name: 'Clara Martin', organization: 'Le Chabada', phone: '0612345678' });
    const copy = await bookingRepository.copyWorkspaceContactToWorkspace(contact.id, 'workspace-2');

    expect(copy).toMatchObject({ workspaceId: 'workspace-2', name: 'Clara Martin', organization: 'Le Chabada', phone: '06 12 34 56 78' });
    expect(copy.id).not.toBe(contact.id);
    expect(await database.bookingLeadContacts.where('contactId').equals(copy.id).toArray()).toEqual([]);
    expect((await database.syncQueue.toArray()).at(-1)).toMatchObject({ workspaceId: 'workspace-2', entityType: 'workspaceContact', entityId: copy.id, operation: 'create' });
  });
});
