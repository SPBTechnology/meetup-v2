import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config({ path: path.resolve(__dirname, '../../.env'), quiet: true });

// Node talks to the stack on loopback; the app's .env may hold the Mac's LAN IP
// so the phone can reach it. Swap the host, keep the port.
function localUrl(): string {
  const raw = process.env.EXPO_PUBLIC_SUPABASE_URL;
  if (!raw) throw new Error('EXPO_PUBLIC_SUPABASE_URL is not set — copy .env.example to .env');
  const url = new URL(raw);
  url.hostname = '127.0.0.1';
  return url.origin;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set — copy .env.example to .env`);
  return value;
}

export const SUPABASE_URL = localUrl();
const PUBLISHABLE_KEY = requireEnv('EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY');
const SECRET_KEY = requireEnv('SUPABASE_SECRET_KEY');

const noSession = { auth: { persistSession: false, autoRefreshToken: false } };

/** Service-role client. Bypasses RLS — use only for arranging and cleaning up. */
export const service = createClient(SUPABASE_URL, SECRET_KEY, noSession);

export type TestUser = {
  id: string;
  email: string;
  client: SupabaseClient;
};

const TEST_PASSWORD = 'Test-password-1!';
const created: string[] = [];
const clients: SupabaseClient[] = [];

/**
 * Create a real auth user and return a client signed in as them, so tests
 * exercise the same auth path and RLS context as the app.
 */
export async function createTestUser(label = 'user'): Promise<TestUser> {
  const email = `test-${label}-${randomUUID()}@example.test`;

  const { data, error } = await service.auth.admin.createUser({
    email,
    password: TEST_PASSWORD,
    email_confirm: true,
  });
  if (error || !data.user) throw error ?? new Error('createUser returned no user');
  created.push(data.user.id);

  const client = createClient(SUPABASE_URL, PUBLISHABLE_KEY, noSession);
  const { error: signInError } = await client.auth.signInWithPassword({ email, password: TEST_PASSWORD });
  if (signInError) throw signInError;
  clients.push(client);

  return { id: data.user.id, email, client };
}

/**
 * Register a user/client created some other way (e.g. via the real
 * self-serve `supabase.auth.signUp()`, to exercise that exact path) so
 * `cleanupTestUsers()` still removes it.
 */
export function trackUserForCleanup(userId: string, client?: SupabaseClient): void {
  created.push(userId);
  if (client) clients.push(client);
}

/**
 * Close any Realtime channels test clients opened, so subscriptions don't leak
 * into the next test, then delete every auth user created by this test file
 * (rows cascade from auth.users).
 */
export async function cleanupTestUsers(): Promise<void> {
  while (clients.length > 0) {
    const client = clients.pop()!;
    if (client.getChannels().length > 0) await client.removeAllChannels();
  }
  while (created.length > 0) {
    const id = created.pop()!;
    const { error } = await service.auth.admin.deleteUser(id);
    if (error) throw error;
  }
}
