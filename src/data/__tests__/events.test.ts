import type { PostgrestError } from '@supabase/supabase-js';

import { supabase } from '../../lib/supabase';
import { pgError } from '../../test-utils/supabaseFixtures';
import * as events from '../events';

jest.mock('../../lib/supabase', () => ({
  supabase: {
    from: jest.fn(),
    rpc: jest.fn(),
    channel: jest.fn(),
    removeChannel: jest.fn(),
  },
}));

function thenable(result: { data?: unknown; error?: PostgrestError | null }) {
  return Promise.resolve({ data: result.data ?? null, error: result.error ?? null });
}

// .from(table).select().eq().order() — listEventSummaries, option/location queries in getEventDetail
function selectOrderResult(result: { data?: unknown; error?: PostgrestError | null }) {
  const builder: Record<string, jest.Mock> = {};
  builder.select = jest.fn(() => builder);
  builder.eq = jest.fn(() => builder);
  builder.order = jest.fn(() => thenable(result));
  return builder;
}

// .from('events').select().eq().single()
function selectSingleResult(result: { data?: unknown; error?: PostgrestError | null }) {
  const builder: Record<string, jest.Mock> = {};
  builder.select = jest.fn(() => builder);
  builder.eq = jest.fn(() => builder);
  builder.single = jest.fn(() => thenable(result));
  return builder;
}

// .from('event_responses').select().in()
function selectInResult(result: { data?: unknown; error?: PostgrestError | null }) {
  const builder: Record<string, jest.Mock> = {};
  builder.select = jest.fn(() => builder);
  builder.in = jest.fn(() => thenable(result));
  return builder;
}

// .from(table).update(row).eq()
function updateResult(result: { error?: PostgrestError | null }) {
  const builder: Record<string, jest.Mock> = {};
  builder.update = jest.fn(() => builder);
  builder.eq = jest.fn(() => thenable(result));
  return builder;
}

// .from(table).insert().select().single()
function insertResult(result: { data?: unknown; error?: PostgrestError | null }) {
  const builder: Record<string, jest.Mock> = {};
  builder.insert = jest.fn(() => builder);
  builder.select = jest.fn(() => builder);
  builder.single = jest.fn(() => thenable(result));
  return builder;
}

// .from(table).delete().eq()
function deleteResult(result: { error?: PostgrestError | null }) {
  const builder: Record<string, jest.Mock> = {};
  builder.delete = jest.fn(() => builder);
  builder.eq = jest.fn(() => thenable(result));
  return builder;
}

// .from('event_responses').upsert()
function upsertResult(result: { error?: PostgrestError | null }) {
  const builder: Record<string, jest.Mock> = {};
  builder.upsert = jest.fn(() => thenable(result));
  return builder;
}

const SUMMARY_ROW_MULTI = {
  id: 'event-1',
  conversation_id: 'conv-1',
  title: 'Edinburgh',
  status: 'planning' as const,
  created_by: 'user-1',
  created_at: '2026-01-01T00:00:00Z',
  multi_date: true,
  nearest_date: null,
  single_date_option_id: null,
  accepted_count: null,
  maybe_count: null,
  declined_count: null,
  location_count: 2,
  first_location_name: 'The Bow Bar',
};

