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
    expect(pdfText).toContain('/BaseFont /Helvetica-Bold');
  });
});
