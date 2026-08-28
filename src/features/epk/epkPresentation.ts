export const EPK_SECTION_IDS = ['banniere', 'bio', 'musique', 'medias', 'espacePro', 'contact'] as const;
export type EpkSectionId = (typeof EPK_SECTION_IDS)[number];
export type EpkSaveState = 'saved' | 'saving' | 'offline' | 'conflict' | 'error';
export type EpkFact = { id: string; title: string; value: string; icon: 'location' | 'users' | 'calendar' | 'music' };
export type EpkEditorialContent = { bioTitle: string; musicTitle: string; proTitle: string; proDescription: string; contactTitle: string; facts: EpkFact[] };
export const DEFAULT_EPK_EDITORIAL: EpkEditorialContent = { bioTitle: 'Biographie', musicTitle: 'À écouter', proTitle: 'Espace pro', proDescription: 'Documents et ressources à destination des professionnels.', contactTitle: 'Contact', facts: [] };
export type EpkPublicModel = {
  name: string; slug: string; tagline?: string; shortBio?: string; fullBio?: string; city?: string; country?: string;
  genres: string[]; accentColor: string; sectionOrder: EpkSectionId[]; hiddenSections: EpkSectionId[]; heroUrl?: string; logoUrl?: string; editorial: EpkEditorialContent;
  videos: Array<{ id: string; title?: string; provider: 'YOUTUBE' | 'VIMEO'; providerVideoId: string }>;
  tracks: Array<{ id: string; title: string; description?: string }>;
  photos: Array<{ id: string; previewUrl: string; caption?: string; credit?: string }>;
  documents: Array<{ id: string; assetId: string; title: string; type: string; updatedAt: string }>;
  contacts: Array<{ name: string; role: string; email?: string; phone?: string; whatsapp?: string }>;
  links: Array<{ label: string; url: string }>;
};
export const DEFAULT_EPK_SECTION_ORDER: EpkSectionId[] = [...EPK_SECTION_IDS];
export const DEFAULT_EPK_ACCENT = '#ff3a63';
export function isEpkAccentColor(value: string | undefined): value is string { return Boolean(value && /^#[0-9a-f]{6}$/i.test(value)); }
export function normalizedSectionOrder(value?: readonly string[]): EpkSectionId[] { const valid = (value ?? []).filter((item): item is EpkSectionId => EPK_SECTION_IDS.includes(item as EpkSectionId)); return [...new Set([...valid, ...DEFAULT_EPK_SECTION_ORDER])]; }
export function epkOnAccentColor(accent: string): '#090a0c' | '#ffffff' { const c = (i: number) => Number.parseInt(accent.slice(i, i + 2), 16) / 255; const l = (v: number) => v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; return .2126 * l(c(1)) + .7152 * l(c(3)) + .0722 * l(c(5)) > .42 ? '#090a0c' : '#ffffff'; }
export function isEpkSectionVisible(model: EpkPublicModel, section: EpkSectionId): boolean { if (section === 'banniere') return true; if (model.hiddenSections.includes(section)) return false; if (section === 'bio') return Boolean(model.shortBio || model.fullBio || model.editorial.facts.length); if (section === 'musique') return model.tracks.length > 0 || model.links.length > 0; if (section === 'medias') return model.videos.length > 0 || model.photos.length > 0; if (section === 'espacePro') return model.documents.length > 0; return model.contacts.length > 0 || model.links.some((link) => /instagram|facebook|tiktok|youtube/i.test(link.label)); }
