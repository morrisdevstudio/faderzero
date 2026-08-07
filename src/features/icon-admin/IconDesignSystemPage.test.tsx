import { describe, expect, it } from 'vitest';
import { legacySvgUrl } from './IconDesignSystemPage';

describe('legacySvgUrl', () => {
  it('adds the SVG namespace required by image decoders', () => {
    const url = legacySvgUrl('<svg viewBox="0 0 24 24"><path d="M4 12h16" /></svg>');

    expect(url).not.toBeNull();
    expect(decodeURIComponent(url!)).toContain('<svg xmlns="http://www.w3.org/2000/svg"');
  });

  it('ignores sources that are not inline SVG markup', () => {
    expect(legacySvgUrl('/favicon.svg')).toBeNull();
  });
});
