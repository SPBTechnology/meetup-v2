import { defaultDisplayName } from '../displayName';

describe('defaultDisplayName', () => {
  it('uses the local part of the email', () => {
    expect(defaultDisplayName('stephen@example.com')).toBe('stephen');
  });

  it('falls back to "User" when there is no usable email', () => {
    expect(defaultDisplayName(null)).toBe('User');
    expect(defaultDisplayName(undefined)).toBe('User');
    expect(defaultDisplayName('')).toBe('User');
    expect(defaultDisplayName('@example.com')).toBe('User');
  });

  it('caps the length at 40 characters', () => {
    const long = 'a'.repeat(60) + '@example.com';
    expect(defaultDisplayName(long)).toHaveLength(40);
  });
});