describe('events.ts', () => {
  const mockFrom = supabase.from as jest.Mock;
  const mockRpc = supabase.rpc as jest.Mock;
  const mockChannel = supabase.channel as jest.Mock;
  const mockRemoveChannel = supabase.removeChannel as jest.Mock;

  afterEach(() => jest.clearAllMocks());

  describe('listEventSummaries', () => {
    it('hides response counts and shows "Multiple locations" when multi-date', async () => {
      mockFrom.mockReturnValue(selectOrderResult({ data: [SUMMARY_ROW_MULTI] }));

      const result = await events.listEventSummaries('conv-1');

      expect(mockFrom).toHaveBeenCalledWith('event_summaries');
      expect(result).toEqual([
        {
          id: 'event-1',
          conversationId: 'conv-1',
          title: 'Edinburgh',
          status: 'planning',
          createdBy: 'user-1',
          createdAt: '2026-01-01T00:00:00Z',
          multiDate: true,
          nearestDate: null,
          singleDateOptionId: null,
          responseCounts: null,
          location: 'Multiple locations',
        },
      ]);
    });

    it('shows response counts and the single location name when not multi-date', async () => {
      mockFrom.mockReturnValue(
        selectOrderResult({
          data: [
            {
              ...SUMMARY_ROW_MULTI,
              multi_date: false,
              nearest_date: '2027-05-01T19:00:00Z',
              single_date_option_id: 'opt-1',
              accepted_count: 2,
              maybe_count: 1,
              declined_count: 0,
              location_count: 1,
              first_location_name: 'The Pub',
            },
          ],
        }),
      );

      const [result] = await events.listEventSummaries('conv-1');

      expect(result?.responseCounts).toEqual({ accepted: 2, maybe: 1, declined: 0 });
      expect(result?.location).toBe('The Pub');
    });

    it('reports a null location when there are none', async () => {
      mockFrom.mockReturnValue(selectOrderResult({ data: [{ ...SUMMARY_ROW_MULTI, location_count: 0, first_location_name: null }] }));

      const [result] = await events.listEventSummaries('conv-1');

      expect(result?.location).toBeNull();
    });

    it('throws a DataError on failure', async () => {
      mockFrom.mockReturnValue(selectOrderResult({ error: pgError('42501', 'denied') }));

      await expect(events.listEventSummaries('conv-1')).rejects.toMatchObject({ code: 'not_authenticated' });
    });
  });

  describe('getEventDetail', () => {
    const EVENT_ROW = {
      id: 'event-1',
      conversation_id: 'conv-1',
      title: 'Edinburgh',
      description: null,
      status: 'planning' as const,
      allow_alt_dates: false,
      allow_alt_locations: false,
      confirmed_option_id: null,
      created_by: 'user-1',
    };
    const OPTION_ROWS = [
      { id: 'opt-1', starts_at: '2027-03-27T19:00:00Z', ends_at: null },
      { id: 'opt-2', starts_at: '2027-04-03T19:00:00Z', ends_at: null },
    ];
    const LOCATION_ROWS = [{ id: 'loc-1', name: 'The Bow Bar', sort_order: 0 }];
    const RESPONSE_ROWS = [
      { date_option_id: 'opt-1', user_id: 'user-1', response: 'accepted' },
      { date_option_id: 'opt-1', user_id: 'user-2', response: 'maybe' },
      { date_option_id: 'opt-2', user_id: 'user-1', response: 'declined' },
    ];

    it('aggregates per-option response counts and identifies the caller\'s own response', async () => {
      mockFrom.mockImplementation((table: string) => {
        if (table === 'events') return selectSingleResult({ data: EVENT_ROW });
        if (table === 'event_date_options') return selectOrderResult({ data: OPTION_ROWS });
        if (table === 'event_locations') return selectOrderResult({ data: LOCATION_ROWS });
        if (table === 'event_responses') return selectInResult({ data: RESPONSE_ROWS });
        throw new Error(`unexpected table ${table}`);
      });

      const detail = await events.getEventDetail('event-1', 'user-1');

      expect(detail.dateOptions).toEqual([
        { id: 'opt-1', startsAt: '2027-03-27T19:00:00Z', endsAt: null, responseCounts: { accepted: 1, maybe: 1, declined: 0 }, myResponse: 'accepted' },
        { id: 'opt-2', startsAt: '2027-04-03T19:00:00Z', endsAt: null, responseCounts: { accepted: 0, maybe: 0, declined: 1 }, myResponse: 'declined' },
      ]);
      expect(detail.locations).toEqual([{ id: 'loc-1', name: 'The Bow Bar', sortOrder: 0 }]);
    });

    it('skips the responses query entirely when there are no date options', async () => {
      mockFrom.mockImplementation((table: string) => {
        if (table === 'events') return selectSingleResult({ data: EVENT_ROW });
        if (table === 'event_date_options') return selectOrderResult({ data: [] });
        if (table === 'event_locations') return selectOrderResult({ data: [] });
        throw new Error(`unexpected table ${table}`);
      });

      const detail = await events.getEventDetail('event-1', 'user-1');

      expect(detail.dateOptions).toEqual([]);
      expect(mockFrom).not.toHaveBeenCalledWith('event_responses');
    });

    it('throws a DataError when the event itself fails to load', async () => {
      mockFrom.mockImplementation((table: string) => {
        if (table === 'events') return selectSingleResult({ error: pgError('42501', 'denied') });
        return selectOrderResult({ data: [] });
      });

      await expect(events.getEventDetail('event-1', 'user-1')).rejects.toMatchObject({ code: 'not_authenticated' });
    });
  });

  describe('createEvent', () => {
    it('calls create_event with the given fields', async () => {
      mockRpc.mockResolvedValue({ data: 'event-1', error: null });

      const id = await events.createEvent({
        conversationId: 'conv-1',
        title: 'Edinburgh',
        startsAt: ['2027-03-27T19:00:00Z'],
        locations: ['The Bow Bar'],
      });

      expect(mockRpc).toHaveBeenCalledWith('create_event', {
        p_conversation_id: 'conv-1',
        p_title: 'Edinburgh',
        p_description: undefined,
        p_starts_at: ['2027-03-27T19:00:00Z'],
        p_locations: ['The Bow Bar'],
        p_allow_alt_dates: undefined,
        p_allow_alt_locations: undefined,
      });
      expect(id).toBe('event-1');
    });

    it('throws a DataError on failure', async () => {
      mockRpc.mockResolvedValue({ data: null, error: pgError('42501', 'denied') });

      await expect(events.createEvent({ conversationId: 'conv-1', title: 'x' })).rejects.toMatchObject({
        code: 'not_authenticated',
      });
    });
  });

  describe('updateEvent', () => {
    it('updates only the given fields', async () => {
      const builder = updateResult({});
      mockFrom.mockReturnValue(builder);

      await events.updateEvent('event-1', { title: 'New title' });

      expect(builder.update).toHaveBeenCalledWith({ title: 'New title' });
      expect(builder.eq).toHaveBeenCalledWith('id', 'event-1');
    });
  });

  describe('confirmEvent', () => {
    it('sets status to confirmed with the chosen option', async () => {
      const builder = updateResult({});
      mockFrom.mockReturnValue(builder);

      await events.confirmEvent('event-1', 'opt-1');

      expect(builder.update).toHaveBeenCalledWith({ status: 'confirmed', confirmed_option_id: 'opt-1' });
    });
  });

  describe('cancelEvent', () => {
    it('sets status to cancelled', async () => {
      const builder = updateResult({});
      mockFrom.mockReturnValue(builder);

      await events.cancelEvent('event-1');

      expect(builder.update).toHaveBeenCalledWith({ status: 'cancelled' });
    });
  });

  describe('addDateOption', () => {
    it('inserts and maps the new option with zeroed counts', async () => {
      mockFrom.mockReturnValue(
        insertResult({ data: { id: 'opt-3', starts_at: '2027-05-01T19:00:00Z', ends_at: null } }),
      );

      const option = await events.addDateOption('event-1', '2027-05-01T19:00:00Z', 'user-1');

      expect(option).toEqual({
        id: 'opt-3',
        startsAt: '2027-05-01T19:00:00Z',
        endsAt: null,
        responseCounts: { accepted: 0, maybe: 0, declined: 0 },
        myResponse: null,
      });
    });
  });

  describe('deleteDateOption', () => {
    it('deletes by id', async () => {
      const builder = deleteResult({});
      mockFrom.mockReturnValue(builder);

      await events.deleteDateOption('opt-1');

      expect(builder.eq).toHaveBeenCalledWith('id', 'opt-1');
    });
  });

  describe('addLocation', () => {
    it('inserts with the given sort order', async () => {
      const builder = insertResult({ data: { id: 'loc-2', name: 'Oxford Bar', sort_order: 1 } });
      mockFrom.mockReturnValue(builder);

      const location = await events.addLocation('event-1', 'Oxford Bar', 1, 'user-1');

      expect(builder.insert).toHaveBeenCalledWith({
        event_id: 'event-1',
        name: 'Oxford Bar',
        sort_order: 1,
        created_by: 'user-1',
      });
      expect(location).toEqual({ id: 'loc-2', name: 'Oxford Bar', sortOrder: 1 });
    });
  });

  describe('respondToDateOption', () => {
    it('upserts on (date_option_id, user_id)', async () => {
      const builder = upsertResult({});
      mockFrom.mockReturnValue(builder);

      await events.respondToDateOption('opt-1', 'user-1', 'accepted');

      expect(builder.upsert).toHaveBeenCalledWith(
        { date_option_id: 'opt-1', user_id: 'user-1', response: 'accepted' },
        { onConflict: 'date_option_id,user_id' },
      );
    });

    it('throws a DataError on failure', async () => {
      mockFrom.mockReturnValue(upsertResult({ error: pgError('42501', 'denied') }));

      await expect(events.respondToDateOption('opt-1', 'user-1', 'accepted')).rejects.toMatchObject({
        code: 'not_authenticated',
      });
    });
  });

  describe('subscribeToEventList', () => {
    it('subscribes filtered to the conversation', () => {
      const channelBuilder = { on: jest.fn(), subscribe: jest.fn() };
      channelBuilder.on.mockReturnValue(channelBuilder);
      channelBuilder.subscribe.mockReturnValue(channelBuilder);
      mockChannel.mockReturnValue(channelBuilder);

      const unsubscribe = events.subscribeToEventList('conv-1', jest.fn());

      expect(mockChannel).toHaveBeenCalledWith('events:conv-1');
      expect(channelBuilder.on).toHaveBeenCalledWith(
        'postgres_changes',
        expect.objectContaining({ table: 'events', filter: 'conversation_id=eq.conv-1' }),
        expect.any(Function),
      );

      unsubscribe();
      expect(mockRemoveChannel).toHaveBeenCalledWith(channelBuilder);
    });
  });

  describe('subscribeToEventDetail', () => {
    it('filters event_responses changes client-side to the tracked option ids', () => {
      const onChange = jest.fn();
      const channelBuilder = { on: jest.fn(), subscribe: jest.fn() };
      channelBuilder.on.mockReturnValue(channelBuilder);
      channelBuilder.subscribe.mockReturnValue(channelBuilder);
      mockChannel.mockReturnValue(channelBuilder);

      events.subscribeToEventDetail('event-1', ['opt-1', 'opt-2'], onChange);

      const responseCall = channelBuilder.on.mock.calls.find(
        (call) => (call[1] as { table: string }).table === 'event_responses',
      ) as [string, unknown, (payload: { new: unknown }) => void];
      const handler = responseCall[2];

      handler({ new: { date_option_id: 'opt-1' } });
      expect(onChange).toHaveBeenCalledTimes(1);

      handler({ new: { date_option_id: 'opt-99' } });
      expect(onChange).toHaveBeenCalledTimes(1); // untracked option — not called again
    });
  });
});
