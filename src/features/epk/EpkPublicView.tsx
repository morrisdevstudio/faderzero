import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { BrandIcon, FzIcon } from '@/ui/icons';
import { isAppHostname } from '@/utils/domainRouting';
import { brandForLink, normalizeBrandLabel, socialBrands } from './epkBrands';
import { youtubeThumbnailUrl } from './epkMedia';
import { epkOnAccentColor, isEpkDocumentIcon, isEpkSectionVisible, normalizedSectionOrder, DEFAULT_EPK_DOCUMENT_ICON, normalizedEpkFactIcon, type EpkPublicModel, type EpkSectionId } from './epkPresentation';
import './epkPublicView.css';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function resolveTrackPlaybackUrl(track: { id: string; audioUrl?: string }, slug: string, hostname = typeof window === 'undefined' ? '' : window.location.hostname): string | undefined {
  if (track.audioUrl) return track.audioUrl;
  if (isAppHostname(hostname)) return undefined;
  return `/api/public/${encodeURIComponent(slug)}/tracks/${track.id}/audio`;
}

function resolvePublicImageUrl(url: string | undefined, assetId: string | undefined, hostname = typeof window === 'undefined' ? '' : window.location.hostname): string | undefined {
  if (url) return url;
  if (!assetId || !UUID.test(assetId) || isAppHostname(hostname)) return undefined;
  return `/media/preview/${assetId}`;
}

type Props = { model: EpkPublicModel; editing?: boolean; onEditSection?: (section: EpkSectionId) => void };
const titles: Record<EpkSectionId, string> = { banniere: 'Bannière', bio: 'Biographie', musique: 'Musique', medias: 'Médias', espacePro: 'Espace pro', contact: 'Contact' };

export function EpkPublicView({ model, editing = false, onEditSection }: Props) {
  const accent = /^#[0-9a-f]{6}$/i.test(model.accentColor) ? model.accentColor : '#ff3a63';
  const style = { '--epk-accent': accent, '--epk-on-accent': epkOnAccentColor(accent) } as CSSProperties;
  return <article className="epk-demo" style={style}><main>{normalizedSectionOrder(model.sectionOrder).map((section) => <Section key={section} section={section} model={model} visible={isEpkSectionVisible(model, section)} editing={editing} {...(onEditSection ? { onEditSection } : {})} />)}</main><footer>Propulsé par <strong>FaderZero</strong></footer></article>;
}

