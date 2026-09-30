// Minimal-but-complete fixtures for supabase-js types, so unit tests can
// build real `User`/`Session`/`PostgrestError` values instead of casting
// partial objects past the type checker (which would stop catching the kind
// of shape mismatch a supabase-js upgrade could introduce).
import type { PostgrestError, Session, User } from '@supabase/supabase-js';

export function fakeUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-1',
    aud: 'authenticated',
    app_metadata: {},
    user_metadata: {},
    created_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

export function fakeSession(overrides: Partial<Session> = {}): Session {
  return {
    access_token: 'access-token',
    refresh_token: 'refresh-token',
    expires_in: 3600,
    token_type: 'bearer',
    user: fakeUser(),
    ...overrides,
  };
}

export function pgError(code: string, message: string): PostgrestError {
  const err = { message, code, details: '', hint: '', name: 'PostgrestError' };
  return { ...err, toJSON: () => err };
}
