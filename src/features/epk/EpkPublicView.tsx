import { useEffect, useState, type CSSProperties } from 'react';
import { BrandIcon, FzIcon, type BrandIconName } from '@/ui/icons';
import { epkOnAccentColor, isEpkSectionVisible, normalizedSectionOrder, type EpkPublicModel, type EpkSectionId } from './epkPresentation';
import './epkPublicView.css';

type Props = { model: EpkPublicModel; editing?: boolean; onEditSection?: (section: EpkSectionId) => void };
const titles: Record<EpkSectionId, string> = { banniere: 'Bannière', bio: 'Biographie', musique: 'Musique', medias: 'Médias', espacePro: 'Espace pro', contact: 'Contact' };
const icon: Record<string, 'location' | 'users' | 'calendar' | 'music'> = { location: 'location', users: 'users', calendar: 'calendar', music: 'music' };
const brandByLabel = {
  spotify: 'spotify',
  'apple music': 'appleMusic',
  'youtube music': 'youtubeMusic',
  deezer: 'deezer',
  soundcloud: 'soundcloud',
  bandcamp: 'bandcamp',
  'amazon music': 'amazonMusic',
  tidal: 'tidal',
  qobuz: 'qobuz',
  youtube: 'youtube',
  instagram: 'instagram',
  facebook: 'facebook',
  x: 'x',
  twitter: 'x',
  tiktok: 'tiktok',
  linkedin: 'linkedin'
} satisfies Record<string, BrandIconName>;
const brandUrlMatchers: Array<[BrandIconName, RegExp]> = [
  ['youtubeMusic', /music\.youtube\.com/],
  ['appleMusic', /music\.apple\.com/],
  ['amazonMusic', /music\.amazon\./],
  ['spotify', /spotify\./],
  ['deezer', /deezer\./],
  ['soundcloud', /soundcloud\./],
  ['bandcamp', /bandcamp\./],
  ['tidal', /tidal\./],
  ['qobuz', /qobuz\./],
  ['youtube', /youtube\.|youtu\.be/],
  ['instagram', /instagram\./],
  ['facebook', /facebook\.|fb\.com/],
  ['x', /(?:^|\.)x\.com|twitter\.com/],
  ['tiktok', /tiktok\./],
  ['linkedin', /linkedin\./]
];
const socialBrands = new Set<BrandIconName>(['instagram', 'facebook', 'youtube', 'x', 'tiktok', 'linkedin']);

function normalizeBrandLabel(label: string) {
  return label.trim().toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ');
}

export function brandForLink(link: { label: string; url: string }) {
  const brandFromLabel = brandByLabel[normalizeBrandLabel(link.label) as keyof typeof brandByLabel];
  return brandFromLabel ?? brandUrlMatchers.find(([, matcher]) => matcher.test(link.url.toLowerCase()))?.[0];
}

export function EpkPublicView({ model, editing = false, onEditSection }: Props) {
  const accent = /^#[0-9a-f]{6}$/i.test(model.accentColor) ? model.accentColor : '#ff3a63';
  const style = { '--epk-accent': accent, '--epk-on-accent': epkOnAccentColor(accent) } as CSSProperties;
  return <article className="epk-demo" style={style}><main>{normalizedSectionOrder(model.sectionOrder).map((section) => <Section key={section} section={section} model={model} visible={isEpkSectionVisible(model, section)} editing={editing} {...(onEditSection ? { onEditSection } : {})} />)}</main><footer>Propulsé par <strong>FaderZero</strong></footer></article>;
}

