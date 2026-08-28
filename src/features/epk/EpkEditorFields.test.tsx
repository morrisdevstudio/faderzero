import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ContactFormDialog, DeleteIconButton, FactIconPicker, HeroImageField, LinkFormDialog, VideoCard, VideoFormDialog, youtubeThumbnailUrl } from './EpkEditorFields';
import type { EpkVideo } from './epk';

const youtubeVideo: EpkVideo = {
  id: 'video-1',
  epkId: 'epk-1',
  provider: 'YOUTUBE',
  providerVideoId: 'dQw4w9WgXcQ',
  title: 'Black cat',
  videoType: 'MUSIC_VIDEO',
  position: 0,
};

describe('ContactFormDialog', () => {
  it('utilise le dialogue standard et transmet les champs remplis', () => {
    const onAdd = vi.fn();
    const onClose = vi.fn();
    render(<ContactFormDialog saving={false} onClose={onClose} onAdd={onAdd} />);

    expect(screen.getByRole('dialog', { name: 'Ajouter un contact' })).toBeInTheDocument();
    const submit = screen.getByRole('button', { name: 'Ajouter le contact' });
    expect(submit).toHaveClass('fz-button-primary');
    expect(submit).toBeDisabled();

    fireEvent.change(screen.getByRole('textbox', { name: 'Nom' }), { target: { value: 'Yann' } });
    fireEvent.change(screen.getByRole('textbox', { name: 'Valeur' }), { target: { value: 'yann@example.com' } });
    fireEvent.click(submit);

    expect(onAdd).toHaveBeenCalledWith('Yann', 'BOOKING', 'yann@example.com', 'email');
    expect(onClose).toHaveBeenCalledOnce();
  });
});

describe('autres dialogues d’ajout', () => {
  it('ajoute un lien depuis le dialogue standard', () => {
    const onAdd = vi.fn();
    render(<LinkFormDialog title="Ajouter une plateforme" names={['Spotify', 'Deezer']} saving={false} onClose={vi.fn()} onAdd={onAdd} />);

    fireEvent.change(screen.getByRole('textbox', { name: 'URL' }), { target: { value: 'https://open.spotify.com/artist/test' } });
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter' }));

    expect(onAdd).toHaveBeenCalledWith('Spotify', 'https://open.spotify.com/artist/test');
  });

  it('ajoute une vidéo depuis le dialogue standard', () => {
    const onAdd = vi.fn();
    render(<VideoFormDialog saving={false} onClose={vi.fn()} onAdd={onAdd} />);

    fireEvent.change(screen.getByRole('textbox', { name: 'Titre (optionnel)' }), { target: { value: 'Live' } });
    fireEvent.change(screen.getByRole('textbox', { name: 'URL YouTube' }), { target: { value: 'https://youtu.be/dQw4w9WgXcQ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter la vidéo' }));

    expect(onAdd).toHaveBeenCalledWith('https://youtu.be/dQw4w9WgXcQ', 'Live', 'MUSIC_VIDEO');
  });
});

describe('VideoCard', () => {
  it('affiche la miniature YouTube et la corbeille', () => {
    render(<VideoCard video={youtubeVideo} disabled={false} onRemove={vi.fn()} />);

    expect(youtubeThumbnailUrl(youtubeVideo)).toBe('https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg');
    expect(screen.getByRole('img', { name: 'Miniature de Black cat' })).toHaveAttribute('src', 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg');
    expect(screen.getByRole('button', { name: 'Supprimer la vidéo Black cat' })).toBeInTheDocument();
  });
});

describe('DeleteIconButton', () => {
  it('reste accessible sans afficher de texte', () => {
    render(<DeleteIconButton label="Supprimer cette piste" usageId="test.delete" disabled={false} onClick={vi.fn()} />);

    const button = screen.getByRole('button', { name: 'Supprimer cette piste' });
    expect(button).toHaveAttribute('title', 'Supprimer cette piste');
    expect(button).toHaveTextContent('');
  });
});

describe('FactIconPicker', () => {
  it('affiche les aperçus accessibles et sélectionne une icône', () => {
    const onChange = vi.fn();
    render(<FactIconPicker id="fact-icon" value="location" onChange={onChange} />);

    expect(screen.getByRole('button', { name: 'Localisation' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getAllByRole('button')).toHaveLength(4);
    expect(screen.queryByText('Localisation')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Formation' }));
    expect(onChange).toHaveBeenCalledWith('users');
  });
});

describe('HeroImageField', () => {
  it('propose un bouton Ajouter sans bannière', () => {
    render(<HeroImageField assetId={undefined} previewUrl={undefined} disabled={false} onPick={vi.fn()} onRemove={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Ajouter' }));
    expect(screen.getByRole('dialog', { name: 'Ajouter une bannière' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Supprimer l’image de bannière' })).not.toBeInTheDocument();
  });

  it('affiche la miniature avec les actions Modifier et Supprimer', () => {
    render(<HeroImageField assetId="hero-asset" previewUrl="https://example.test/hero.jpg" disabled={false} onPick={vi.fn()} onRemove={vi.fn()} />);

    expect(screen.getByRole('img', { name: 'Miniature de la bannière' })).toHaveAttribute('src', 'https://example.test/hero.jpg');
    expect(screen.getByRole('button', { name: 'Modifier' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Supprimer l’image de bannière' })).toBeInTheDocument();
  });
});
