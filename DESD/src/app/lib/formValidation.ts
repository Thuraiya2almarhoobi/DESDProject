export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export const PHONE_PATTERN = /^(?:\+44\s?7\d{3}|\(?07\d{3}\)?|\+44\s?\d{2,4}|0\d{2,4})[\s-]?\d{3,4}[\s-]?\d{3,4}$/;
export const URL_PATTERN = /^https?:\/\/[^\s/$.?#].[^\s]*$/i;

export function isValidEmail(value: string): boolean {
  return EMAIL_PATTERN.test(value.trim());
}

export function isValidPhone(value: string): boolean {
  const normalized = value.trim().replace(/[().]/g, '').replace(/\s+/g, ' ');
  const digits = normalized.replace(/[^\d]/g, '');
  return PHONE_PATTERN.test(normalized) && digits.length >= 10 && digits.length <= 13;
}

export function isValidOptionalUrl(value: string): boolean {
  const trimmed = value.trim();
  return !trimmed || URL_PATTERN.test(trimmed);
}

export function hasMinWords(value: string, minWords: number): boolean {
  return value.trim().split(/\s+/).filter(Boolean).length >= minWords;
}

export function validateRequiredText(value: string, label: string, minLength = 2): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return `${label} is required.`;
  }
  if (trimmed.length < minLength) {
    return `${label} must be at least ${minLength} characters.`;
  }
  return '';
}
