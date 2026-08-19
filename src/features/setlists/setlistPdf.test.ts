import type { SetlistRecord, SetlistSongDetail } from '@/db/schema';
import { generateSetlistPdfBytes } from '@/features/setlists/setlistPdf';

function bytesToLatin1String(bytes: Uint8Array) {
  return Array.from(bytes, (byte) => String.fromCharCode(byte)).join('');
}

describe('generateSetlistPdfBytes', () => {
  it('renders a valid pdf with title, segue arrow and ending note', () => {
    const setlist: SetlistRecord = {
      id: 'set-1',
      workspaceId: 'default-workspace',
      name: 'Concert Test',
      closingAnnotation: 'Merci et bonne nuit',
      createdAt: 1,
      updatedAt: 1,
    };
    const entries: SetlistSongDetail[] = [
      {
        id: 'entry-1',
        workspaceId: 'default-workspace',
        setlistId: 'set-1',
        songId: 'song-1',
        songTitle: 'Intro',
        position: 0,
        createdAt: 1,
        updatedAt: 1,
      },
      {
        id: 'entry-2',
        workspaceId: 'default-workspace',
        setlistId: 'set-1',
        songId: 'song-2',
        songTitle: 'Finale',
        position: 1,
        isDirectSegue: true,
        noteShowBpm: true,
        noteShowKey: true,
        annotation: 'Solo',
        songBpm: 121,
        songKey: 'A',
        createdAt: 1,
        updatedAt: 1,
      },
    ];

    const pdf = generateSetlistPdfBytes(
      setlist,
      entries,
      new Map([
        ['song-1', 60],
        ['song-2', 180],
      ]),
    );

    const pdfText = bytesToLatin1String(pdf);

    expect(pdfText.startsWith('%PDF-1.4')).toBe(true);
    expect(pdfText).toContain('CONCERT TEST');
    expect(pdfText).toContain('121 BPM');
    expect(pdfText).toContain('MERCI ET BONNE NUIT');
    expect(pdfText).toContain('0.110 0.098 0.090 RG');
    expect(pdfText).toContain('/BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding');
  });

  it('correctly encodes French accented characters and WinAnsi symbols', () => {
    const setlist: SetlistRecord = {
      id: 'set-accent',
      workspaceId: 'default-workspace',
      name: 'Fête Été',
      closingAnnotation: 'À bientôt !',
      createdAt: 1,
      updatedAt: 1,
    };
    const entries: SetlistSongDetail[] = [
      {
        id: 'entry-1',
        workspaceId: 'default-workspace',
        setlistId: 'set-accent',
        songId: 'song-1',
        songTitle: 'Évité & Héros',
        position: 0,
        createdAt: 1,
        updatedAt: 1,
      },
    ];

    const pdf = generateSetlistPdfBytes(setlist, entries, new Map([['song-1', 120]]));
    const pdfText = bytesToLatin1String(pdf);

    // Vérifie que les caractères accentués sont bien présents en octets Latin-1 / WinAnsi valides
    expect(pdfText).toContain('FÊTE ÉTÉ');
    expect(pdfText).toContain('ÉVITÉ & HÉROS');
    expect(pdfText).toContain('À BIENTÔT !');
    expect(pdfText).toContain('/Encoding /WinAnsiEncoding');
  });

  it('truncates song titles that are too long with ellipsis (...) to prevent overflow', () => {
    const setlist: SetlistRecord = {
      id: 'set-long',
      workspaceId: 'default-workspace',
      name: 'Setlist Longue',
      createdAt: 1,
      updatedAt: 1,
    };
    const entries: SetlistSongDetail[] = [
      {
        id: 'entry-1',
        workspaceId: 'default-workspace',
        setlistId: 'set-long',
        songId: 'song-1',
        songTitle: "Chanson 1 avec un nom très long c'est chiant",
        position: 0,
        createdAt: 1,
        updatedAt: 1,
      },
    ];

    const pdf = generateSetlistPdfBytes(setlist, entries, new Map([['song-1', 120]]));
    const pdfText = bytesToLatin1String(pdf);

    expect(pdfText).toContain('CHANSON 1 AVEC U...');
  });

  it('paginates correctly when songsPerPage is provided', () => {
    const setlist: SetlistRecord = {
      id: 'set-24',
      workspaceId: 'default-workspace',
      name: 'Setlist 24 Morceaux',
      createdAt: 1,
      updatedAt: 1,
    };
    const entries: SetlistSongDetail[] = Array.from({ length: 24 }, (_, index) => ({
      id: `entry-${index + 1}`,
      workspaceId: 'default-workspace',
      setlistId: 'set-24',
      songId: `song-${index + 1}`,
      songTitle: `Chanson ${index + 1}`,
      position: index,
      createdAt: 1,
      updatedAt: 1,
    }));

    // 24 chansons avec 12 par page -> 2 pages
    const pdf = generateSetlistPdfBytes(setlist, entries, new Map(), { songsPerPage: 12 });
    const pdfText = bytesToLatin1String(pdf);

    expect(pdfText).toContain('/Count 2');
    expect(pdfText).toContain('CHANSON 1');
    expect(pdfText).toContain('CHANSON 24');
  });

  it('keeps closing annotation on the single page when all songs are exported on 1 page', () => {
    const setlist: SetlistRecord = {
      id: 'set-ending-single',
      workspaceId: 'default-workspace',
      name: 'Tets',
      closingAnnotation: 'Note de fin',
      createdAt: 1,
      updatedAt: 1,
    };
    const entries: SetlistSongDetail[] = [
      { id: '1', workspaceId: 'w', setlistId: 's', songId: 's1', songTitle: 'NXKLSLW', position: 0, createdAt: 1, updatedAt: 1 },
      { id: '2', workspaceId: 'w', setlistId: 's', songId: 's2', songTitle: '1', position: 1, createdAt: 1, updatedAt: 1 },
      { id: '3', workspaceId: 'w', setlistId: 's', songId: 's3', songTitle: '10', position: 2, createdAt: 1, updatedAt: 1 },
    ];

    const pdf = generateSetlistPdfBytes(setlist, entries, new Map(), { songsPerPage: 3 });
    const pdfText = bytesToLatin1String(pdf);

    expect(pdfText).toContain('/Count 1');
    expect(pdfText).toContain('[NOTE DE FIN]');
  });
});
