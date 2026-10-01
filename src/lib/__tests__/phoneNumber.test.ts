import { normalizeToE164 } from '../phoneNumber';

describe('normalizeToE164', () => {
  it('leaves an already-E.164 number unchanged', () => {
    expect(normalizeToE164('+447700900123')).toBe('+447700900123');
  });

  it('resolves a local UK number using the default country', () => {
    expect(normalizeToE164('07700 900123')).toBe('+447700900123');
  });

  it('resolves a local number against an explicit default country', () => {
    expect(normalizeToE164('(212) 555-0123', 'US')).toBe('+12125550123');
  });

  it('strips formatting (spaces, dashes, parens) around a valid number', () => {
    expect(normalizeToE164('+44 7700-900123')).toBe('+447700900123');
  });

  it('returns null for text with no recognisable phone number', () => {
    expect(normalizeToE164('not a phone number')).toBeNull();
  });

  it('returns null for a too-short number', () => {
    expect(normalizeToE164('123')).toBeNull();
  });
});
