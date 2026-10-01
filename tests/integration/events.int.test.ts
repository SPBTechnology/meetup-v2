// Checks what pgTAP can't: that event_summaries is reachable and correctly
// scoped through the real API (PostgREST + supabase-js). The aggregation
// logic itself (multi-date hiding, response counts, location naming) is
// covered by pgTAP (080_event_summaries.test.sql).
import { cleanupTestUsers, createTestUser, type TestUser } from './helpers';

afterEach(cleanupTestUsers);

async function createConversation(user: TestUser): Promise<string> {
  const { data, error } = await user.client.rpc('create_conversation', { p_name: 'Trip' });
  if (error) throw error;
  return data as string;
}

describe('event_summaries through PostgREST', () => {
  it('reflects a single date option as the nearest date, and a non-member sees nothing', async () => {
    const alice = await createTestUser('alice');
    const stranger = await createTestUser('stranger');
    const conversationId = await createConversation(alice);

    const { data: eventId, error: createError } = await alice.client.rpc('create_event', {
      p_conversation_id: conversationId,
      p_title: 'Pub quiz',
      p_starts_at: ['2027-05-01T19:00:00Z'],
      p_locations: ['The Pub'],
    });
    expect(createError).toBeNull();

    const { data, error } = await alice.client.from('event_summaries').select().eq('id', eventId as string).single();
    expect(error).toBeNull();
    expect(data).toMatchObject({
      multi_date: false,
      nearest_date: '2027-05-01T19:00:00+00:00',
      location_count: 1,
      first_location_name: 'The Pub',
    });

    const { data: strangerData, error: strangerError } = await stranger.client
      .from('event_summaries')
      .select()
      .eq('id', eventId as string);
    expect(strangerError).toBeNull();
    expect(strangerData).toEqual([]);
  });
});
