// Checks what pgTAP can't: that the schema behaves correctly *through the API*
// the app uses (PostgREST + supabase-js + Realtime) — exposure, grants, RPC
// signatures and the upsert path.
import { randomUUID } from 'node:crypto';

import { defaultDisplayName } from '../../src/lib/displayName';
import { cleanupTestUsers, createTestUser, type TestUser } from './helpers';
import { listenForInserts } from './realtime';

afterEach(cleanupTestUsers);

async function createConversation(user: TestUser, name = 'Test trip'): Promise<string> {
  const { data, error } = await user.client.rpc('create_conversation', { p_name: name });
  if (error) throw error;
  return data as string;
}

describe('profiles', () => {
  it('a new user can read the profile the trigger created, named by the shared rule', async () => {
    const alice = await createTestUser('alice');

    const { data, error } = await alice.client.from('profiles').select('id, display_name').single();

    expect(error).toBeNull();
    // The SQL trigger and src/lib/displayName.ts must agree (incl. the 40-char cap).
    expect(data).toEqual({ id: alice.id, display_name: defaultDisplayName(alice.email) });
  });
});

describe('API surface', () => {
  it('private helper functions are not callable over the API', async () => {
    const alice = await createTestUser('alice');

    const { error } = await alice.client.rpc('is_conversation_member' as never, {
      p_conversation_id: randomUUID(),
    } as never);

    expect(error).not.toBeNull();
  });

  it('RPC errors surface their stable message for the data layer to map', async () => {
    const alice = await createTestUser('alice');

    const { error } = await alice.client.rpc('accept_invite', { p_code: 'NOTACODE' });

    expect(error?.message).toBe('invite_not_found');
  });
});

describe('invite flow', () => {
  it('a member creates an invite and another user joins with it', async () => {
    const alice = await createTestUser('alice');
    const bob = await createTestUser('bob');
    const conversationId = await createConversation(alice);

    const { data: invite, error: inviteError } = await alice.client
      .from('conversation_invites')
      .insert({ conversation_id: conversationId, created_by: alice.id })
      .select('code')
      .single();
    expect(inviteError).toBeNull();

    const { data: joinedId, error: joinError } = await bob.client.rpc('accept_invite', { p_code: invite!.code });
    expect(joinError).toBeNull();
    expect(joinedId).toBe(conversationId);

    const { data: conversation } = await bob.client.from('conversations').select('name').eq('id', conversationId).single();
    expect(conversation?.name).toBe('Test trip');
  });
});

describe('events', () => {
  it('create_event and a response upsert work through supabase-js', async () => {
    const alice = await createTestUser('alice');
    const conversationId = await createConversation(alice);

    const { data: eventId, error: eventError } = await alice.client.rpc('create_event', {
      p_conversation_id: conversationId,
      p_title: 'Night out',
      p_starts_at: ['2027-03-27T19:00:00Z'],
      p_locations: ['The Bow Bar'],
    });
    expect(eventError).toBeNull();

    const { data: option } = await alice.client
      .from('event_date_options')
      .select('id')
      .eq('event_id', eventId as string)
      .single();

    for (const response of ['maybe', 'accepted'] as const) {
      const { error } = await alice.client
        .from('event_responses')
        .upsert({ date_option_id: option!.id, user_id: alice.id, response }, { onConflict: 'date_option_id,user_id' });
      expect(error).toBeNull();
    }

    const { data: responses } = await alice.client.from('event_responses').select('response').eq('date_option_id', option!.id);
    expect(responses).toEqual([{ response: 'accepted' }]);
  });
});

describe('realtime', () => {
  it('delivers a new message to members only', async () => {
    const alice = await createTestUser('alice');
    const bob = await createTestUser('bob');
    const carol = await createTestUser('carol');
    const conversationId = await createConversation(alice);
    await alice.client.rpc('add_participants', { p_conversation_id: conversationId, p_user_ids: [bob.id] });

    const bobListener = await listenForInserts(bob.client, 'messages', `conversation_id=eq.${conversationId}`);
    const carolListener = await listenForInserts(carol.client, 'messages');
    try {
      const bobReceives = bobListener.next();
      const { error } = await alice.client
        .from('messages')
        .insert({ id: randomUUID(), conversation_id: conversationId, sender_id: alice.id, content: 'hello bob' });
      expect(error).toBeNull();

      expect(await bobReceives).toMatchObject({ content: 'hello bob', sender_id: alice.id });

      // Carol isn't a member: RLS must stop delivery. Bob's receipt proves the
      // message has been broadcast; allow a short margin for Carol's copy.
      await new Promise((r) => setTimeout(r, 1_000));
      expect(carolListener.received).toEqual([]);
    } finally {
      await bobListener.close();
      await carolListener.close();
    }
  });
});
