import type { PostgrestError } from '@supabase/supabase-js';

import { supabase } from '../../lib/supabase';
import { pgError } from '../../test-utils/supabaseFixtures';
import * as conversations from '../conversations';
import { isDataError } from '../errors';

jest.mock('../../lib/supabase', () => ({
  supabase: {
    from: jest.fn(),
    rpc: jest.fn(),
  },
}));

// .from(table).select().order(col, opts) — the one chain listConversations uses.
function selectResult(result: { data?: unknown; error?: PostgrestError | null }) {
  const builder: Record<string, jest.Mock> = {};
  builder.select = jest.fn(() => builder);
  builder.order = jest.fn(() => Promise.resolve({ data: result.data ?? null, error: result.error ?? null }));
  return builder;
}

// .from(table).select().eq(col, val).single() — the chain getConversation uses.
function getResult(result: { data?: unknown; error?: PostgrestError | null }) {
  const builder: Record<string, jest.Mock> = {};
  builder.select = jest.fn(() => builder);
  builder.eq = jest.fn(() => builder);
  builder.single = jest.fn(() => Promise.resolve({ data: result.data ?? null, error: result.error ?? null }));
  return builder;
}

const SUMMARY_ROW = {
  id: 'conv-1',
  type: 'group' as const,
  name: 'Stag do',
  created_by: 'user-1',
  created_at: '2026-01-01T00:00:00Z',
  last_message_id: 'msg-1',
  last_message_content: 'Hello',
  last_message_sender_id: 'user-2',
  last_message_at: '2026-01-02T00:00:00Z',
  last_activity_at: '2026-01-02T00:00:00Z',
};

describe('conversations.ts', () => {
  const mockFrom = supabase.from as jest.Mock;
  const mockRpc = supabase.rpc as jest.Mock;

  afterEach(() => jest.clearAllMocks());

  describe('listConversations', () => {
    it('maps a summary row with a last message', async () => {
      mockFrom.mockReturnValue(selectResult({ data: [SUMMARY_ROW] }));

      const result = await conversations.listConversations();

      expect(mockFrom).toHaveBeenCalledWith('conversation_summaries');
      expect(result).toEqual([
        {
          id: 'conv-1',
          type: 'group',
          name: 'Stag do',
          createdBy: 'user-1',
          createdAt: '2026-01-01T00:00:00Z',
          lastMessage: {
            id: 'msg-1',
            content: 'Hello',
            senderId: 'user-2',
            createdAt: '2026-01-02T00:00:00Z',
          },
          lastActivityAt: '2026-01-02T00:00:00Z',
        },
      ]);
    });

    it('maps a conversation with no messages to lastMessage: null', async () => {
      mockFrom.mockReturnValue(
        selectResult({
          data: [
            {
              ...SUMMARY_ROW,
              last_message_id: null,
              last_message_content: null,
              last_message_sender_id: null,
              last_message_at: null,
              last_activity_at: SUMMARY_ROW.created_at,
            },
          ],
        }),
      );

      const result = await conversations.listConversations();

      expect(result[0]?.lastMessage).toBeNull();
    });

    it('throws a DataError on failure', async () => {
      mockFrom.mockReturnValue(selectResult({ error: pgError('42501', 'denied') }));

      await expect(conversations.listConversations()).rejects.toMatchObject({ code: 'not_authenticated' });
    });
  });

  describe('getConversation', () => {
    it('maps a single conversation row by id', async () => {
      const builder = getResult({ data: SUMMARY_ROW });
      mockFrom.mockReturnValue(builder);

      const result = await conversations.getConversation('conv-1');

      expect(mockFrom).toHaveBeenCalledWith('conversation_summaries');
      expect(builder.eq).toHaveBeenCalledWith('id', 'conv-1');
      expect(result.id).toBe('conv-1');
      expect(result.name).toBe('Stag do');
    });

    it('throws a DataError on failure', async () => {
      mockFrom.mockReturnValue(getResult({ error: pgError('42501', 'denied') }));

      await expect(conversations.getConversation('conv-1')).rejects.toMatchObject({ code: 'not_authenticated' });
    });
  });

  describe('createConversation', () => {
    it('calls create_conversation with the given name and type', async () => {
      mockRpc.mockResolvedValue({ data: 'conv-1', error: null });

      const id = await conversations.createConversation({ name: 'Stag do', type: 'group' });

      expect(mockRpc).toHaveBeenCalledWith('create_conversation', { p_name: 'Stag do', p_type: 'group' });
      expect(id).toBe('conv-1');
    });

    it('throws a DataError on failure', async () => {
      mockRpc.mockResolvedValue({ data: null, error: pgError('42501', 'not_authenticated') });

      await expect(conversations.createConversation()).rejects.toMatchObject({ code: 'not_authenticated' });
    });
  });

  describe('addParticipants', () => {
    it('calls add_participants and returns the count added', async () => {
      mockRpc.mockResolvedValue({ data: 1, error: null });

      const added = await conversations.addParticipants('conv-1', ['user-2', 'user-2']);

      expect(mockRpc).toHaveBeenCalledWith('add_participants', {
        p_conversation_id: 'conv-1',
        p_user_ids: ['user-2', 'user-2'],
      });
      expect(added).toBe(1);
    });

    it('maps not_a_member to a DataError with that code', async () => {
      mockRpc.mockResolvedValue({ data: null, error: pgError('42501', 'not_a_member') });

      const err = await conversations.addParticipants('conv-1', ['user-2']).catch((e: unknown) => e);

      expect(isDataError(err) && err.code).toBe('not_a_member');
    });
  });
});
