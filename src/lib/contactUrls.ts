function trimmed(value: string | undefined) {
  return value?.trim() || undefined;
}

export function formatContactPhone(value: string | undefined) {
  const digits = value?.replace(/\D/g, '') ?? '';
  if (/^\s*\+/.test(value ?? '')) {
    if (/^33[1-9]\d{8}$/.test(digits)) {
      const frenchNumber = digits.slice(2);
      return `+33 ${frenchNumber[0]} ${frenchNumber.slice(1).match(/.{1,2}/g)?.join(' ')}`;
    }
    return digits ? `+${digits}` : '';
  }
  return digits.match(/.{1,2}/g)?.join(' ') ?? '';
}

export function normalizeWebsiteUrl(value: string | undefined) {
  const input = trimmed(value);
  if (!input) return undefined;
  if (/^https?:\/\//i.test(input)) return input;
  if (input.startsWith('//')) return `https:${input}`;
  return `https://${input.replace(/^\/+/, '')}`;
}

function normalizeSocialProfile(value: string | undefined, domain: 'instagram.com' | 'facebook.com') {
  const input = trimmed(value);
  if (!input) return undefined;
  if (/^https?:\/\//i.test(input)) return input;

  const withoutProtocol = input.replace(/^\/+/, '');
  if (new RegExp(`^(?:www\\.)?${domain.replace('.', '\\.')}/`, 'i').test(withoutProtocol)) {
    return `https://${withoutProtocol}`;
  }

  const profile = withoutProtocol.replace(/^@/, '').replace(/^\/+|\/+$/g, '').replace(/\s+/g, '');
  return profile ? `https://www.${domain}/${profile}` : undefined;
}

export function normalizeInstagramUrl(value: string | undefined) {
  return normalizeSocialProfile(value, 'instagram.com');
}

export function normalizeFacebookUrl(value: string | undefined) {
  return normalizeSocialProfile(value, 'facebook.com');
}
