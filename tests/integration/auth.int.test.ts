import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

import { defaultDisplayName } from '../../src/lib/displayName';
import { cleanupTestUsers, createTestUser, SUPABASE_URL, trackUserForCleanup } from './helpers';

afterEach(cleanupTestUsers);

function publicClient() {
  const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
  return createClient(SUPABASE_URL, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

describe('auth against local Supabase', () => {
  it('a created test user is signed in as themselves', async () => {
    const user = await createTestUser('auth');

    const { data, error } = await user.client.auth.getUser();

    expect(error).toBeNull();
    expect(data.user?.id).toBe(user.id);
    expect(data.user?.email).toBe(user.email);
  });

  it('two test users get distinct identities', async () => {
    const a = await createTestUser('a');
    const b = await createTestUser('b');

    expect(a.id).not.toBe(b.id);
  });
});

// These exercise the real self-serve `auth.signUp()` path (as opposed to
// `createTestUser`'s admin.createUser, used elsewhere for convenience) to pin
// down the exact contract src/data/auth.ts and src/data/errors.ts assume:
// local confirmations are off, so signUp returns a session immediately; a
// second signUp with the same email fails in a specific, mappable way.
describe('self-serve sign-up (the path src/data/auth.ts uses)', () => {
  it('returns a session immediately and the trigger creates a matching profile', async () => {
    const client = publicClient();
    const email = `test-signup-${randomUUID()}@example.test`;

    const { data, error } = await client.auth.signUp({ email, password: 'Test-password-1!' });

    expect(error).toBeNull();
    expect(data.user).not.toBeNull();
    expect(data.session).not.toBeNull(); // confirmations disabled locally — see supabase/config.toml
    trackUserForCleanup(data.user!.id, client);

    const { data: profile, error: profileError } = await client
      .from('profiles')
      .select('id, display_name')
      .single();
    expect(profileError).toBeNull();
    // Same rule the DB trigger and src/lib/displayName.ts both implement,
    // including the 40-char cap — this email's local part is longer than that.
    expect(profile).toEqual({ id: data.user!.id, display_name: defaultDisplayName(email) });
  });

  it('signing up twice with the same email fails with user_already_exists', async () => {
    const client = publicClient();
    const email = `test-dupe-${randomUUID()}@example.test`;

    const first = await client.auth.signUp({ email, password: 'Test-password-1!' });
    expect(first.error).toBeNull();
    trackUserForCleanup(first.data.user!.id, client);

    const { error } = await client.auth.signUp({ email, password: 'Test-password-1!' });

    // Confirmed against the real local stack: unlike some hosted GoTrue
    // configurations, local dev does not mask this to protect email
    // enumeration — it returns a real, mappable error. fromAuthError() maps
    // this exact code to 'email_already_registered' (see errors.test.ts).
    expect(error?.code).toBe('user_already_exists');
  });

  it('signing in with the wrong password fails with invalid_credentials', async () => {
    const client = publicClient();
    const email = `test-badpw-${randomUUID()}@example.test`;
    const signUp = await client.auth.signUp({ email, password: 'Test-password-1!' });
    trackUserForCleanup(signUp.data.user!.id, client);
    await client.auth.signOut();

    const { error } = await client.auth.signInWithPassword({ email, password: 'wrong-password' });

    expect(error?.code).toBe('invalid_credentials');
  });
});

describe('profile updates through the real API (matches src/data/auth.updateProfile)', () => {
  it('rejects a phone number already used by another profile', async () => {
    const a = await createTestUser('phone-a');
    const b = await createTestUser('phone-b');
    const phone = '+447700900123';

    const first = await a.client.from('profiles').update({ phone_number: phone }).eq('id', a.id);
    expect(first.error).toBeNull();

    const { error } = await b.client.from('profiles').update({ phone_number: phone }).eq('id', b.id);

    expect(error?.code).toBe('23505'); // fromPostgrestError() switches on this
  });

  it('rejects a phone number that is not E.164', async () => {
    const user = await createTestUser('phone-format');

    const { error } = await user.client.from('profiles').update({ phone_number: '07700 900123' }).eq('id', user.id);

    expect(error?.code).toBe('23514'); // fromPostgrestError() switches on this
  });
});
