import type { DataErrorCode } from '../data/errors';

/**
 * User-facing copy for a DataError code. The switch is exhaustive (the
 * `never` check fails to typecheck) so adding a new DataErrorCode without
 * giving it copy here is a compile error, not a silent "Something went wrong."
 */
export function describeDataError(code: DataErrorCode): string {
  switch (code) {
    case 'invalid_credentials':
      return 'Incorrect email or password.';
    case 'email_already_registered':
      return 'An account with that email already exists. Try signing in instead.';
    case 'weak_password':
      return 'Choose a stronger password (at least 8 characters).';
    case 'invalid_email':
      return 'That email address doesn’t look right.';
    case 'email_not_confirmed':
      return 'Confirm your email address before signing in.';
    case 'rate_limited':
      return 'Too many attempts. Wait a moment and try again.';
    case 'not_authenticated':
      return 'You’ve been signed out. Sign in again to continue.';
    case 'network_error':
      return 'Can’t reach the server. Check your connection and try again.';
    case 'phone_number_taken':
      return 'That phone number is already linked to another account.';
    case 'invalid_phone_number':
      return 'Enter your phone number in international format, e.g. +447700900123.';
    case 'invalid_display_name':
      return 'Enter a name between 1 and 40 characters.';
    case 'not_a_member':
      return 'You’re not a member of this conversation.';
    case 'too_many_users':
    case 'too_many_numbers':
      return 'That’s too many at once. Try a smaller batch.';
    case 'invite_not_found':
      return 'That invite code doesn’t exist.';
    case 'invite_revoked':
      return 'That invite has been cancelled.';
    case 'invite_expired':
      return 'That invite has expired.';
    case 'invite_exhausted':
      return 'That invite has already been used.';
    case 'unknown':
      return 'Something went wrong. Please try again.';
    default: {
      const exhaustive: never = code;
      return exhaustive;
    }
  }
}
