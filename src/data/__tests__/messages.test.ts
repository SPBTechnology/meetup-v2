import type { PostgrestError } from '@supabase/supabase-js';

import { supabase } from '../../lib/supabase';
import { pgError } from '../../test-utils/supabaseFixtures';
import * as messages from '../messages';

jest.mock('../../lib/supabase', () => ({
  supabase: {
    from: jest.fn(),
    channel: jest.fn(),
    removeChannel: jest.fn(),
  },
}));

// .from('messages').select().eq().order().order().limit()[.or()] — thenable,
// no terminal .single() in listMessages' own chain.
function listResult(result: { data?: unknown; error?: PostgrestError | null }) {
  const builder: Record<string, jest.Mock> = {};
  builder.select = jest.fn(() => builder);
  builder.eq = jest.fn(() => builder);
  builder.order = jest.fn(() => builder);
  builder.limit = jest.fn(() => builder);
  builder.or = jest.fn(() => builder);
  builder.then = jest.fn((resolve: (v: unknown) => void) =>
    resolve({ data: result.data ?? null, error: result.error ?? null }),
  );
  return builder;
}

// .from('messages').insert().select().single()
function insertResult(result: { data?: unknown; error?: PostgrestError | null }) {
  const builder: Record<string, jest.Mock> = {};
  builder.insert = jest.fn(() => builder);
  builder.select = jest.fn(() => builder);
  builder.single = jest.fn(() => Promise.resolve({ data: result.data ?? null, error: result.error ?? null }));
  return builder;
}

const MESSAGE_ROW = {
  id: 'msg-1',
  conversation_id: 'conv-1',
  sender_id: 'user-1',
  kind: 'user' as const,
  content: 'Hello',
  created_at: '2026-01-01T00:00:00Z',
};

describe('messages.ts', () => {
  const mockFrom = supabase.from as jest.Mock;
  const mockChannel = supabase.channel as jest.Mock;
  const mockRemoveChannel = supabase.removeChannel as jest.Mock;

  afterEach(() => jest.clearAllMocks());

  describe('listMessages', () => {
    it('maps rows and reports no next page when under a full page', async () => {
      const builder = listResult({ data: [MESSAGE_ROW] });
      mockFrom.mockReturnValue(builder);

      const page = await messages.listMessages('conv-1', { limit: 30 });

      expect(mockFrom).toHaveBeenCalledWith('messages');
      expect(builder.eq).toHaveBeenCalledWith('conversation_id', 'conv-1');
      expect(builder.or).not.toHaveBeenCalled();
      expect(page.messages).toEqual([
        {
          id: 'msg-1',
          conversationId: 'conv-1',
          senderId: 'user-1',
          kind: 'user',
          content: 'Hello',
          createdAt: '2026-01-01T00:00:00Z',
        },
      ]);
      expect(page.nextCursor).toBeUndefined();
    });

    it('reports a next cursor from the oldest row when the page is full', async () => {
      const older = { ...MESSAGE_ROW, id: 'msg-0', created_at: '2025-12-31T00:00:00Z' };
      mockFrom.mockReturnValue(listResult({ data: [MESSAGE_ROW, older] }));

      const page = await messages.listMessages('conv-1', { limit: 2 });

      expect(page.nextCursor).toEqual({ createdAt: '2025-12-31T00:00:00Z', id: 'msg-0' });
    });

    it('applies a keyset filter for the given cursor', async () => {
      const builder = listResult({ data: [] });
      mockFrom.mockReturnValue(builder);

      await messages.listMessages('conv-1', { before: { createdAt: '2026-01-01T00:00:00Z', id: 'msg-1' } });

      expect(builder.or).toHaveBeenCalledWith(
        'created_at.lt.2026-01-01T00:00:00Z,and(created_at.eq.2026-01-01T00:00:00Z,id.lt.msg-1)',
      );
    });

    it('throws a DataError on failure', async () => {
      mockFrom.mockReturnValue(listResult({ error: pgError('42501', 'denied') }));

      await expect(messages.listMessages('conv-1')).rejects.toMatchObject({ code: 'not_authenticated' });
    });
  });

  describe('sendMessage', () => {
    it('inserts with a client-generated id and the given sender/content', async () => {
      const builder = insertResult({ data: MESSAGE_ROW });
      mockFrom.mockReturnValue(builder);

      const result = await messages.sendMessage('conv-1', 'user-1', 'Hello');

      expect(builder.insert).toHaveBeenCalledWith(
        expect.objectContaining({ conversation_id: 'conv-1', sender_id: 'user-1', content: 'Hello' }),
      );
      const [insertedRow] = builder.insert.mock.calls[0] as [{ id: string }];
      expect(insertedRow.id).toEqual(expect.any(String));
      expect(result.content).toBe('Hello');
    });

    it('throws a DataError on failure', async () => {
      mockFrom.mockReturnValue(insertResult({ error: pgError('42501', 'denied') }));

      await expect(messages.sendMessage('conv-1', 'user-1', 'Hello')).rejects.toMatchObject({
        code: 'not_authenticated',
      });
    });
  });

  describe('subscribeToMessages', () => {
    it('subscribes to inserts filtered to the conversation and maps rows', () => {
      const onInsert = jest.fn();
      const channelBuilder = { on: jest.fn(), subscribe: jest.fn() };
      channelBuilder.on.mockReturnValue(channelBuilder);
      channelBuilder.subscribe.mockReturnValue(channelBuilder);
      mockChannel.mockReturnValue(channelBuilder);

      messages.subscribeToMessages('conv-1', onInsert);

      expect(mockChannel).toHaveBeenCalledWith('messages:conv-1');
      const [event, config, handler] = channelBuilder.on.mock.calls[0] as [
        string,
        { filter: string },
        (payload: { new: unknown }) => void,
      ];
      expect(event).toBe('postgres_changes');
      expect(config.filter).toBe('conversation_id=eq.conv-1');

      handler({ new: MESSAGE_ROW });
      expect(onInsert).toHaveBeenCalledWith(expect.objectContaining({ id: 'msg-1', content: 'Hello' }));
    });

    it('returns an unsubscribe function that removes the channel', () => {
      const channelBuilder = { on: jest.fn(), subscribe: jest.fn() };
      channelBuilder.on.mockReturnValue(channelBuilder);
      channelBuilder.subscribe.mockReturnValue(channelBuilder);
      mockChannel.mockReturnValue(channelBuilder);

      const unsubscribe = messages.subscribeToMessages('conv-1', jest.fn());
      unsubscribe();

      expect(mockRemoveChannel).toHaveBeenCalledWith(channelBuilder);
    });
  });
});
