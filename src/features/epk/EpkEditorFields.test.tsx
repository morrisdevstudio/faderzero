import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ContactFormDialog, DeleteIconButton, EditIconButton, EpkUrlDialog, FactIconPicker, HeroImageField, LinkFormDialog, Links, VideoCard, VideoFormDialog } from './EpkEditorFields';
import { youtubeThumbnailUrl } from './epkMedia';
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
  it('propose les champs Email et Téléphone simultanément sans sélecteur', () => {
    const onAdd = vi.fn();
    const onClose = vi.fn();
    render(<ContactFormDialog saving={false} onClose={onClose} onAdd={onAdd} />);

    expect(screen.getByRole('dialog', { name: 'Ajouter un contact' })).toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();

    const submit = screen.getByRole('button', { name: 'Ajouter le contact' });
    expect(submit).toBeDisabled();

    const nameInput = screen.getByRole('textbox', { name: 'Nom' });
    const roleInput = screen.getByRole('textbox', { name: 'Rôle' });
    const emailInput = screen.getByRole('textbox', { name: 'Email' });
    const phoneInput = screen.getByRole('textbox', { name: 'Téléphone' });

    expect(nameInput).toBeInTheDocument();
    expect(roleInput).toBeInTheDocument();
    expect(emailInput).toBeInTheDocument();
    expect(phoneInput).toBeInTheDocument();

    // Remplir uniquement le nom -> encore désactivé
    fireEvent.change(nameInput, { target: { value: 'Yann' } });
    expect(submit).toBeDisabled();

    // Remplir à la fois email et téléphone
    fireEvent.change(roleInput, { target: { value: 'Manager' } });
    fireEvent.change(emailInput, { target: { value: 'yann@example.com' } });
    fireEvent.change(phoneInput, { target: { value: '0612345678' } });
    expect(submit).not.toBeDisabled();

    fireEvent.click(submit);
    expect(onAdd).toHaveBeenCalledWith('Yann', 'Manager', 'yann@example.com', '0612345678');
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('permet d’ajouter un contact avec seulement le téléphone', () => {
    const onAdd = vi.fn();
    render(<ContactFormDialog saving={false} onClose={vi.fn()} onAdd={onAdd} />);

    fireEvent.change(screen.getByRole('textbox', { name: 'Nom' }), { target: { value: 'Alice' } });
    fireEvent.change(screen.getByRole('textbox', { name: 'Téléphone' }), { target: { value: '0600000000' } });

    const submit = screen.getByRole('button', { name: 'Ajouter le contact' });
    expect(submit).not.toBeDisabled();
    fireEvent.click(submit);

    expect(onAdd).toHaveBeenCalledWith('Alice', '', undefined, '0600000000');
  });

  it('permet d’ajouter un contact avec seulement l’email', () => {
    const onAdd = vi.fn();
    render(<ContactFormDialog saving={false} onClose={vi.fn()} onAdd={onAdd} />);

    fireEvent.change(screen.getByRole('textbox', { name: 'Nom' }), { target: { value: 'Bob' } });
    fireEvent.change(screen.getByRole('textbox', { name: 'Email' }), { target: { value: 'bob@example.com' } });

    const submit = screen.getByRole('button', { name: 'Ajouter le contact' });
    expect(submit).not.toBeDisabled();
    fireEvent.click(submit);

    expect(onAdd).toHaveBeenCalledWith('Bob', '', 'bob@example.com', undefined);
  });

  it('ouvre en mode édition avec les valeurs initiales et permet la modification', () => {
    const onSubmit = vi.fn();
    const onClose = vi.fn();
    const contact = {
      id: 'contact-1',
      epkId: 'epk-1',
      name: 'Yann',
      role: 'Booking',
      email: 'yann@example.com',
      phone: '0612345678',
      position: 0,
    };

    render(<ContactFormDialog saving={false} initialContact={contact} onClose={onClose} onSubmit={onSubmit} />);

    expect(screen.getByRole('dialog', { name: 'Modifier le contact' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Nom' })).toHaveValue('Yann');
    expect(screen.getByRole('textbox', { name: 'Rôle' })).toHaveValue('Booking');
    expect(screen.getByRole('textbox', { name: 'Email' })).toHaveValue('yann@example.com');
    expect(screen.getByRole('textbox', { name: 'Téléphone' })).toHaveValue('0612345678');

    fireEvent.change(screen.getByRole('textbox', { name: 'Nom' }), { target: { value: 'Yann Modifié' } });
    fireEvent.change(screen.getByRole('textbox', { name: 'Rôle' }), { target: { value: 'Management' } });

    const submit = screen.getByRole('button', { name: 'Enregistrer les modifications' });
    fireEvent.click(submit);

    expect(onSubmit).toHaveBeenCalledWith('Yann Modifié', 'Management', 'yann@example.com', '0612345678');
    expect(onClose).toHaveBeenCalledOnce();
  });
});

describe('EpkUrlDialog', () => {
  it('modifie le slug uniquement après validation', () => {
    const onSubmit = vi.fn();
    const onClose = vi.fn();
    render(<EpkUrlDialog slug="kickedtoheaven" saving={false} onClose={onClose} onSubmit={onSubmit} />);

    expect(screen.getByRole('dialog', { name: 'Modifier l’URL' })).toBeInTheDocument();
    expect(screen.getByText('faderzero.com/')).toBeInTheDocument();
    const input = screen.getByRole('textbox', { name: 'URL' });
    expect(input).toHaveValue('kickedtoheaven');

    fireEvent.change(input, { target: { value: 'nouvelle-url' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer les modifications' }));

    expect(onSubmit).toHaveBeenCalledWith('nouvelle-url');
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

  it('sélectionne un réseau par son icône et transmet l’URL', () => {
    const onAdd = vi.fn();
    render(<LinkFormDialog title="Ajouter un réseau social" names={['Instagram', 'Facebook', 'TikTok']} saving={false} onClose={vi.fn()} onAdd={onAdd} />);

    fireEvent.click(screen.getByRole('button', { name: 'TikTok' }));
    expect(screen.getByRole('button', { name: 'TikTok' })).toHaveAttribute('aria-pressed', 'true');

    fireEvent.change(screen.getByRole('textbox', { name: 'URL' }), { target: { value: 'https://tiktok.com/@test' } });
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter' }));

    expect(onAdd).toHaveBeenCalledWith('TikTok', 'https://tiktok.com/@test');
  });

  it('ne propose pas les réseaux déjà insérés dans le dialogue', () => {
    const existingLinks = [
      { id: '1', epkId: 'epk-1', kind: 'CUSTOM' as const, label: 'Instagram', url: 'https://instagram.com/test', position: 0 },
    ];
    render(
      <Links
        title="Réseaux sociaux"
        dialogTitle="Ajouter un réseau social"
        names={['Instagram', 'Facebook']}
        items={existingLinks}
        onAdd={vi.fn()}
        onRemove={vi.fn()}
        saving={false}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Ajouter' }));
    expect(screen.getByRole('dialog', { name: 'Ajouter un réseau social' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Instagram' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Facebook' })).toBeInTheDocument();
  });

  it('n’affiche plus le bouton ajouter quand tous les réseaux sont insérés', () => {
    const allLinks = [
      { id: '1', epkId: 'epk-1', kind: 'CUSTOM' as const, label: 'Instagram', url: 'https://instagram.com/test', position: 0 },
      { id: '2', epkId: 'epk-1', kind: 'CUSTOM' as const, label: 'Facebook', url: 'https://facebook.com/test', position: 1 },
    ];
    render(
      <Links
        title="Réseaux sociaux"
        dialogTitle="Ajouter un réseau social"
        names={['Instagram', 'Facebook']}
        items={allLinks}
        onAdd={vi.fn()}
        onRemove={vi.fn()}
        saving={false}
      />
    );

    expect(screen.queryByRole('button', { name: 'Ajouter' })).not.toBeInTheDocument();
  });

  it('sélectionne une plateforme de streaming par son icône et filtre les plateformes déjà insérées', () => {
    const existingPlatform = [
      { id: '1', epkId: 'epk-1', kind: 'CUSTOM' as const, label: 'Spotify', url: 'https://open.spotify.com/artist/test', position: 0 },
    ];
    const onAdd = vi.fn();
    render(
      <Links
        title="Plateformes de streaming"
        dialogTitle="Ajouter une plateforme"
        names={['Spotify', 'Deezer', 'Apple Music']}
        items={existingPlatform}
        onAdd={onAdd}
        onRemove={vi.fn()}
        saving={false}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Ajouter' }));
    const dialog = screen.getByRole('dialog', { name: 'Ajouter une plateforme' });
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).queryByRole('button', { name: 'Spotify' })).not.toBeInTheDocument();

    const deezerBtn = screen.getByRole('button', { name: 'Deezer' });
    expect(deezerBtn).toBeInTheDocument();
    fireEvent.click(deezerBtn);
    expect(deezerBtn).toHaveAttribute('aria-pressed', 'true');

    fireEvent.change(screen.getByRole('textbox', { name: 'URL' }), { target: { value: 'https://deezer.com/artist/test' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Ajouter' }));

    expect(onAdd).toHaveBeenCalledWith('Deezer', 'https://deezer.com/artist/test');
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

describe('EditIconButton', () => {
  it('reste accessible sans afficher de texte', () => {
    const onClick = vi.fn();
    render(<EditIconButton label="Modifier cet élément" usageId="test.edit" disabled={false} onClick={onClick} />);

    const button = screen.getByRole('button', { name: 'Modifier cet élément' });
    expect(button).toHaveAttribute('title', 'Modifier cet élément');
    expect(button).toHaveTextContent('');

    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledOnce();
  });
});

describe('Links modification', () => {
  it('ouvre le dialogue en mode édition au clic sur le bouton modifier', () => {
    const onUpdate = vi.fn();
    const existingLinks = [
      { id: 'link-1', epkId: 'epk-1', kind: 'CUSTOM' as const, label: 'Instagram', url: 'https://instagram.com/ancien', position: 0 },
    ];

    render(
      <Links
        title="Réseaux sociaux"
        dialogTitle="Ajouter un réseau social"
        names={['Instagram', 'Facebook', 'TikTok']}
        items={existingLinks}
        onAdd={vi.fn()}
        onUpdate={onUpdate}
        onRemove={vi.fn()}
        saving={false}
      />
    );

    const editBtn = screen.getByRole('button', { name: 'Modifier cet élément' });
    expect(editBtn).toBeInTheDocument();
    fireEvent.click(editBtn);

    expect(screen.getByRole('dialog', { name: 'Modifier le réseau social' })).toBeInTheDocument();
    const urlInput = screen.getByRole('textbox', { name: 'URL' });
    expect(urlInput).toHaveValue('https://instagram.com/ancien');

    fireEvent.change(urlInput, { target: { value: 'https://instagram.com/nouveau' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer les modifications' }));

    expect(onUpdate).toHaveBeenCalledWith('link-1', 'Instagram', 'https://instagram.com/nouveau');
  });
});
