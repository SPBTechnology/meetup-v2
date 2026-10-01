// Checks what pgTAP can't: that match_phone_numbers is reachable and behaves
// correctly through the real API (PostgREST + supabase-js). RLS/logic itself
// is covered by pgTAP (060_phone_matching.test.sql).
import { defaultDisplayName } from '../../src/lib/displayName';
import { cleanupTestUsers, createTestUser } from './helpers';

afterEach(cleanupTestUsers);

describe('match_phone_numbers through the API', () => {
  it('finds another user by phone number but excludes the caller', async () => {
    const alice = await createTestUser('alice');
    const bob = await createTestUser('bob');

    const { error: aliceError } = await alice.client
      .from('profiles')
      .update({ phone_number: '+447700900001' })
      .eq('id', alice.id);
    expect(aliceError).toBeNull();
    const { error: bobError } = await bob.client.from('profiles').update({ phone_number: '+447700900002' }).eq('id', bob.id);
    expect(bobError).toBeNull();

    const { data, error } = await alice.client.rpc('match_phone_numbers', {
      p_phone_numbers: ['+447700900001', '+447700900002', '+447700900099'],
    });

    expect(error).toBeNull();
    expect(data).toEqual([{ user_id: bob.id, display_name: defaultDisplayName(bob.email), phone_number: '+447700900002' }]);
  });
});
