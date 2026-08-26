import { useMemo, useState, type FormEvent, type KeyboardEvent, type ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate } from 'react-router-dom';
import { FormDialog } from '@/components/FormDialog';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import {
  BOOKING_STAGE_LABELS,
  bookingRepository,
  type BookingLeadOverview,
  type CreateWorkspaceContactInput,
  type WorkspaceContactOverview,
} from '@/db/repositories/bookingRepository';
import type { BookingStage, WorkspaceContactRecord } from '@/db/schema';
import { canWriteWorkspace } from '@/services/supabase/workspace';
import { useAuthStore } from '@/stores/authStore';
import { Button } from '@/ui/components/Button';
import { ContentRow } from '@/ui/components/ContentRow';
import { DateField } from '@/ui/components/DateField';
import { DetailHeader } from '@/ui/components/DetailHeader';
import { FieldLabel } from '@/ui/components/FieldLabel';
import { SearchField } from '@/ui/components/SearchField';
import { SelectField } from '@/ui/components/SelectField';
import { TextField } from '@/ui/components/TextField';
import { DateTimeField } from '@/ui/components/DateTimeField';
import { FzIcon } from '@/ui/icons';
import { formatContactPhone } from '@/lib/contactUrls';
import { CopyContactModal } from './CopyContactModal';

type PrimaryTab = 'booking' | 'contacts';
type DeadlineFilter = 'all' | 'overdue' | 'today' | 'upcoming';
type ReachabilityFilter = 'all' | 'phone' | 'email' | 'online' | 'none';
type LinkFilter = 'all' | 'linked' | 'unlinked';
type ContactMode = 'none' | 'existing' | 'new';
type FollowUpKind = 'call' | 'email' | 'follow_up' | 'send_press_kit' | 'other';

const ALL_STAGES = 'all';
const EMPTY_LEADS: BookingLeadOverview[] = [];
const EMPTY_CONTACTS: WorkspaceContactOverview[] = [];
const TAB_VALUES: PrimaryTab[] = ['booking', 'contacts'];
const followUpLabels: Record<FollowUpKind, string> = {
  call: 'Appeler',
  email: 'Envoyer un e-mail',
  follow_up: 'Relancer',
  send_press_kit: 'Envoyer le dossier',
  other: 'Autre',
};

function normalizeSearch(value: string) {
  return value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase('fr-FR').trim();
}

function includesQuery(values: Array<string | undefined>, query: string) {
  if (!query) return true;
  return values.some((value) => normalizeSearch(value ?? '').includes(query));
}

