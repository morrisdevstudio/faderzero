import { beforeEach, describe, expect, it, vi } from 'vitest';
import { captureViewport } from './captureViewport';

const captureMock = vi.hoisted(() => vi.fn());

vi.mock('@html2canvas/html2canvas', () => ({ default: captureMock }));

function sourceCanvas(width = 1170, height = 2532): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

beforeEach(() => {
  vi.restoreAllMocks();
  captureMock.mockReset();
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 390 });
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: 844 });
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ drawImage: vi.fn() } as unknown as CanvasRenderingContext2D);
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((callback) => callback(new Blob(['webp'], { type: 'image/webp' })));
});

describe('captureViewport', () => {
  it('uses the browser-native foreignObject renderer with the exact viewport dimensions', async () => {
    captureMock.mockResolvedValueOnce(sourceCanvas());

    await expect(captureViewport()).resolves.toMatchObject({ type: 'image/webp' });

    expect(captureMock).toHaveBeenCalledOnce();
    expect(captureMock.mock.calls[0]?.[0]).toBe(document.body);
    expect(captureMock.mock.calls[0]?.[1]).toMatchObject({
      foreignObjectRendering: true,
      width: 390,
      height: 844,
      windowWidth: 390,
      windowHeight: 844,
    });
  });

  it('falls back to the compatibility renderer when native capture fails', async () => {
    captureMock.mockRejectedValueOnce(new Error('foreignObject unsupported')).mockResolvedValueOnce(sourceCanvas());

    await captureViewport();

    expect(captureMock).toHaveBeenCalledTimes(2);
    expect(captureMock.mock.calls[1]?.[1]).toMatchObject({ foreignObjectRendering: false });
  });
});
