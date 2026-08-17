import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { FaderLogo } from './FaderLogo';

describe('FaderLogo', () => {
  it('renders complete SVG logo with fader icon and text elements', () => {
    const { container } = render(<FaderLogo className="h-10 text-white" />);
    const svg = container.querySelector('svg');

    expect(svg).toBeInTheDocument();
    expect(svg).toHaveAttribute('viewBox', '0 0 96 40');
    expect(svg).toHaveAttribute('aria-hidden', 'true');
    expect(svg).toHaveClass('h-10', 'text-white');

    const rects = container.querySelectorAll('rect');
    expect(rects.length).toBe(2);

    const texts = container.querySelectorAll('text');
    expect(texts.length).toBe(2);
    expect(texts[0]).toHaveTextContent('FADER');
    expect(texts[1]).toHaveTextContent('ZERO');
  });
});
