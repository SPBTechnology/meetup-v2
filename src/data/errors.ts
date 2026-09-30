import { AuthApiError, AuthError } from '@supabase/supabase-js';
import type { PostgrestError } from '@supabase/supabase-js';

// Stable, UI-facing error codes. Screens switch on `code`, never on `.message`
// text (message text is not a stable contract — see conventions.md).
export type DataErrorCode =
  // Generic
  | 'not_authenticated'
  | 'network_error'
  | 'unknown'
  // Sign up / sign in
  | 'invalid_credentials'
  | 'email_already_registered'
  | 'weak_password'
  | 'invalid_email'
  | 'email_not_confirmed'
  | 'rate_limited'
  // Profile
  | 'phone_number_taken'
  | 'invalid_phone_number'
  | 'invalid_display_name'
  // Conversations / invites (RPC contract — see data-model.md)
  | 'not_a_member'
  | 'too_many_users'
  | 'too_many_numbers'
  | 'invite_not_found'
  | 'invite_revoked'
  | 'invite_expired'
  | 'invite_exhausted';

export class DataError extends Error {
  readonly code: DataErrorCode;
  readonly cause?: unknown;

  constructor(code: DataErrorCode, message?: string, cause?: unknown) {
    super(message ?? code);
    this.name = 'DataError';
    this.code = code;
    this.cause = cause;
  }
}

export function isDataError(err: unknown): err is DataError {
  return err instanceof DataError;
}

// Postgres error codes (SQLSTATE) raised by CHECK/UNIQUE constraints that the
// data layer needs to distinguish. See supabase/migrations for what raises them.
const PG_UNIQUE_VIOLATION = '23505';
const PG_CHECK_VIOLATION = '23514';

// RPC functions in the baseline migration raise a stable snake_case message
// via `raise exception '<code>'` (data-model.md's RPC contract table). This
// maps those straight through; anything unrecognised falls back to 'unknown'.
const RPC_MESSAGE_CODES: ReadonlySet<DataErrorCode> = new Set([
  'not_authenticated',
  'not_a_member',
  'too_many_users',
  'too_many_numbers',
  'invite_not_found',
  'invite_revoked',
  'invite_expired',
  'invite_exhausted',
]);

/** Map a Supabase Auth error to a DataError. */
export function fromAuthError(err: AuthError): DataError {
  if (err instanceof AuthApiError) {
    switch (err.code) {
      case 'invalid_credentials':
        return new DataError('invalid_credentials', undefined, err);
      case 'user_already_exists':
      case 'email_exists':
        return new DataError('email_already_registered', undefined, err);
      case 'weak_password':
        return new DataError('weak_password', undefined, err);
      case 'email_address_invalid':
      case 'validation_failed':
        return new DataError('invalid_email', undefined, err);
      case 'email_not_confirmed':
        return new DataError('email_not_confirmed', undefined, err);
      case 'over_request_rate_limit':
      case 'over_email_send_rate_limit':
        return new DataError('rate_limited', undefined, err);
      default:
        return new DataError('unknown', err.message, err);
    }
  }
  // AuthRetryableFetchError and friends: no HTTP response reached the server.
  return new DataError('network_error', err.message, err);
}

/**
 * Map a PostgrestError (table calls and RPCs both surface one) to a DataError.
 * `context` disambiguates constraints that mean different things in different
 * calls (e.g. a unique violation is a taken phone number when updating a
 * profile, but would mean something else elsewhere).
 */
export function fromPostgrestError(
  err: PostgrestError,
  context?: { uniqueViolation?: DataErrorCode; checkViolation?: DataErrorCode },
): DataError {
  if (RPC_MESSAGE_CODES.has(err.message as DataErrorCode)) {
    return new DataError(err.message as DataErrorCode, undefined, err);
  }
  if (err.code === PG_UNIQUE_VIOLATION && context?.uniqueViolation) {
    return new DataError(context.uniqueViolation, undefined, err);
  }
  if (err.code === PG_CHECK_VIOLATION && context?.checkViolation) {
    return new DataError(context.checkViolation, undefined, err);
  }
  if (err.code === '42501') {
    return new DataError('not_authenticated', undefined, err);
  }
  return new DataError('unknown', err.message, err);
}
