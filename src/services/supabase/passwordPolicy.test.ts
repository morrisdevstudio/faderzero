import { describe, expect, it } from 'vitest';
import { assertValidPassword, getPasswordRequirements, isPasswordValid } from '@/services/supabase/passwordPolicy';

describe('politique de mot de passe', () => {
  it('accepte les quatre règles obligatoires', () => {
    expect(getPasswordRequirements('Fader123')).toEqual({
      minimumLength: true,
      lowercase: true,
      uppercase: true,
      digit: true,
    });
    expect(isPasswordValid('Fader123')).toBe(true);
  });

  it.each(['court1A', 'FADER123', 'fader123', 'FaderZero'])('refuse une règle manquante pour %s', (password) => {
    expect(isPasswordValid(password)).toBe(false);
    expect(() => assertValidPassword(password)).toThrow('une majuscule, une minuscule et un chiffre');
  });
});
