const MAX_LENGTH = 40;

/**
 * Default display name for a new profile, derived from the sign-up email.
 * The user can change it later; this only needs to be readable and non-empty.
 */
export function defaultDisplayName(email: string | null | undefined): string {
  const local = email?.split('@')[0]?.trim() ?? '';
  if (!local) return 'User';
  return local.slice(0, MAX_LENGTH);
}
