import { describe, expect, it } from 'vitest';
import { createStandaloneSpriteSvg, isSafeSpriteSymbolId, SpritePreviewError } from '../spritePreview';

const fixture = `<svg viewBox="0 0 32 32"><symbol id="calendar" viewBox="0 0 24 24"><g stroke="currentColor"><path d="M1 2"/><rect x="2" y="3" width="4" height="5"/></g></symbol><symbol id="other" viewBox="0 0 8 8"><circle cx="4" cy="4" r="3"/></symbol></svg>`;

describe('sprite preview generator', () => {
  it('extrait uniquement le symbole demandé dans un SVG autonome', () => {
    const svg = createStandaloneSpriteSvg(fixture, 'calendar');
    expect(svg).toContain('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">');
    expect(svg).toContain('stroke="currentColor"');
    expect(svg).toContain('<path d="M1 2"/>');
    expect(svg).not.toContain('id="other"');
    expect(svg).not.toContain('<circle');
    expect(svg).toMatch(/^<svg\b[\s\S]*<\/svg>$/);
  });

  it.each(['calendar', 'with-dash', 'with_underscore'])('accepte un identifiant sûr : %s', (id) => expect(isSafeSpriteSymbolId(id)).toBe(true));
  it.each(['../secret', 'calendar/secret', 'calendar#other', 'C:\\sprite', ''])('refuse un identifiant dangereux : %s', (id) => expect(isSafeSpriteSymbolId(id)).toBe(false));
  it('signale un symbole inconnu', () => {
    try { createStandaloneSpriteSvg(fixture, 'missing'); } catch (error) { expect((error as SpritePreviewError).code).toBe('SYMBOL_NOT_FOUND'); return; }
    throw new Error('Le symbole inconnu a été accepté.');
  });
  it.each([
    ['<script>alert(1)</script>', 'script'],
    ['<path onload="alert(1)"/>', 'event'],
    ['<foreignObject/>', 'foreignObject'],
    ['<use href="https://example.test/icon.svg"/>', 'external'],
  ])('refuse une construction non sûre : %s', (content) => {
    const sprite = `<svg><symbol id="calendar" viewBox="0 0 24 24">${content}</symbol></svg>`;
    try { createStandaloneSpriteSvg(sprite, 'calendar'); } catch (error) {
      expect(error).toBeInstanceOf(SpritePreviewError);
      expect((error as SpritePreviewError).code).toBe('SPRITE_INVALID');
      return;
    }
    throw new Error('Le sprite dangereux a été accepté.');
  });
  it('refuse un sprite invalide', () => {
    try { createStandaloneSpriteSvg('<svg><symbol id="calendar">', 'calendar'); } catch (error) { expect((error as SpritePreviewError).code).toBe('SPRITE_INVALID'); return; }
    throw new Error('Le sprite invalide a été accepté.');
  });
});
