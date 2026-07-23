export interface PasswordRequirements {
  minimumLength: boolean;
  lowercase: boolean;
  uppercase: boolean;
  digit: boolean;
}

export function getPasswordRequirements(password: string): PasswordRequirements {
  return {
    minimumLength: password.length >= 8,
    lowercase: /\p{Ll}/u.test(password),
    uppercase: /\p{Lu}/u.test(password),
    digit: /\p{Nd}/u.test(password),
  };
}

export function isPasswordValid(password: string): boolean {
  return Object.values(getPasswordRequirements(password)).every(Boolean);
}

export function assertValidPassword(password: string): void {
  if (!isPasswordValid(password)) {
    throw new Error('Le mot de passe doit contenir au moins 8 caractères, une majuscule, une minuscule et un chiffre.');
  }
}
