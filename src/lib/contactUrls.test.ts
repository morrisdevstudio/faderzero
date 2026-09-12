import { describe, expect, it } from 'vitest';
import {
  CONTACT_CHANNEL_ERROR_MESSAGE,
  formatContactPhone,
  hasContactChannel,
  normalizeFacebookUrl,
  normalizeInstagramUrl,
  normalizeWebsiteUrl,
} from './contactUrls';

describe('contactUrls', () => {
  describe('formatContactPhone', () => {
    it('formats 10-digit french phone numbers', () => {
      expect(formatContactPhone('0612345678')).toBe('06 12 34 56 78');
    });

    it('formats international french phone numbers', () => {
      expect(formatContactPhone('+33612345678')).toBe('+33 6 12 34 56 78');
    });
  });

  describe('normalizeWebsiteUrl', () => {
    it('prepends https:// when missing', () => {
      expect(normalizeWebsiteUrl('lechabada.com')).toBe('https://lechabada.com');
      expect(normalizeWebsiteUrl('https://lechabada.com')).toBe('https://lechabada.com');
    });
  });

  describe('normalizeInstagramUrl', () => {
    it('normalizes handles and links', () => {
      expect(normalizeInstagramUrl('@chabada_angers')).toBe('https://www.instagram.com/chabada_angers');
      expect(normalizeInstagramUrl('https://instagram.com/chabada')).toBe('https://instagram.com/chabada');
    });
  });

  describe('normalizeFacebookUrl', () => {
    it('normalizes handles and links', () => {
      expect(normalizeFacebookUrl('chabada.angers')).toBe('https://www.facebook.com/chabada.angers');
    });
  });

  describe('hasContactChannel', () => {
    it('returns true when phone is provided', () => {
      expect(hasContactChannel({ phone: '06 12 34 56 78' })).toBe(true);
    });

    it('returns true when email is provided', () => {
      expect(hasContactChannel({ email: 'contact@lechabada.com' })).toBe(true);
    });

    it('returns true when instagramUrl is provided', () => {
      expect(hasContactChannel({ instagramUrl: '@chabada' })).toBe(true);
    });

    it('returns true when facebookUrl is provided', () => {
      expect(hasContactChannel({ facebookUrl: 'chabada' })).toBe(true);
    });

    it('returns false when none are provided or only whitespace', () => {
      expect(hasContactChannel({})).toBe(false);
      expect(hasContactChannel({ phone: '', email: '   ', instagramUrl: undefined, facebookUrl: '' })).toBe(false);
    });

    it('exports the expected error message', () => {
      expect(CONTACT_CHANNEL_ERROR_MESSAGE).toBe(
        'Renseigne au moins un moyen de contact : téléphone, e-mail, Instagram ou Facebook.',
      );
    });
  });
});
