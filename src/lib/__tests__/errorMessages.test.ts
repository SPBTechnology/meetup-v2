import type { DataErrorCode } from '../../data/errors';
import { describeDataError } from '../errorMessages';

// The exhaustive switch in errorMessages.ts is the real guarantee that every
// code has copy; this test just proves the function is callable and returns
// non-empty text end to end for a representative sample.
describe('describeDataError', () => {
  it.each<DataErrorCode>([
    'invalid_credentials',
    'email_already_registered',
    'weak_password',
    'not_authenticated',
    'network_error',
    'phone_number_taken',
    'invalid_phone_number',
    'unknown',
  ])('returns non-empty, human copy for %s', (code) => {
    const message = describeDataError(code);
    expect(typeof message).toBe('string');
    expect(message.length).toBeGreaterThan(0);
    expect(message).not.toBe(code);
  });
});
