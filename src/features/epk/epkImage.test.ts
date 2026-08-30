import { describe, expect, it } from 'vitest';
import { EPK_HERO_IMAGE_SIZE, EPK_PHOTO_IMAGE_SIZE, fitEpkImageSize } from './epkImage';

describe('EPK image sizing', () => {
  it('keeps a hero image within its display bounds', () => {
    expect(fitEpkImageSize(6000, 4000, EPK_HERO_IMAGE_SIZE)).toEqual({ width: 2025, height: 1350 });
  });

  it('keeps a photo within its display bounds without enlarging it', () => {
    expect(fitEpkImageSize(800, 600, EPK_PHOTO_IMAGE_SIZE)).toEqual({ width: 800, height: 600 });
    expect(fitEpkImageSize(4000, 2000, EPK_PHOTO_IMAGE_SIZE)).toEqual({ width: 1600, height: 800 });
  });
});
