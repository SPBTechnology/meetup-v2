// Checks what pgTAP can't: that conversation_summaries and keyset message
// pagination behave correctly *through the API* (PostgREST + supabase-js) —
// exposure/grants for the view, and that the .or() filter string
// src/data/messages.ts builds is valid Postgres syntax. RLS/visibility logic
// itself is covered by pgTAP (070_conversation_summaries.test.sql).
import { randomUUID } from 'node:crypto';

import { cleanupTestUsers, createTestUser, type TestUser } from './helpers';

afterEach(cleanupTestUsers);

async function createConversation(user: TestUser, name = 'Test trip'): Promise<string> {
  const { data, error } = await user.client.rpc('create_conversation', { p_name: name });
  if (error) throw error;
  return data as string;
}

describe('conversation_summaries (exposed via PostgREST)', () => {
  it('a member sees the conversation with no last message before anyone sends one', async () => {
    const alice = await createTestUser('alice');
    const conversationId = await createConversation(alice, 'Stag do');

    const { data, error } = await alice.client.from('conversation_summaries').select().eq('id', conversationId).single();

    expect(error).toBeNull();
    expect(data).toMatchObject({ name: 'Stag do', last_message_content: null });
  });

  it('reflects the most recent message and orders by last activity', async () => {
    const alice = await createTestUser('alice');
    const older = await createConversation(alice, 'Older, but active');
    const newer = await createConversation(alice, 'Newer, quiet');

    const { error } = await alice.client
      .from('messages')
      .insert({ id: randomUUID(), conversation_id: older, sender_id: alice.id, content: 'Still going' });
    expect(error).toBeNull();

    const { data, error: listError } = await alice.client
      .from('conversation_summaries')
      .select()
      .in('id', [older, newer])
      .order('last_activity_at', { ascending: false });

    expect(listError).toBeNull();
    // The conversation with a recent message sorts above the untouched, more
    // recently *created* one — activity, not creation time, drives the order.
    expect(data?.map((c) => c.id)).toEqual([older, newer]);
    expect(data?.[0]).toMatchObject({ last_message_content: 'Still going', last_message_sender_id: alice.id });
  });

  it('a non-member sees no row for the conversation', async () => {
    const alice = await createTestUser('alice');
    const stranger = await createTestUser('stranger');
    const conversationId = await createConversation(alice);

    const { data, error } = await stranger.client.from('conversation_summaries').select().eq('id', conversationId);

    expect(error).toBeNull();
    expect(data).toEqual([]);
  });
});

describe('message keyset pagination (the query src/data/messages.ts builds)', () => {
  async function sendMessages(user: TestUser, conversationId: string, contents: string[]) {
    for (const content of contents) {
      const { error } = await user.client
        .from('messages')
        .insert({ id: randomUUID(), conversation_id: conversationId, sender_id: user.id, content });
      expect(error).toBeNull();
    }
  }

  it('pages through messages newest-first with no overlap or gaps', async () => {
    const alice = await createTestUser('alice');
    const conversationId = await createConversation(alice);
    await sendMessages(alice, conversationId, ['m1', 'm2', 'm3', 'm4', 'm5']);

    const { data: page1, error: page1Error } = await alice.client
      .from('messages')
      .select()
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(2);
    expect(page1Error).toBeNull();
    expect(page1).toHaveLength(2);

    const cursor = page1![1];
    const { data: page2, error: page2Error } = await alice.client
      .from('messages')
      .select()
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .or(`created_at.lt.${cursor.created_at},and(created_at.eq.${cursor.created_at},id.lt.${cursor.id})`)
      .limit(2);
    expect(page2Error).toBeNull();

    const page1Ids = page1!.map((m) => m.id);
    const page2Ids = page2!.map((m) => m.id);
    expect(new Set(page1Ids).size + new Set(page2Ids).size).toBe(page1Ids.length + page2Ids.length);
    expect(page1Ids.some((id) => page2Ids.includes(id))).toBe(false);

    const allContents = [...page1!, ...page2!].map((m) => m.content);
    expect(allContents).toEqual(['m5', 'm4', 'm3', 'm2']);
  });
});

describe('sending a message (the insert shape src/data/messages.ts uses)', () => {
  it('a member can send and immediately read back their own message', async () => {
    const alice = await createTestUser('alice');
    const conversationId = await createConversation(alice);

    const { data, error } = await alice.client
      .from('messages')
      .insert({ id: randomUUID(), conversation_id: conversationId, sender_id: alice.id, content: 'Hello' })
      .select()
      .single();

    expect(error).toBeNull();
    expect(data).toMatchObject({ conversation_id: conversationId, sender_id: alice.id, content: 'Hello', kind: 'user' });
  });

  it('a non-member cannot send a message', async () => {
    const alice = await createTestUser('alice');
    const stranger = await createTestUser('stranger');
    const conversationId = await createConversation(alice);

    const { error } = await stranger.client
      .from('messages')
      .insert({ id: randomUUID(), conversation_id: conversationId, sender_id: stranger.id, content: 'Sneaky' });

    expect(error).not.toBeNull();
  });
});
