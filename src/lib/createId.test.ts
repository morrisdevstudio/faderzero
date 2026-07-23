import { afterEach, describe, expect, it, vi } from 'vitest';
import { createId } from '@/lib/createId';

const originalCrypto = globalThis.crypto;

afterEach(() => {
  vi.stubGlobal('crypto', originalCrypto);
});

describe('createId', () => {
  it('uses crypto.randomUUID when available', () => {
    vi.stubGlobal('crypto', {
      getRandomValues: originalCrypto.getRandomValues.bind(originalCrypto),
      randomUUID: () => '11111111-1111-4111-8111-111111111111',
    });

    expect(createId()).toBe('11111111-1111-4111-8111-111111111111');
  });

  it('uses crypto.getRandomValues for the secure compatibility path', () => {
    vi.stubGlobal('crypto', {
      getRandomValues: (values: Uint8Array) => {
        values.set(Array.from({ length: 16 }, (_, index) => index));
        return values;
      },
    });

    expect(createId()).toBe('00010203-0405-4607-8809-0a0b0c0d0e0f');
  });

  it('refuses to generate an identifier without Web Crypto', () => {
    vi.stubGlobal('crypto', undefined);

    expect(() => createId()).toThrow('Web Crypto is required');
  });
});
