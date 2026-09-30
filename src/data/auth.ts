import type { Session, User } from '@supabase/supabase-js';

import { supabase } from '../lib/supabase';
import type { Database } from '../types/database.types';
import { DataError, fromAuthError, fromPostgrestError } from './errors';

// Re-exported so hooks/UI get everything auth-related from one module,
// without importing '@supabase/supabase-js' themselves (type-only imports
// are fine either way — the lint boundary is about the runtime client).
export type { Session, User };

export type Profile = {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  phoneNumber: string | null;
};

function toProfile(row: Database['public']['Tables']['profiles']['Row']): Profile {
  return {
    id: row.id,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
    phoneNumber: row.phone_number,
  };
}

export type SignUpResult = {
  userId: string;
  /**
   * False when a confirmation email must be clicked before the account can
   * sign in (local dev has confirmations off, so this is always true there —
   * see supabase/config.toml `[auth.email] enable_confirmations`).
   */
  signedIn: boolean;
};

export async function signUp(email: string, password: string): Promise<SignUpResult> {
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw fromAuthError(error);
  if (!data.user) throw new DataError('unknown', 'signUp returned no user');
  return { userId: data.user.id, signedIn: data.session !== null };
}

export async function signIn(email: string, password: string): Promise<void> {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw fromAuthError(error);
}

export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut();
  if (error) throw fromAuthError(error);
}

export async function getSession(): Promise<Session | null> {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw fromAuthError(error);
  return data.session;
}

/** Subscribe to auth state changes (sign in, sign out, token refresh). Returns an unsubscribe function. */
export function onAuthStateChange(callback: (session: Session | null) => void): () => void {
  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange((_event, session) => callback(session));
  return () => subscription.unsubscribe();
}

export async function getProfile(userId: string): Promise<Profile> {
  const { data, error } = await supabase.from('profiles').select().eq('id', userId).single();
  if (error) throw fromPostgrestError(error);
  return toProfile(data);
}

export type ProfileUpdate = {
  displayName?: string;
  phoneNumber?: string | null;
  avatarUrl?: string | null;
};

export async function updateProfile(userId: string, patch: ProfileUpdate): Promise<Profile> {
  const row: Database['public']['Tables']['profiles']['Update'] = {};
  if (patch.displayName !== undefined) row.display_name = patch.displayName;
  if (patch.phoneNumber !== undefined) row.phone_number = patch.phoneNumber;
  if (patch.avatarUrl !== undefined) row.avatar_url = patch.avatarUrl;

  const { data, error } = await supabase.from('profiles').update(row).eq('id', userId).select().single();
  if (error) {
    // A single UPDATE can only trip one constraint. If phoneNumber was part
    // of the patch, a check violation must be the phone format check —
    // there is no other checked column being written in that call.
    throw fromPostgrestError(error, {
      uniqueViolation: 'phone_number_taken',
      checkViolation: patch.phoneNumber !== undefined ? 'invalid_phone_number' : 'invalid_display_name',
    });
  }
  return toProfile(data);
}
