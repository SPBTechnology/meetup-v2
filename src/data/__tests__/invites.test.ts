import type { PostgrestError } from '@supabase/supabase-js';

import { supabase } from '../../lib/supabase';
import { pgError } from '../../test-utils/supabaseFixtures';
import * as invites from '../invites';

jest.mock('../../lib/supabase', () => ({
  supabase: {
    from: jest.fn(),
    rpc: jest.fn(),
  },
}));

// .from('conversation_invites').insert().select().single()
function insertResult(result: { data?: unknown; error?: PostgrestError | null }) {
  const builder: Record<string, jest.Mock> = {};
  builder.insert = jest.fn(() => builder);
  builder.select = jest.fn(() => builder);
  builder.single = jest.fn(() => Promise.resolve({ data: result.data ?? null, error: result.error ?? null }));
  return builder;
}

// .from('conversation_invites').select().eq().order()
function listResult(result: { data?: unknown; error?: PostgrestError | null }) {
  const builder: Record<string, jest.Mock> = {};
  builder.select = jest.fn(() => builder);
  builder.eq = jest.fn(() => builder);
  builder.order = jest.fn(() => Promise.resolve({ data: result.data ?? null, error: result.error ?? null }));
  return builder;
}

// expires_at is relative to "now" (not a fixed date) because getOrCreateActiveInvite's
// isActive check is genuinely wall-clock-dependent — a hardcoded future-looking date
// eventually becomes a past date and silently breaks this fixture.
const INVITE_ROW = {
  id: 'invite-1',
  conversation_id: 'conv-1',
  code: 'ABCDEFGH',
  created_by: 'user-1',
  expires_at: new Date(Date.now() + 7 * 86_400_000).toISOString(),
  max_uses: null,
  use_count: 0,
  revoked_at: null,
  created_at: '2026-01-01T00:00:00Z',
};

describe('invites.ts', () => {
  const mockFrom = supabase.from as jest.Mock;
  const mockRpc = supabase.rpc as jest.Mock;

  afterEach(() => jest.clearAllMocks());

  describe('createInvite', () => {
    it('inserts with the given conversation and creator, and maps the row', () => {
      const builder = insertResult({ data: INVITE_ROW });
      mockFrom.mockReturnValue(builder);

      return invites.createInvite('conv-1', 'user-1').then((result) => {
        expect(mockFrom).toHaveBeenCalledWith('conversation_invites');
        expect(builder.insert).toHaveBeenCalledWith({ conversation_id: 'conv-1', created_by: 'user-1' });
        expect(result).toEqual({
          id: 'invite-1',
          conversationId: 'conv-1',
          code: 'ABCDEFGH',
          createdBy: 'user-1',
          expiresAt: INVITE_ROW.expires_at,
          maxUses: null,
          useCount: 0,
          revokedAt: null,
          createdAt: '2026-01-01T00:00:00Z',
        });
      });
    });

    it('throws a DataError on failure', async () => {
      mockFrom.mockReturnValue(insertResult({ error: pgError('42501', 'denied') }));

      await expect(invites.createInvite('conv-1', 'user-1')).rejects.toMatchObject({ code: 'not_authenticated' });
    });
  });

  describe('listInvites', () => {
    it('lists invites for a conversation, newest first', async () => {
      const builder = listResult({ data: [INVITE_ROW] });
      mockFrom.mockReturnValue(builder);

      const result = await invites.listInvites('conv-1');

      expect(builder.eq).toHaveBeenCalledWith('conversation_id', 'conv-1');
      expect(builder.order).toHaveBeenCalledWith('created_at', { ascending: false });
      expect(result).toHaveLength(1);
      expect(result[0]?.code).toBe('ABCDEFGH');
    });
  });

  describe('getOrCreateActiveInvite', () => {
    it('reuses the most recent active invite instead of creating a new one', async () => {
      mockFrom.mockReturnValue(listResult({ data: [INVITE_ROW] }));

      const result = await invites.getOrCreateActiveInvite('conv-1', 'user-1');

      expect(result.id).toBe('invite-1');
      expect(mockFrom).toHaveBeenCalledTimes(1); // only the list call — no insert
    });

    it('skips a revoked invite and creates a new one', async () => {
      const revoked = { ...INVITE_ROW, revoked_at: '2026-01-02T00:00:00Z' };
      const created = { ...INVITE_ROW, id: 'invite-2', code: 'ZZZZZZZZ' };
      mockFrom.mockReturnValueOnce(listResult({ data: [revoked] }));
      mockFrom.mockReturnValueOnce(insertResult({ data: created }));

      const result = await invites.getOrCreateActiveInvite('conv-1', 'user-1');

      expect(result.id).toBe('invite-2');
    });

    it('skips an expired invite and creates a new one', async () => {
      const expired = { ...INVITE_ROW, expires_at: '2020-01-01T00:00:00Z' };
      const created = { ...INVITE_ROW, id: 'invite-2', code: 'ZZZZZZZZ' };
      mockFrom.mockReturnValueOnce(listResult({ data: [expired] }));
      mockFrom.mockReturnValueOnce(insertResult({ data: created }));

      const result = await invites.getOrCreateActiveInvite('conv-1', 'user-1');

      expect(result.id).toBe('invite-2');
    });
  });

  describe('acceptInvite', () => {
    it('calls accept_invite with the given code and returns the conversation id', async () => {
      mockRpc.mockResolvedValue({ data: 'conv-1', error: null });

      const conversationId = await invites.acceptInvite('ABCD-EFGH');

      expect(mockRpc).toHaveBeenCalledWith('accept_invite', { p_code: 'ABCD-EFGH' });
      expect(conversationId).toBe('conv-1');
    });

    it('maps invite_not_found to a DataError with that code', async () => {
      mockRpc.mockResolvedValue({ data: null, error: pgError('P0001', 'invite_not_found') });

      await expect(invites.acceptInvite('BADCODE1')).rejects.toMatchObject({ code: 'invite_not_found' });
    });
  });

  describe('matchPhoneNumbers', () => {
    it('calls match_phone_numbers and maps the rows', async () => {
      mockRpc.mockResolvedValue({
        data: [{ user_id: 'user-2', display_name: 'Bob', phone_number: '+447700900002' }],
        error: null,
      });

      const matches = await invites.matchPhoneNumbers(['+447700900002', '+447700900003']);

      expect(mockRpc).toHaveBeenCalledWith('match_phone_numbers', { p_phone_numbers: ['+447700900002', '+447700900003'] });
      expect(matches).toEqual([{ userId: 'user-2', displayName: 'Bob', phoneNumber: '+447700900002' }]);
    });

    it('throws a DataError on failure', async () => {
      mockRpc.mockResolvedValue({ data: null, error: pgError('42501', 'denied') });

      await expect(invites.matchPhoneNumbers(['+447700900002'])).rejects.toMatchObject({ code: 'not_authenticated' });
    });
  });
});
