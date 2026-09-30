import { AuthApiError } from '@supabase/supabase-js';
import type { PostgrestError } from '@supabase/supabase-js';

import { supabase } from '../../lib/supabase';
import { fakeSession, fakeUser, pgError } from '../../test-utils/supabaseFixtures';
import * as auth from '../auth';
import { isDataError } from '../errors';

// src/lib/supabase.ts validates env vars and registers an AppState listener
// at module load — neither of which belongs in a unit test. Mock it with a
// fake client shape instead of importing the real thing. jest.mock calls are
// hoisted above imports by babel-plugin-jest-hoist, so `supabase` above
// already resolves to this mock regardless of source order.
jest.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      signUp: jest.fn(),
      signInWithPassword: jest.fn(),
      signOut: jest.fn(),
      getSession: jest.fn(),
      onAuthStateChange: jest.fn(),
    },
    from: jest.fn(),
  },
}));

// A fluent mock matching the one chain shape auth.ts actually uses:
// .from(table).select().eq(col, val).single()  and  .from(table).update(row).eq(col, val).select().single()
function queryResult(result: { data?: unknown; error?: PostgrestError | null }) {
  const builder: Record<string, jest.Mock> = {};
  builder.select = jest.fn(() => builder);
  builder.update = jest.fn(() => builder);
  builder.eq = jest.fn(() => builder);
  builder.single = jest.fn(() => Promise.resolve({ data: result.data ?? null, error: result.error ?? null }));
  return builder;
}