function dueLabel(timestamp: number) {
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startTomorrow = startToday + 86_400_000;
  if (timestamp < startToday) return 'En retard';
  if (timestamp < startTomorrow) return 'Aujourd’hui';
  return new Date(timestamp).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

function matchesDeadline(timestamp: number, filter: DeadlineFilter) {
  if (filter === 'all') return true;
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startTomorrow = startToday + 86_400_000;
  if (filter === 'overdue') return timestamp < startToday;
  if (filter === 'today') return timestamp >= startToday && timestamp < startTomorrow;
  return timestamp >= startTomorrow;
}

function uniqueValues(values: Array<string | undefined>) {
  return [...new Set(values.map((value) => value?.trim()).filter((value): value is string => Boolean(value)))]
    .sort((a, b) => a.localeCompare(b, 'fr'));
}

function focusFirstInvalidField(form: HTMLFormElement) {
  const field = Array.from(form.querySelectorAll<HTMLInputElement | HTMLSelectElement>('[required]'))
    .find((candidate) => !candidate.validity.valid);
  if (!field) return false;
  field.focus();
  field.scrollIntoView({ behavior: 'smooth', block: 'center' });
  return true;
}

function contactInputFromForm(data: FormData, prefix = ''): CreateWorkspaceContactInput {
  const field = (name: string) => String(data.get(`${prefix}${name}`) || '').trim() || undefined;
  return {
    name: field('Name') ?? '',
    organization: field('Organization'),
    role: field('Role'),
    city: field('City'),
    website: field('Website'),
    email: field('Email'),
    phone: field('Phone'),
    instagramUrl: field('InstagramUrl'),
    facebookUrl: field('FacebookUrl'),
  };
}

function followUpFromForm(data: FormData) {
  const kind = String(data.get('followUpKind') || 'follow_up') as FollowUpKind;
  const custom = String(data.get('followUpCustom') || '').trim();
  return kind === 'other' ? custom : followUpLabels[kind];
}

function ContactFields({ contact, prefix = '' }: { contact?: WorkspaceContactRecord; prefix?: string }) {
  const name = (field: string) => `${prefix}${field}`;
  const id = (field: string) => `booking-contact-${name(field).toLocaleLowerCase('fr-FR')}`;
  return <>
    <div><FieldLabel htmlFor={id('Name')} required>Nom du contact</FieldLabel><TextField id={id('Name')} required name={name('Name')} defaultValue={contact?.name} placeholder="Ex. Camille Martin" /></div>
    <div><FieldLabel htmlFor={id('Organization')} required>Structure, salle ou association</FieldLabel><TextField id={id('Organization')} required name={name('Organization')} defaultValue={contact?.organization} placeholder="Ex. Le Chabada" /></div>
    <div><FieldLabel htmlFor={id('Role')}>Rôle</FieldLabel><TextField id={id('Role')} name={name('Role')} defaultValue={contact?.role} placeholder="Programmation, régie…" /></div>
    <div><FieldLabel htmlFor={id('City')}>Ville</FieldLabel><TextField id={id('City')} name={name('City')} defaultValue={contact?.city} placeholder="Ville" /></div>
    <div><FieldLabel htmlFor={id('Phone')} required>Téléphone</FieldLabel><TextField id={id('Phone')} required name={name('Phone')} type="tel" inputMode="tel" autoComplete="tel" defaultValue={formatContactPhone(contact?.phone)} onChange={(event) => { event.currentTarget.value = formatContactPhone(event.currentTarget.value); }} placeholder="06 00 00 00 00" /></div>
    <div><FieldLabel htmlFor={id('Email')}>E-mail</FieldLabel><TextField id={id('Email')} name={name('Email')} type="email" defaultValue={contact?.email} placeholder="contact@exemple.fr" /></div>
    <div><FieldLabel htmlFor={id('Website')}>Site web</FieldLabel><TextField id={id('Website')} name={name('Website')} defaultValue={contact?.website} placeholder="site.com" /></div>
    <div><FieldLabel htmlFor={id('InstagramUrl')}>Instagram</FieldLabel><TextField id={id('InstagramUrl')} name={name('InstagramUrl')} defaultValue={contact?.instagramUrl} placeholder="@profil ou lien complet" /></div>
    <div><FieldLabel htmlFor={id('FacebookUrl')}>Facebook</FieldLabel><TextField id={id('FacebookUrl')} name={name('FacebookUrl')} defaultValue={contact?.facebookUrl} placeholder="profil ou lien complet" /></div>
  </>;
}

function HeaderPhoneAddIcon() {
  return <FzIcon name="phone-add" usageId="booking-header.add-contact" size="md" />;
}

function FilterChip({ children, onRemove }: { children: ReactNode; onRemove: () => void }) {
  return <button
    type="button"
    onClick={onRemove}
    className="flex min-h-11 items-center gap-1.5 rounded-full bg-orange-400/14 px-3 text-xs font-bold text-orange-100 transition hover:bg-orange-400/22 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-300"
  >
    <span>{children}</span>
    <FzIcon name="close" usageId="booking-filter-chip.remove" size="sm" />
  </button>;
}

function ReadOnlyField({ label, value }: { label: string; value?: string | undefined }) {
  return <div>
    <p className="fz-field-label">{label}</p>
    <p className={`mt-1 min-h-6 text-sm ${value ? 'text-white' : 'text-white/45'}`}>{value || 'Non renseigné'}</p>
  </div>;
}

export function BookingOverview() {
  const navigate = useNavigate();
  const activeWorkspace = useAuthStore((state) => state.activeWorkspace);
  const workspaces = useAuthStore((state) => state.workspaces);
  const session = useAuthStore((state) => state.session);
  const canWrite = canWriteWorkspace(activeWorkspace?.role);
  const [tab, setTab] = useState<PrimaryTab>('booking');
  const [bookingSearch, setBookingSearch] = useState('');
  const [contactSearch, setContactSearch] = useState('');
  const [bookingStage, setBookingStage] = useState<BookingStage | typeof ALL_STAGES>(ALL_STAGES);
  const [deadline, setDeadline] = useState<DeadlineFilter>('all');
  const [reachability, setReachability] = useState<ReachabilityFilter>('all');
  const [contactRole, setContactRole] = useState('all');
  const [contactCity, setContactCity] = useState('all');
  const [contactOrganization, setContactOrganization] = useState('all');
  const [contactLink, setContactLink] = useState<LinkFilter>('all');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isAddingLead, setIsAddingLead] = useState(false);
  const [isAddingContact, setIsAddingContact] = useState(false);
  const [contactMode, setContactMode] = useState<ContactMode>('none');
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [editingContactId, setEditingContactId] = useState<string | null>(null);
  const [copyingContactId, setCopyingContactId] = useState<string | null>(null);
  const [isContactDeleteConfirmOpen, setIsContactDeleteConfirmOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const leads = useLiveQuery(
    () => activeWorkspace?.id ? bookingRepository.listLeadOverviews(activeWorkspace.id) : Promise.resolve([]),
    [activeWorkspace?.id],
  ) ?? EMPTY_LEADS;
  const contacts = useLiveQuery(
    () => activeWorkspace?.id ? bookingRepository.listContactOverviews(activeWorkspace.id) : Promise.resolve([]),
    [activeWorkspace?.id],
  ) ?? EMPTY_CONTACTS;

  const roleOptions = useMemo(() => uniqueValues(contacts.map((contact) => contact.role)), [contacts]);
  const cityOptions = useMemo(() => uniqueValues(contacts.map((contact) => contact.city)), [contacts]);
  const organizationOptions = useMemo(() => uniqueValues(contacts.map((contact) => contact.organization)), [contacts]);

  const visibleLeads = useMemo(() => {
    const query = normalizeSearch(bookingSearch);
    return leads
      .filter((lead) => bookingStage === ALL_STAGES ? lead.stage !== 'closed' : lead.stage === bookingStage)
      .filter((lead) => matchesDeadline(lead.nextActionAt, deadline))
      .filter((lead) => includesQuery([lead.venueName, lead.city, ...lead.contactNames], query))
      .sort((a, b) => a.nextActionAt - b.nextActionAt);
  }, [bookingSearch, bookingStage, deadline, leads]);

  const visibleContacts = useMemo(() => {
    const query = normalizeSearch(contactSearch);
    return contacts
      .filter((contact) => includesQuery([
        contact.name, contact.organization, contact.role, contact.city, contact.phone, contact.email,
        contact.website, contact.instagramUrl, contact.facebookUrl,
      ], query))
      .filter((contact) => {
        if (reachability === 'phone') return Boolean(contact.phone);
        if (reachability === 'email') return Boolean(contact.email);
        if (reachability === 'online') return Boolean(contact.website || contact.instagramUrl || contact.facebookUrl);
        if (reachability === 'none') return !contact.phone && !contact.email && !contact.website && !contact.instagramUrl && !contact.facebookUrl;
        return true;
      })
      .filter((contact) => contactRole === 'all' || contact.role === contactRole)
      .filter((contact) => contactCity === 'all' || contact.city === contactCity)
      .filter((contact) => contactOrganization === 'all' || contact.organization === contactOrganization)
      .filter((contact) => contactLink === 'all' || (contactLink === 'linked' ? contact.linkedLeads.length > 0 : contact.linkedLeads.length === 0))
      .sort((a, b) => a.name.localeCompare(b.name, 'fr'));
  }, [contactCity, contactLink, contactOrganization, contactRole, contactSearch, contacts, reachability]);

  const selectedContact = contacts.find((contact) => contact.id === selectedContactId) ?? null;
  const editingContact = contacts.find((contact) => contact.id === editingContactId) ?? null;
  const copyingContact = contacts.find((contact) => contact.id === copyingContactId) ?? null;

  const bookingFilterCount = Number(bookingStage !== ALL_STAGES) + Number(deadline !== 'all');
  const contactFilterCount = Number(reachability !== 'all') + Number(contactRole !== 'all') + Number(contactCity !== 'all')
    + Number(contactOrganization !== 'all') + Number(contactLink !== 'all');
  const activeFilterCount = tab === 'booking' ? bookingFilterCount : contactFilterCount;

  function resetBookingFilters() {
    setBookingStage(ALL_STAGES);
    setDeadline('all');
  }

  function resetContactFilters() {
    setReachability('all');
    setContactRole('all');
    setContactCity('all');
    setContactOrganization('all');
    setContactLink('all');
  }

  async function deleteContact() {
    if (!editingContact) return;
    setError(null);
    try {
      await bookingRepository.deleteWorkspaceContact(editingContact.id);
      setIsContactDeleteConfirmOpen(false);
      setEditingContactId(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Impossible de supprimer le contact.');
    }
  }

  function handleTabKeyDown(event: KeyboardEvent<HTMLButtonElement>, currentTab: PrimaryTab) {
    let nextTab: PrimaryTab | undefined;
    if (event.key === 'Home') nextTab = TAB_VALUES[0];
    if (event.key === 'End') nextTab = TAB_VALUES[TAB_VALUES.length - 1];
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      const direction = event.key === 'ArrowRight' ? 1 : -1;
      const currentIndex = TAB_VALUES.indexOf(currentTab);
      nextTab = TAB_VALUES[(currentIndex + direction + TAB_VALUES.length) % TAB_VALUES.length];
    }
    if (!nextTab) return;
    event.preventDefault();
    setTab(nextTab);
    setIsFilterOpen(false);
    document.getElementById(`booking-tab-${nextTab}`)?.focus();
  }

  async function createContact(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    try {
      await bookingRepository.createWorkspaceContact(contactInputFromForm(new FormData(event.currentTarget)));
      setIsAddingContact(false);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Impossible d’ajouter le contact.');
    }
  }

  async function updateContact(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingContact) return;
    setError(null);
    try {
      await bookingRepository.updateWorkspaceContact(editingContact.id, contactInputFromForm(new FormData(event.currentTarget)));
      setEditingContactId(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Impossible de modifier le contact.');
    }
  }

  async function createLead(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (focusFirstInvalidField(event.currentTarget)) {
      setFormError('Complète les champs obligatoires indiqués par un astérisque.');
      return;
    }
    const data = new FormData(event.currentTarget);
    setError(null);
    setFormError(null);
    try {
      const existingContactId = String(data.get('existingContactId') || '');
      const contactChoice = contactMode === 'existing' && existingContactId
        ? { existingContactId }
        : contactMode === 'new'
          ? { newContact: contactInputFromForm(data, 'contact') }
          : undefined;
      const { lead } = await bookingRepository.createLeadWithContact({
        venueName: String(data.get('venueName') || ''),
        city: String(data.get('city') || '') || undefined,
        targetDate: String(data.get('targetDate') || '') || undefined,
        nextAction: followUpFromForm(data),
        nextActionAt: new Date(String(data.get('nextActionAt'))).getTime(),
        ownerId: session?.user.id,
      }, contactChoice);
      setIsAddingLead(false);
      setContactMode('none');
      navigate(`/booking/${lead.id}`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Impossible de créer la proposition.');
    }
  }

  return <section className="space-y-4 pb-6">
    <DetailHeader
      title="Booking"
      onBack={() => navigate('/calendar')}
      backLabel="Retour au calendrier"
      actions={canWrite ? <>
        <button type="button" onClick={() => setIsAddingContact(true)} aria-label="Ajouter un contact">
          <HeaderPhoneAddIcon />
        </button>
        <button type="button" onClick={() => setIsAddingLead(true)} aria-label="Ajouter une proposition">
          <FzIcon name="calendar-add" usageId="booking-header.add-proposition" size="md" />
        </button>
      </> : undefined}
    />

    <div role="tablist" aria-label="Vues du booking" className="grid grid-cols-2 gap-1 rounded-xl bg-white/[0.05] p-1">
      {([['booking', 'Booking'], ['contacts', 'Contacts']] as const).map(([value, label]) => <button
        key={value}
        id={`booking-tab-${value}`}
        type="button"
        role="tab"
        aria-selected={tab === value}
        aria-controls={`booking-panel-${value}`}
        tabIndex={tab === value ? 0 : -1}
        onClick={() => { setTab(value); setIsFilterOpen(false); }}
        onKeyDown={(event) => handleTabKeyDown(event, value)}
        className={`min-h-11 rounded-lg px-3 text-sm font-black transition ${tab === value ? 'bg-white text-black' : 'text-white/55 hover:text-white'}`}
      >{label}</button>)}
    </div>

    {error ? <p role="alert" className="rounded-xl bg-rose-500/15 p-3 text-sm text-rose-100">{error}</p> : null}

    <div className="flex items-center gap-2">
      <SearchField
        aria-label={tab === 'booking' ? 'Rechercher une proposition' : 'Rechercher un contact'}
        placeholder={tab === 'booking' ? 'Salle, ville ou contact…' : 'Nom, structure ou coordonnées…'}
        value={tab === 'booking' ? bookingSearch : contactSearch}
        onChange={(event) => tab === 'booking' ? setBookingSearch(event.target.value) : setContactSearch(event.target.value)}
      />
      <button
        type="button"
        onClick={() => setIsFilterOpen(true)}
        aria-label={`Filtrer ${tab === 'booking' ? 'les propositions' : 'les contacts'}${activeFilterCount ? `, ${activeFilterCount} actif${activeFilterCount > 1 ? 's' : ''}` : ''}`}
        className={`relative flex h-12 w-12 shrink-0 items-center justify-center rounded-xl transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-300 ${activeFilterCount ? 'bg-orange-400/18 text-orange-200' : 'bg-white/[0.06] text-white/70 hover:bg-white/[0.1]'}`}
      >
        <FzIcon name="filter" usageId={`booking-${tab}.filter`} size="md" />
        {activeFilterCount ? <span aria-hidden="true" className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-orange-300" /> : null}
      </button>
    </div>

    {tab === 'booking' && bookingFilterCount > 0 ? <div className="flex flex-wrap items-center gap-2">
      {bookingStage !== ALL_STAGES ? <FilterChip onRemove={() => setBookingStage(ALL_STAGES)}>{BOOKING_STAGE_LABELS[bookingStage]}</FilterChip> : null}
      {deadline !== 'all' ? <FilterChip onRemove={() => setDeadline('all')}>{{ overdue: 'En retard', today: 'Aujourd’hui', upcoming: 'À venir' }[deadline]}</FilterChip> : null}
      <button type="button" onClick={resetBookingFilters} className="min-h-11 px-2 text-xs font-bold text-white/55 hover:text-white">Tout effacer</button>
    </div> : null}

    {tab === 'contacts' && contactFilterCount > 0 ? <div className="flex flex-wrap items-center gap-2">
      {reachability !== 'all' ? <FilterChip onRemove={() => setReachability('all')}>{{ phone: 'Téléphone', email: 'E-mail', online: 'En ligne', none: 'Sans coordonnées' }[reachability]}</FilterChip> : null}
      {contactRole !== 'all' ? <FilterChip onRemove={() => setContactRole('all')}>{contactRole}</FilterChip> : null}
      {contactCity !== 'all' ? <FilterChip onRemove={() => setContactCity('all')}>{contactCity}</FilterChip> : null}
      {contactOrganization !== 'all' ? <FilterChip onRemove={() => setContactOrganization('all')}>{contactOrganization}</FilterChip> : null}
      {contactLink !== 'all' ? <FilterChip onRemove={() => setContactLink('all')}>{contactLink === 'linked' ? 'Avec proposition' : 'Sans proposition'}</FilterChip> : null}
      <button type="button" onClick={resetContactFilters} className="min-h-11 px-2 text-xs font-bold text-white/55 hover:text-white">Tout effacer</button>
    </div> : null}

    <div
      id="booking-panel-booking"
      role="tabpanel"
      aria-labelledby="booking-tab-booking"
      hidden={tab !== 'booking'}
      className="divide-y divide-white/10"
    >
      {visibleLeads.map((lead) => <ContentRow
        key={lead.id}
        mode="link"
        to={`/booking/${lead.id}`}
        title={lead.venueName}
        subtitle={lead.contactNames.length ? lead.contactNames.join(', ') : undefined}
        metadata={`${lead.city || 'Ville non renseignée'} · ${lead.nextAction}`}
        status={<span className={`text-[0.65rem] font-black ${lead.nextActionAt < Date.now() ? 'text-rose-300' : 'text-amber-200'}`}>{dueLabel(lead.nextActionAt)}</span>}
      />)}
      {visibleLeads.length === 0 ? <div className="rounded-xl bg-[var(--fz-bg-elevated)] p-6 text-center text-sm text-white/60">
        {bookingSearch || bookingFilterCount ? 'Aucune proposition ne correspond à cette recherche.' : 'Aucune proposition active. Utilise le bouton calendrier pour commencer.'}
      </div> : null}
    </div>
    <div
      id="booking-panel-contacts"
      role="tabpanel"
      aria-labelledby="booking-tab-contacts"
      hidden={tab !== 'contacts'}
      className="divide-y divide-white/10"
    >
      {visibleContacts.map((contact) => <ContentRow
        key={contact.id}
        mode="button"
        onClick={() => setSelectedContactId(contact.id)}
        title={contact.name}
        subtitle={contact.organization}
        metadata={[contact.role, contact.city].filter(Boolean).join(' · ') || contact.email || contact.phone || 'Sans coordonnées'}
      />)}
      {visibleContacts.length === 0 ? <div className="rounded-xl bg-[var(--fz-bg-elevated)] p-6 text-center text-sm text-white/60">
        {contactSearch || contactFilterCount ? 'Aucun contact ne correspond à cette recherche.' : 'Aucun contact partagé. Utilise le bouton téléphone pour commencer.'}
      </div> : null}
    </div>

    {isFilterOpen ? <FormDialog title={tab === 'booking' ? 'Filtrer le booking' : 'Filtrer les contacts'} onClose={() => setIsFilterOpen(false)} placement="bottom">
      <div className="space-y-4">
        {tab === 'booking' ? <>
          <label className="block"><span className="fz-field-label">Statut</span><SelectField aria-label="Filtrer par statut" value={bookingStage} onChange={(event) => setBookingStage(event.target.value as BookingStage | typeof ALL_STAGES)}><option value="all">Tous les dossiers actifs</option>{Object.entries(BOOKING_STAGE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</SelectField></label>
          <label className="block"><span className="fz-field-label">Échéance</span><SelectField aria-label="Filtrer par échéance" value={deadline} onChange={(event) => setDeadline(event.target.value as DeadlineFilter)}><option value="all">Toutes les échéances</option><option value="overdue">En retard</option><option value="today">Aujourd’hui</option><option value="upcoming">À venir</option></SelectField></label>
          <Button fullWidth onClick={() => { resetBookingFilters(); setIsFilterOpen(false); }}>Réinitialiser</Button>
        </> : <>
          <label className="block"><span className="fz-field-label">Joignabilité</span><SelectField aria-label="Filtrer par joignabilité" value={reachability} onChange={(event) => setReachability(event.target.value as ReachabilityFilter)}><option value="all">Toutes</option><option value="phone">Avec téléphone</option><option value="email">Avec e-mail</option><option value="online">Avec site ou réseau</option><option value="none">Sans coordonnées</option></SelectField></label>
          <label className="block"><span className="fz-field-label">Rôle</span><SelectField aria-label="Filtrer par rôle" value={contactRole} onChange={(event) => setContactRole(event.target.value)}><option value="all">Tous les rôles</option>{roleOptions.map((value) => <option key={value}>{value}</option>)}</SelectField></label>
          <label className="block"><span className="fz-field-label">Ville</span><SelectField aria-label="Filtrer par ville" value={contactCity} onChange={(event) => setContactCity(event.target.value)}><option value="all">Toutes les villes</option>{cityOptions.map((value) => <option key={value}>{value}</option>)}</SelectField></label>
          <label className="block"><span className="fz-field-label">Structure</span><SelectField aria-label="Filtrer par structure" value={contactOrganization} onChange={(event) => setContactOrganization(event.target.value)}><option value="all">Toutes les structures</option>{organizationOptions.map((value) => <option key={value}>{value}</option>)}</SelectField></label>
          <label className="block"><span className="fz-field-label">Propositions liées</span><SelectField aria-label="Filtrer par proposition liée" value={contactLink} onChange={(event) => setContactLink(event.target.value as LinkFilter)}><option value="all">Tous les contacts</option><option value="linked">Avec proposition</option><option value="unlinked">Sans proposition</option></SelectField></label>
          <Button fullWidth onClick={() => { resetContactFilters(); setIsFilterOpen(false); }}>Réinitialiser</Button>
        </>}
      </div>
    </FormDialog> : null}

    {isAddingContact ? <FormDialog title="Nouveau contact" onClose={() => { setIsAddingContact(false); setError(null); }} placement="bottom">
      <form onSubmit={(event) => void createContact(event)} className="space-y-3">
        {error ? <p role="alert" className="rounded-xl bg-rose-500/15 p-3 text-sm text-rose-100">{error}</p> : null}
        <ContactFields />
        <Button type="submit" variant="primary" fullWidth>Ajouter le contact</Button>
      </form>
    </FormDialog> : null}

    {isAddingLead ? <FormDialog title="Nouvelle proposition" onClose={() => { setIsAddingLead(false); setContactMode('none'); setError(null); setFormError(null); }} placement="bottom">
      <form noValidate onInput={() => setFormError(null)} onSubmit={(event) => void createLead(event)} className="space-y-4">
        {formError ? <p role="alert" className="rounded-xl bg-rose-500/15 p-3 text-sm text-rose-100">{formError}</p> : null}
        {error ? <p role="alert" className="rounded-xl bg-rose-500/15 p-3 text-sm text-rose-100">{error}</p> : null}
        <label className="block"><span className="fz-field-label">Salle ou organisateur <span className="text-rose-300">*</span></span><TextField required name="venueName" aria-label="Salle ou organisateur" placeholder="Salle ou organisateur" /></label>
        <label className="block"><span className="fz-field-label">Ville</span><TextField name="city" aria-label="Ville" placeholder="Ville" /></label>
        <label className="block"><span className="fz-field-label">Date cible <span className="text-rose-300">*</span></span><DateField required name="targetDate" aria-label="Date cible" /></label>
        <label className="block"><span className="fz-field-label">Prochaine action <span className="text-rose-300">*</span></span><SelectField required name="followUpKind" aria-label="Prochaine action" defaultValue="follow_up">{Object.entries(followUpLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</SelectField></label>
        <label className="block"><span className="fz-field-label">Précision si nécessaire</span><TextField name="followUpCustom" aria-label="Précision de la prochaine action" placeholder="Ex. rappeler après le festival" /></label>
        <label className="block"><span className="fz-field-label">Quand ? <span className="text-rose-300">*</span></span><DateTimeField required name="nextActionAt" aria-label="Date et heure de la prochaine action" /></label>
        <fieldset className="space-y-3 border-t border-white/10 pt-4">
          <legend className="fz-field-label">Contact associé</legend>
          <SelectField aria-label="Mode d’association du contact" value={contactMode} onChange={(event) => setContactMode(event.target.value as ContactMode)}>
            <option value="none">Aucun contact pour le moment</option>
            <option value="existing">Choisir un contact existant</option>
            <option value="new">Créer un nouveau contact</option>
          </SelectField>
          {contactMode === 'existing' ? <SelectField required name="existingContactId" aria-label="Contact existant" defaultValue=""><option value="" disabled>Sélectionner un contact</option>{contacts.map((contact) => <option key={contact.id} value={contact.id}>{contact.name}{contact.organization ? ` · ${contact.organization}` : ''}</option>)}</SelectField> : null}
          {contactMode === 'new' ? <ContactFields prefix="contact" /> : null}
        </fieldset>
        <p className="text-xs text-white/55"><span className="text-rose-300">*</span> Champs obligatoires</p>
        <Button type="submit" variant="primary" fullWidth>Créer la proposition</Button>
      </form>
    </FormDialog> : null}

    {selectedContact ? <FormDialog title={selectedContact.name} onClose={() => setSelectedContactId(null)} placement="bottom" headerActions={canWrite ? <button type="button" onClick={() => { setSelectedContactId(null); setCopyingContactId(selectedContact.id); }} aria-label="Copier ce contact vers un autre espace" title="Copier vers un autre espace" className="fz-dialog-close"><FzIcon name="copy" usageId="booking-contact-sheet.copy" size="md" /></button> : undefined}>
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-x-4 gap-y-4">
          <ReadOnlyField label="Structure" value={selectedContact.organization} />
          <ReadOnlyField label="Rôle" value={selectedContact.role} />
          <ReadOnlyField label="Ville" value={selectedContact.city} />
          <ReadOnlyField label="Téléphone" value={selectedContact.phone} />
          <ReadOnlyField label="E-mail" value={selectedContact.email} />
          <ReadOnlyField label="Site web" value={selectedContact.website} />
        </div>
        <div className="flex flex-wrap gap-2">
          {selectedContact.phone ? <a href={`tel:${selectedContact.phone}`} className="flex min-h-11 items-center gap-2 rounded-xl bg-white/[0.07] px-3 text-sm font-bold text-white"><FzIcon name="phone" usageId="booking-contact-sheet.phone" size="md" />Appeler</a> : null}
          {selectedContact.email ? <a href={`mailto:${selectedContact.email}`} className="flex min-h-11 items-center gap-2 rounded-xl bg-white/[0.07] px-3 text-sm font-bold text-white"><FzIcon name="email" usageId="booking-contact-sheet.email" size="md" />Écrire</a> : null}
          {selectedContact.website ? <a href={selectedContact.website} target="_blank" rel="noreferrer" className="flex min-h-11 items-center gap-2 rounded-xl bg-white/[0.07] px-3 text-sm font-bold text-white"><FzIcon name="external-link" usageId="booking-contact-sheet.website" size="md" />Site</a> : null}
          {selectedContact.instagramUrl ? <a href={selectedContact.instagramUrl} target="_blank" rel="noreferrer" className="flex min-h-11 items-center gap-2 rounded-xl bg-white/[0.07] px-3 text-sm font-bold text-white"><FzIcon name="external-link" usageId="booking-contact-sheet.instagram" size="md" />Instagram</a> : null}
          {selectedContact.facebookUrl ? <a href={selectedContact.facebookUrl} target="_blank" rel="noreferrer" className="flex min-h-11 items-center gap-2 rounded-xl bg-white/[0.07] px-3 text-sm font-bold text-white"><FzIcon name="external-link" usageId="booking-contact-sheet.facebook" size="md" />Facebook</a> : null}
        </div>
        <section aria-labelledby="contact-bookings-heading">
          <h3 id="contact-bookings-heading" className="fz-field-label">Propositions liées</h3>
          <div className="mt-2 divide-y divide-white/10">
            {selectedContact.linkedLeads.map((lead) => <ContentRow key={lead.id} mode="link" to={`/booking/${lead.id}`} onClick={() => setSelectedContactId(null)} title={lead.venueName} metadata={lead.city || BOOKING_STAGE_LABELS[lead.stage]} />)}
            {selectedContact.linkedLeads.length === 0 ? <p className="py-3 text-sm text-white/50">Aucune proposition liée.</p> : null}
          </div>
        </section>
        {canWrite ? <Button variant="primary" fullWidth leadingIcon={<FzIcon name="edit" usageId="booking-contact-sheet.edit" size="md" />} onClick={() => { setSelectedContactId(null); setEditingContactId(selectedContact.id); }}>Modifier</Button> : null}
      </div>
    </FormDialog> : null}

    {copyingContact ? <CopyContactModal contact={copyingContact} availableWorkspaces={workspaces} isOpen onClose={() => setCopyingContactId(null)} onSuccess={() => setCopyingContactId(null)} /> : null}

    {editingContact ? <FormDialog title="Modifier le contact" onClose={() => { setEditingContactId(null); setError(null); }} placement="bottom">
      <form onSubmit={(event) => void updateContact(event)} className="space-y-3">
        {error ? <p role="alert" className="rounded-xl bg-rose-500/15 p-3 text-sm text-rose-100">{error}</p> : null}
        <ContactFields contact={editingContact} />
        <Button type="submit" variant="primary" fullWidth>Enregistrer</Button>
        <Button variant="danger" fullWidth onClick={() => setIsContactDeleteConfirmOpen(true)}>Supprimer le contact</Button>
      </form>
    </FormDialog> : null}
    <ConfirmDialog isOpen={isContactDeleteConfirmOpen} title="Supprimer ce contact ?" description="Le contact sera retiré du carnet et de toutes ses propositions liées." confirmLabel="Supprimer" onConfirm={() => void deleteContact()} onCancel={() => setIsContactDeleteConfirmOpen(false)} />
  </section>;
}
