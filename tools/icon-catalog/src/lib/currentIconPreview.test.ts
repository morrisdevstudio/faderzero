import { describe, expect, it } from 'vitest';
import { resolveCurrentIconPreview, resolveSpriteSymbolId } from './currentIconPreview';

describe('resolveCurrentIconPreview', () => {
  it.each([
    [{ source: 'public/favicon.svg', format: 'svg' }, '/favicon.svg'],
    [{ source: '/pwa-192x192.png', format: 'png' }, '/pwa-192x192.png'],
    [{ source: 'apple-touch-icon.png', format: 'png' }, '/apple-touch-icon.png'],
  ])('normalise %o', (occurrence, url) => {
    expect(resolveCurrentIconPreview(occurrence)).toMatchObject({ status: 'available', url });
  });

  it.each(['../secret.svg', '..\\secret.svg', 'C:\\secret.svg', 'https://example.com/icon.svg'])('refuse %s', (source) => {
    expect(resolveCurrentIconPreview({ source, format: 'svg' })).toMatchObject({ status: 'unavailable' });
  });

  it('refuse une extension non autorisée', () => {
    expect(resolveCurrentIconPreview({ source: 'public/icon.gif', format: 'gif' })).toMatchObject({
      status: 'unavailable', reason: 'Format non pris en charge',
    });
  });

  it.each([
    [{ format: 'react-component', name: 'CalendarIcon' }, 'Rendu dépendant des propriétés React'],
    [{ format: 'inline-svg' }, 'SVG dynamique non extractible statiquement'],
    [{ format: 'svg-sprite', source: 'public/icons.svg' }, 'Symbole de sprite — traitement prévu ultérieurement'],
    [{}, 'Source non identifiée'],
  ])('décrit les formats reportés : %o', (occurrence, reason) => {
    expect(resolveCurrentIconPreview(occurrence)).toEqual({ status: 'unavailable', reason });
  });
});

describe('resolveSpriteSymbolId', () => {
  it.each([
    ['#calendar', 'calendar'],
    ['/icons.svg#calendar', 'calendar'],
    ['public/icons.svg#songs', 'songs'],
    ['#live-menu', 'live-menu'],
    ['#live_menu', 'live_menu'],
  ])('lit le fragment %s', (value, expected) => expect(resolveSpriteSymbolId(value)).toBe(expected));

  it.each(['icons.svg', '../secret', 'calendar/secret', 'calendar#other', ''])('refuse %s', (value) => expect(resolveSpriteSymbolId(value)).toBeUndefined());

  it('construit une URL de sprite sans deviner le symbole', () => {
    expect(resolveCurrentIconPreview({ source: '/icons.svg#calendar', format: 'svg-sprite' })).toMatchObject({
      status: 'available', type: 'sprite', symbolId: 'calendar', url: '/api/icon-sprite/calendar',
    });
  });
});

it('construit l’URL de prévisualisation d’un SVG inline', () => {
  expect(resolveCurrentIconPreview({ occurrenceId: 'inline_1', format: 'inline-svg' })).toMatchObject({ status: 'available', type: 'inline', url: '/api/icon-inline/inline_1' });
});
it('construit l’URL de prévisualisation d’un composant React', () => {
  expect(resolveCurrentIconPreview({ occurrenceId: 'react_1', name: 'CalendarIcon', format: 'react-component' })).toMatchObject({ status: 'available', type: 'component', url: '/api/icon-component/react_1' });
});