function Section({ section, model, visible, editing, onEditSection }: { section: EpkSectionId; model: EpkPublicModel; visible: boolean; editing: boolean; onEditSection?: (section: EpkSectionId) => void }) {
  if (!visible) return editing ? <section className="epk-empty"><span>{titles[section]} est masquée</span><button type="button" onClick={() => onEditSection?.(section)}>Configurer</button></section> : null;
  if (section === 'banniere') return <section id="banniere" className="epk-hero" style={model.heroUrl ? { backgroundImage: `url(${model.heroUrl})` } : undefined}><div className="epk-hero-shade" /><div className="epk-hero-content"><span className="epk-chip">{model.genres.join(' · ') || 'Electronic press kit'}</span><h1>{model.name}</h1>{model.tagline ? <p>{model.tagline}</p> : null}<div className="epk-actions"><a href="#musique"><FzIcon name="play" usageId="epk.hero.listen" />Écouter</a><a href="#espace-pro"><FzIcon name="download" usageId="epk.hero.pro" />Espace Pro</a></div></div></section>;
  if (section === 'bio') return <section id="bio" className="epk-section epk-bio"><div><p className="epk-kicker">À propos</p><h2>{model.editorial.bioTitle}</h2><p className="epk-prose">{model.fullBio || model.shortBio}</p></div><aside><h3>En bref</h3>{model.editorial.facts.map((fact) => <div className="epk-fact" key={fact.id}><span><FzIcon name={icon[fact.icon] ?? 'music'} usageId={`epk.fact.${fact.icon}`} /></span><p><small>{fact.title}</small>{fact.value}</p></div>)}</aside></section>;
  if (section === 'musique') return <section id="musique" className="epk-section epk-music"><header><p className="epk-kicker">Discographie</p><h2>{model.editorial.musicTitle}</h2></header><div className="epk-music-grid"><div className="epk-player"><div className="epk-now"><span><FzIcon name="music" usageId="epk.player.now" /></span><p><small>Lecture</small>{model.tracks[0]?.title || 'Aucune piste'}</p></div>{model.tracks.map((track, index) => <button type="button" className="epk-track" key={track.id} data-track={track.id}><i><FzIcon name={index === 0 ? 'music' : 'play'} usageId={`epk.track.${index}`} size="sm" /></i><strong>{track.title}</strong><small>{String(index + 1).padStart(2, '0')}</small></button>)}</div><div className="epk-platforms">{model.links.filter((link) => { const brand = brandForLink(link); return normalizeBrandLabel(link.label) !== 'twitch' && (!brand || !socialBrands.has(brand)); }).map((link) => { const brand = brandForLink(link); return <a href={link.url} target="_blank" rel="noreferrer" key={`${link.label}-${link.url}`}><span>{brand ? <BrandIcon name={brand} /> : <FzIcon name="music" usageId="epk.platform.icon" />}</span><p><strong>{link.label}</strong><small>Écouter sur la plateforme</small></p><FzIcon name="external-link" usageId="epk.platform.external" size="sm" /></a>; })}</div></div></section>;
  if (section === 'medias') return <section id="medias" className="epk-section epk-media"><header><p className="epk-kicker">Médias</p><h2>Vidéos &amp; Photos</h2></header>{model.videos.length ? <div className="epk-videos">{model.videos.map((video) => { const source = video.provider === 'VIMEO' ? `https://player.vimeo.com/video/${encodeURIComponent(video.providerVideoId)}` : `https://www.youtube-nocookie.com/embed/${encodeURIComponent(video.providerVideoId)}`; return <figure className="epk-video" key={video.id}><iframe src={source} title={video.title || 'Vidéo du groupe'} loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" />{video.title ? <figcaption>{video.title}</figcaption> : null}</figure>; })}</div> : null}<PhotoCarousel photos={model.photos} name={model.name} /></section>;
  if (section === 'espacePro') return <section id="espace-pro" className="epk-section epk-pro"><header><p className="epk-kicker">Professionnels</p><h2>{model.editorial.proTitle}</h2><p>{model.editorial.proDescription}</p></header><div>{model.documents.map((document) => <button key={document.id} type="button" data-document={document.assetId}><span><FzIcon name="download" usageId="epk.document.download" /></span><small>{document.type.replaceAll('_', ' ')}</small><strong>{document.title}</strong><em>Ouvrir <FzIcon name="external-link" usageId="epk.document.external" size="sm" /></em></button>)}</div></section>;
  return <section id="contact" className="epk-section epk-contact"><header><p className="epk-kicker">Contact</p><h2>{model.editorial.contactTitle}</h2></header><div className="epk-contact-list">{model.contacts.map((contact) => <article key={`${contact.name}-${contact.role}`}><p><small>{contact.role}</small><strong>{contact.name}</strong>{contact.email ? <a href={`mailto:${contact.email}`}>{contact.email}</a> : contact.phone ? <a href={`tel:${contact.phone}`}>{contact.phone}</a> : null}</p><span><FzIcon name={contact.email ? 'email' : 'phone'} usageId="epk.contact.action" /></span></article>)}</div><div className="epk-socials">{model.links.map((link) => { const brand = brandForLink(link); return brand && socialBrands.has(brand) ? <a key={`${link.label}-${link.url}`} href={link.url} target="_blank" rel="noreferrer" aria-label={link.label}><BrandIcon name={brand} /></a> : null; })}</div></section>;
}

function PhotoCarousel({ photos, name }: Pick<EpkPublicModel, 'photos' | 'name'>) {
  const [active, setActive] = useState(0);
  const move = (direction: -1 | 1) => setActive((index) => (index + direction + photos.length) % photos.length);
  useEffect(() => {
    if (photos.length < 2 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const interval = window.setInterval(() => setActive((index) => (index + 1) % photos.length), 5000);
    return () => window.clearInterval(interval);
  }, [photos.length]);
  if (photos.length === 0) return null;
  const photo = photos[active]!;
  return <div className="epk-photo-carousel" aria-roledescription="carrousel" aria-label="Photos du groupe"><figure><img src={photo.previewUrl} alt={photo.caption || `${name} — photo presse`} />{photos.length > 1 ? <><button type="button" className="epk-carousel-arrow epk-carousel-arrow-prev" onClick={() => move(-1)} aria-label="Photo précédente"><FzIcon name="back" usageId="epk.carousel.previous" /></button><button type="button" className="epk-carousel-arrow epk-carousel-arrow-next" onClick={() => move(1)} aria-label="Photo suivante"><FzIcon name="next" usageId="epk.carousel.next" /></button><span className="epk-carousel-position" aria-live="polite">{active + 1} / {photos.length}</span></> : null}</figure>{photo.credit ? <figcaption>{photo.credit}</figcaption> : null}</div>;
}
