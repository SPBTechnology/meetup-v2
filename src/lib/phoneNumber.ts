import { parsePhoneNumberFromString, type CountryCode } from 'libphonenumber-js/min';

/**
 * Normalizes a phone number to E.164, for matching against profiles.phone_number
 * (which requires strict E.164 — see the baseline schema's check constraint).
 * Device contacts are usually stored in local format with no country code, so a
 * default region is needed to resolve them. This MVP assumes a single market
 * (GB) rather than inferring the user's own region — contacts saved with an
 * explicit country code still match correctly regardless of this default.
 */
export function normalizeToE164(raw: string, defaultCountry: CountryCode = 'GB'): string | null {
  const parsed = parsePhoneNumberFromString(raw, defaultCountry);
  // isPossible (structurally plausible), not isValid (really-allocated range) —
  // the goal here is matching against stored profiles, not carrier validation,
  // and isValid rejects reserved example ranges like the UK's 07700 900xxx
  // that this project's own fixture data uses.
  if (!parsed || !parsed.isPossible()) return null;
  return parsed.number;
}