function EpkAudioPlayer({ model }: { model: EpkPublicModel }) {
  const [activeTrackId, setActiveTrackId] = useState<string | null>(model.tracks[0]?.id ?? null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const activeTrack = model.tracks.find((t) => t.id === activeTrackId) ?? model.tracks[0];

  useEffect(() => {
    if (!model.tracks.some((t) => t.id === activeTrackId)) {
      setActiveTrackId(model.tracks[0]?.id ?? null);
      setIsPlaying(false);
      setCurrentTime(0);
      setDuration(0);
    }
  }, [model.tracks, activeTrackId]);

  const handlePlayTrack = async (track: (typeof model.tracks)[number]) => {
    setError(null);
    const audio = audioRef.current;
    if (!audio) return;

    const isSameTrack = activeTrackId === track.id;
    const hasSource = Boolean(audio.getAttribute('src'));
    if (isSameTrack && hasSource) {
      if (isPlaying) {
        audio.pause();
      } else {
        try {
          await audio.play();
        } catch {
          audio.removeAttribute('src');
          setError('Lecture impossible.');
          setIsPlaying(false);
        }
      }
      return;
    }

    setActiveTrackId(track.id);
    const url = resolveTrackPlaybackUrl(track, model.slug);
    if (!url) {
      setError('Piste audio introuvable.');
      setIsPlaying(false);
      return;
    }

    audio.src = url;
    try {
      await audio.play();
    } catch {
      audio.removeAttribute('src');
      setError('Lecture impossible.');
      setIsPlaying(false);
    }
  };

  const toggleMainPlay = () => {
    if (!activeTrack) return;
    void handlePlayTrack(activeTrack);
  };

  const handleSeek = (nextTime: number) => {
    const audio = audioRef.current;
    if (!audio || !duration) return;
    const boundedTime = Math.max(0, Math.min(duration, nextTime));
    audio.currentTime = boundedTime;
    setCurrentTime(boundedTime);
  };

  const progressPercent = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;
  const scrubberStyle = { '--fz-audio-progress': `${progressPercent}%`, '--fz-accent': 'var(--epk-accent)' } as CSSProperties;

  const formatTime = (secs: number) => {
    if (!Number.isFinite(secs) || secs < 0) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="epk-player">
      <audio
        ref={audioRef}
        preload="metadata"
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onTimeUpdate={() => {
          if (audioRef.current) setCurrentTime(audioRef.current.currentTime);
        }}
        onLoadedMetadata={() => {
          if (audioRef.current) setDuration(audioRef.current.duration);
        }}
        onEnded={() => {
          setIsPlaying(false);
          const currentIndex = model.tracks.findIndex((t) => t.id === activeTrackId);
          if (currentIndex >= 0 && currentIndex < model.tracks.length - 1) {
            void handlePlayTrack(model.tracks[currentIndex + 1]!);
          }
        }}
        onError={() => {
          audioRef.current?.removeAttribute('src');
          setError('Erreur lors de la lecture audio.');
          setIsPlaying(false);
        }}
      />
      <div className="epk-now">
        <button
          type="button"
          className={isPlaying ? 'epk-now-btn is-playing' : 'epk-now-btn'}
          aria-label={isPlaying ? 'Mettre en pause' : 'Lancer la lecture'}
          onClick={toggleMainPlay}
          disabled={!activeTrack}
        >
          <FzIcon name={isPlaying ? 'pause' : 'play'} usageId="epk.player.now" size="sm" />
        </button>
        <div className="epk-now-info">
          <strong>{activeTrack?.title || 'Aucune piste'}</strong>
          <small>{isPlaying ? 'En lecture' : 'Prêt à écouter'}</small>
          {error ? <span className="epk-now-error">{error}</span> : null}
        </div>
      </div>
      <div className="epk-scrubber">
        <span>{formatTime(currentTime)}</span>
        <input
          type="range"
          min={0}
          max={Math.max(duration, 0.01)}
          step={0.01}
          value={duration > 0 ? Math.min(currentTime, duration) : 0}
          disabled={!duration}
          onChange={(event) => handleSeek(Number(event.target.value))}
          aria-label="Position de lecture"
          className="fz-audio-scrubber"
          style={scrubberStyle}
        />
        <span>{duration > 0 ? formatTime(duration) : '--:--'}</span>
      </div>
      <div className="epk-track-list">
        {model.tracks.map((track, index) => {
          const isActive = track.id === activeTrackId;
          return (
            <button
              type="button"
              className={`epk-track ${isActive ? 'epk-track-active' : ''}`}
              key={track.id}
              data-track={track.id}
              onClick={() => void handlePlayTrack(track)}
              aria-label={`Écouter ${track.title}`}
            >
              <i>
                <FzIcon
                  name={isActive && isPlaying ? 'pause' : 'play'}
                  usageId={`epk.track.${index}`}
                  size="sm"
                />
              </i>
              <strong>{track.title}</strong>
              <small>{String(index + 1).padStart(2, '0')}</small>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Section({ section, model, visible, editing, onEditSection }: { section: EpkSectionId; model: EpkPublicModel; visible: boolean; editing: boolean; onEditSection?: (section: EpkSectionId) => void }) {
  if (!visible) return editing ? <section className="epk-empty"><span>{titles[section]} est masquée</span><button type="button" onClick={() => onEditSection?.(section)}>Configurer</button></section> : null;
  if (section === 'banniere') {
    const heroUrl = resolvePublicImageUrl(model.heroUrl, model.heroAssetId);
    return <section id="banniere" className="epk-hero" style={heroUrl ? { backgroundImage: `url(${heroUrl})` } : undefined}><div className="epk-hero-shade" /><div className="epk-hero-content"><span className="epk-chip">{model.genres.join(' · ') || 'Electronic press kit'}</span><h1>{model.name}</h1>{model.tagline ? <p>{model.tagline}</p> : null}<div className="epk-actions"><a href="#musique"><FzIcon name="play" usageId="epk.hero.listen" />Écouter</a><a href="#espace-pro"><FzIcon name="folder" usageId="epk.hero.pro" />Espace Pro</a></div></div></section>;
  }
  if (section === 'bio') return <section id="bio" className="epk-section epk-bio"><div><h2>{model.editorial.bioTitle}</h2><p className="epk-prose">{model.fullBio || model.shortBio}</p></div><aside><h3>En bref</h3>{model.editorial.facts.map((fact) => <div className="epk-fact" key={fact.id}><span><FzIcon name={normalizedEpkFactIcon(fact.icon)} usageId={`epk.fact.${fact.icon}`} /></span><p><small>{fact.title}</small>{fact.value}</p></div>)}</aside></section>;
  if (section === 'musique') return <section id="musique" className="epk-section epk-music"><header><h2>{model.editorial.musicTitle}</h2></header><div className="epk-music-grid"><EpkAudioPlayer model={model} /><div className="epk-platforms">{model.links.filter((link) => { const brand = brandForLink(link); return normalizeBrandLabel(link.label) !== 'twitch' && (!brand || !socialBrands.has(brand)); }).map((link) => { const brand = brandForLink(link); return <a href={link.url} target="_blank" rel="noreferrer" key={`${link.label}-${link.url}`}><span>{brand ? <BrandIcon name={brand} /> : <FzIcon name="music" usageId="epk.platform.icon" />}</span><p><strong>{link.label}</strong><small>Écouter sur la plateforme</small></p><FzIcon name="external-link" usageId="epk.platform.external" size="sm" /></a>; })}</div></div></section>;
  if (section === 'medias') return <section id="medias" className="epk-section epk-media"><header><h2>Vidéos &amp; Photos</h2></header>{model.videos.length ? <div className="epk-videos">{model.videos.map((video) => <EpkVideoEmbed key={video.id} video={video} />)}</div> : null}<PhotoCarousel photos={model.photos} name={model.name} /></section>;
  if (section === 'espacePro') return <section id="espace-pro" className="epk-section epk-pro"><header><h2>{model.editorial.proTitle}</h2><p>{model.editorial.proDescription}</p></header><div>{model.documents.map((document) => <DocumentCard key={document.id} document={document} />)}</div></section>;
  return <section id="contact" className="epk-section epk-contact"><header><h2>{model.editorial.contactTitle}</h2></header><div className="epk-contact-list">{model.contacts.map((contact) => <article key={`${contact.name}-${contact.role ?? ''}`}><div className="epk-contact-header">{contact.role ? <small>{contact.role}</small> : null}<strong>{contact.name}</strong></div><div className="epk-contact-channels">{contact.email ? <a href={`mailto:${contact.email}`} className="epk-contact-channel"><FzIcon name="email" usageId="epk.contact.email" size="md" /><span>{contact.email}</span></a> : null}{contact.phone ? <a href={`tel:${contact.phone}`} className="epk-contact-channel"><FzIcon name="phone" usageId="epk.contact.phone" size="md" /><span>{contact.phone}</span></a> : null}</div></article>)}</div><div className="epk-socials">{model.links.map((link) => { const brand = brandForLink(link); return brand && socialBrands.has(brand) ? <a key={`${link.label}-${link.url}`} href={link.url} target="_blank" rel="noreferrer" aria-label={link.label}><BrandIcon name={brand} /></a> : null; })}</div></section>;
}

function DocumentCard({ document }: { document: EpkPublicModel['documents'][number] }) {
  const iconName = isEpkDocumentIcon(document.icon) ? document.icon : DEFAULT_EPK_DOCUMENT_ICON;
  const content = (
    <>
      <span className="epk-doc-icon"><FzIcon name={iconName} usageId="epk.document.icon" size="xl" /></span>
      <strong>{document.title}</strong>
      {document.description ? <small>{document.description}</small> : null}
      <em>Ouvrir <FzIcon name="external-link" usageId="epk.document.external" size="sm" /></em>
    </>
  );
  if (document.url) {
    return <a className="epk-doc" href={document.url} target="_blank" rel="noreferrer" data-document={document.assetId}>{content}</a>;
  }
  return <button className="epk-doc" type="button" data-document={document.assetId}>{content}</button>;
}

function EpkVideoEmbed({ video }: { video: EpkPublicModel['videos'][number] }) {
  const [playing, setPlaying] = useState(false);
  const title = video.title || 'Vidéo du groupe';
  if (video.provider === 'VIMEO') {
    return <figure className="epk-video"><iframe src={`https://player.vimeo.com/video/${encodeURIComponent(video.providerVideoId)}`} title={title} loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" />{video.title ? <figcaption>{video.title}</figcaption> : null}</figure>;
  }
  const thumbnail = youtubeThumbnailUrl(video);
  const source = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(video.providerVideoId)}?autoplay=1`;
  return <figure className="epk-video">{playing ? <iframe src={source} title={title} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" /> : <button type="button" className="epk-video-poster" onClick={() => setPlaying(true)} aria-label={`Lire ${title}`}>{thumbnail ? <img src={thumbnail} alt="" referrerPolicy="no-referrer" /> : null}<span><FzIcon name="play" usageId="epk.video.play" /></span></button>}{video.title ? <figcaption>{video.title}</figcaption> : null}</figure>;
}

function PhotoCarousel({ photos, name }: Pick<EpkPublicModel, 'photos' | 'name'>) {
  const resolved = photos.flatMap((photo) => {
    const previewUrl = resolvePublicImageUrl(photo.previewUrl, photo.previewAssetId);
    return previewUrl ? [{ ...photo, previewUrl }] : [];
  });
  const [active, setActive] = useState(0);
  const move = (direction: -1 | 1) => setActive((index) => (index + direction + resolved.length) % resolved.length);
  useEffect(() => {
    if (resolved.length < 2 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const interval = window.setInterval(() => setActive((index) => (index + 1) % resolved.length), 5000);
    return () => window.clearInterval(interval);
  }, [resolved.length]);
  if (resolved.length === 0) return null;
  const photo = resolved[active]!;
  return <div className="epk-photo-carousel" aria-roledescription="carrousel" aria-label="Photos du groupe"><figure><img src={photo.previewUrl} alt={photo.caption || `${name} — photo presse`} />{resolved.length > 1 ? <><button type="button" className="epk-carousel-arrow epk-carousel-arrow-prev" onClick={() => move(-1)} aria-label="Photo précédente"><FzIcon name="back" usageId="epk.carousel.previous" /></button><button type="button" className="epk-carousel-arrow epk-carousel-arrow-next" onClick={() => move(1)} aria-label="Photo suivante"><FzIcon name="next" usageId="epk.carousel.next" /></button><span className="epk-carousel-position" aria-live="polite">{active + 1} / {resolved.length}</span></> : null}</figure>{photo.credit ? <figcaption>{photo.credit}</figcaption> : null}</div>;
}
