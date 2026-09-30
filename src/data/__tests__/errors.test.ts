import { AuthApiError, AuthRetryableFetchError } from '@supabase/supabase-js';

import { pgError } from '../../test-utils/supabaseFixtures';
import { DataError, fromAuthError, fromPostgrestError, isDataError } from '../errors';

describe('DataError / isDataError', () => {
  it('is a real Error with a stable code', () => {
    const err = new DataError('invite_expired', 'nope');
    expect(isDataError(err)).toBe(true);
    expect(err).toBeInstanceOf(Error);
    expect(err.code).toBe('invite_expired');
  });

  it('rejects non-DataErrors', () => {
    expect(isDataError(new Error('plain'))).toBe(false);
    expect(isDataError('invite_expired')).toBe(false);
  });
});

describe('fromAuthError', () => {
  it.each([
    ['invalid_credentials', 'invalid_credentials'],
    ['user_already_exists', 'email_already_registered'],
    ['email_exists', 'email_already_registered'],
    ['weak_password', 'weak_password'],
    ['email_address_invalid', 'invalid_email'],
    ['validation_failed', 'invalid_email'],
    ['email_not_confirmed', 'email_not_confirmed'],
    ['over_request_rate_limit', 'rate_limited'],
    ['over_email_send_rate_limit', 'rate_limited'],
  ] as const)('maps auth-js code %s to %s', (authCode, expected) => {
    const err = new AuthApiError('message', 400, authCode);
    expect(fromAuthError(err).code).toBe(expected);
  });

  it('falls back to unknown for an unrecognised API error code', () => {
    const err = new AuthApiError('some new failure', 400, 'brand_new_code_from_future_supabase');
    const mapped = fromAuthError(err);
    expect(mapped.code).toBe('unknown');
    expect(mapped.cause).toBe(err);
  });

  it('maps a retryable fetch error to network_error', () => {
    const err = new AuthRetryableFetchError('fetch failed', 0);
    expect(fromAuthError(err).code).toBe('network_error');
  });
});

describe('fromPostgrestError', () => {
  it('passes through a recognised RPC message code unchanged', () => {
    const err = pgError('P0001', 'invite_expired');
    expect(fromPostgrestError(err).code).toBe('invite_expired');
  });

  it('maps a unique violation using the caller-supplied context', () => {
    const err = pgError('23505', 'duplicate key value violates unique constraint "profiles_phone_number_key"');
    const mapped = fromPostgrestError(err, { uniqueViolation: 'phone_number_taken' });
    expect(mapped.code).toBe('phone_number_taken');
  });

  it('maps a check violation using the caller-supplied context', () => {
    const err = pgError('23514', 'new row violates check constraint "profiles_phone_number_check"');
    const mapped = fromPostgrestError(err, { checkViolation: 'invalid_phone_number' });
    expect(mapped.code).toBe('invalid_phone_number');
  });

  it('falls back to unknown when no context is given for a constraint violation', () => {
    const err = pgError('23505', 'duplicate key');
    expect(fromPostgrestError(err).code).toBe('unknown');
  });

  it('maps a permission-denied error to not_authenticated', () => {
    const err = pgError('42501', 'permission denied for table profiles');
    expect(fromPostgrestError(err).code).toBe('not_authenticated');
  });

  it('falls back to unknown for anything else, keeping the original message', () => {
    const err = pgError('57014', 'canceling statement due to statement timeout');
    const mapped = fromPostgrestError(err);
    expect(mapped.code).toBe('unknown');
    expect(mapped.message).toBe('canceling statement due to statement timeout');
  });
});