const PROFILE_ROW = {
  id: 'user-1',
  display_name: 'Alice',
  avatar_url: null,
  phone_number: '+447700900001',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

describe('auth.ts', () => {
  const mockAuth = supabase.auth as jest.Mocked<typeof supabase.auth>;
  const mockFrom = supabase.from as jest.Mock;

  afterEach(() => jest.clearAllMocks());

  describe('signUp', () => {
    it('reports signedIn: true when a session comes back immediately (confirmations off)', async () => {
      const user = fakeUser({ id: 'user-1' });
      mockAuth.signUp.mockResolvedValue({ data: { user, session: fakeSession({ user }) }, error: null });

      const result = await auth.signUp('a@example.test', 'Password1!');

      expect(result).toEqual({ userId: 'user-1', signedIn: true });
      expect(mockAuth.signUp).toHaveBeenCalledWith({ email: 'a@example.test', password: 'Password1!' });
    });

    it('reports signedIn: false when email confirmation is required', async () => {
      mockAuth.signUp.mockResolvedValue({
        data: { user: fakeUser({ id: 'user-1' }), session: null },
        error: null,
      });

      const result = await auth.signUp('a@example.test', 'Password1!');

      expect(result.signedIn).toBe(false);
    });

    it('throws a mapped DataError on failure', async () => {
      mockAuth.signUp.mockResolvedValue({
        data: { user: null, session: null },
        error: new AuthApiError('exists', 400, 'user_already_exists'),
      });

      await expect(auth.signUp('a@example.test', 'Password1!')).rejects.toMatchObject({
        code: 'email_already_registered',
      });
    });
  });

  describe('signIn', () => {
    it('resolves on success', async () => {
      const user = fakeUser();
      mockAuth.signInWithPassword.mockResolvedValue({ data: { user, session: fakeSession({ user }) }, error: null });
      await expect(auth.signIn('a@example.test', 'Password1!')).resolves.toBeUndefined();
    });

    it('throws a mapped DataError on failure', async () => {
      mockAuth.signInWithPassword.mockResolvedValue({
        data: { user: null, session: null },
        error: new AuthApiError('bad creds', 400, 'invalid_credentials'),
      });

      const err = await auth.signIn('a@example.test', 'wrong').catch((e: unknown) => e);
      expect(isDataError(err) && err.code).toBe('invalid_credentials');
    });
  });

  describe('signOut', () => {
    it('resolves on success and throws a mapped error on failure', async () => {
      mockAuth.signOut.mockResolvedValue({ error: null });
      await expect(auth.signOut()).resolves.toBeUndefined();

      mockAuth.signOut.mockResolvedValue({ error: new AuthApiError('gone', 401, 'session_not_found') });
      await expect(auth.signOut()).rejects.toMatchObject({ code: 'unknown' });
    });
  });

  describe('getSession', () => {
    it('returns the session, or null when signed out', async () => {
      const session = fakeSession();
      mockAuth.getSession.mockResolvedValue({ data: { session }, error: null });
      await expect(auth.getSession()).resolves.toEqual(session);

      mockAuth.getSession.mockResolvedValue({ data: { session: null }, error: null });
      await expect(auth.getSession()).resolves.toBeNull();
    });
  });

  describe('onAuthStateChange', () => {
    it('forwards the session to the callback and unsubscribes cleanly', () => {
      const unsubscribe = jest.fn();
      type Callback = Parameters<typeof supabase.auth.onAuthStateChange>[0];
      let registered: Callback | undefined;
      mockAuth.onAuthStateChange.mockImplementation((cb) => {
        registered = cb;
        return { data: { subscription: { id: 'sub-1', callback: cb, unsubscribe } } };
      });

      const callback = jest.fn();
      const stop = auth.onAuthStateChange(callback);
      const session = fakeSession();
      void registered!('SIGNED_IN', session);
      expect(callback).toHaveBeenCalledWith(session);

      stop();
      expect(unsubscribe).toHaveBeenCalled();
    });
  });

  describe('getProfile', () => {
    it('maps the DB row to a Profile (snake_case to camelCase)', async () => {
      mockFrom.mockReturnValue(queryResult({ data: PROFILE_ROW }));

      const profile = await auth.getProfile('user-1');

      expect(mockFrom).toHaveBeenCalledWith('profiles');
      expect(profile).toEqual({
        id: 'user-1',
        displayName: 'Alice',
        avatarUrl: null,
        phoneNumber: '+447700900001',
      });
    });

    it('throws a mapped DataError when the row cannot be read', async () => {
      mockFrom.mockReturnValue(queryResult({ error: pgError('42501', 'permission denied') }));
      await expect(auth.getProfile('user-1')).rejects.toMatchObject({ code: 'not_authenticated' });
    });
  });

  describe('updateProfile', () => {
    it('sends only the patched columns and returns the updated profile', async () => {
      const builder = queryResult({ data: { ...PROFILE_ROW, display_name: 'Alice B' } });
      mockFrom.mockReturnValue(builder);

      const profile = await auth.updateProfile('user-1', { displayName: 'Alice B' });

      expect(builder.update).toHaveBeenCalledWith({ display_name: 'Alice B' });
      expect(profile.displayName).toBe('Alice B');
    });

    it('maps a unique violation to phone_number_taken', async () => {
      mockFrom.mockReturnValue(
        queryResult({ error: pgError('23505', 'duplicate key value violates unique constraint') }),
      );

      await expect(auth.updateProfile('user-1', { phoneNumber: '+447700900001' })).rejects.toMatchObject({
        code: 'phone_number_taken',
      });
    });

    it('maps a check violation to invalid_phone_number when the patch touched the phone number', async () => {
      mockFrom.mockReturnValue(queryResult({ error: pgError('23514', 'violates check constraint') }));

      await expect(auth.updateProfile('user-1', { phoneNumber: 'not-a-number' })).rejects.toMatchObject({
        code: 'invalid_phone_number',
      });
    });

    it('maps a check violation to invalid_display_name otherwise', async () => {
      mockFrom.mockReturnValue(queryResult({ error: pgError('23514', 'violates check constraint') }));

      await expect(auth.updateProfile('user-1', { displayName: '' })).rejects.toMatchObject({
        code: 'invalid_display_name',
      });
    });
  });
});
