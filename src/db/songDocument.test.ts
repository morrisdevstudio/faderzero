import { describe, expect, it } from 'vitest';
import {
  createEmptySongDocument,
  deriveSongTitle,
  songDocumentToText,
  textToSongDocument,
} from '@/db/songDocument';

describe('songDocument', () => {
  it('converts legacy lyrics into ordered semantic sections', () => {
    const document = textToSongDocument([
      '[Couplet 1]',
      'Une première ligne',
      'Une deuxième ligne',
      '',
      'REFRAIN',
      'On recommence',
    ].join('\n'));

    expect(document.content).toHaveLength(2);
    expect(document.content[0]?.attrs).toMatchObject({
      sectionType: 'verse',
      label: 'Couplet 1',
    });
    expect(document.content[1]?.attrs).toMatchObject({
      sectionType: 'chorus',
      label: 'Refrain',
    });
    expect(songDocumentToText(document)).toBe([
      '[Couplet 1]',
      'Une première ligne',
      'Une deuxième ligne',
      '',
      '[Refrain]',
      'On recommence',
    ].join('\n'));
  });

  it('keeps unstructured lyrics in a free section', () => {
    const document = textToSongDocument('Première idée\nDeuxième idée');

    expect(document.content[0]?.attrs.sectionType).toBe('free');
    expect(songDocumentToText(document)).toBe('Première idée\nDeuxième idée');
  });

  it('creates a valid empty document and derives a concise title', () => {
    expect(createEmptySongDocument().content).toHaveLength(1);

    const document = textToSongDocument('Une phrase assez longue pour devenir le titre du nouveau morceau');
    expect(deriveSongTitle(document, 24)).toBe('Une phrase assez longue…');
  });
});
