import type { RealtimeChannel } from '@supabase/supabase-js';

import { supabase } from '../lib/supabase';
import type { Database } from '../types/database.types';
import { fromPostgrestError } from './errors';

export type MessageKind = Database['public']['Enums']['message_kind'];

export type Message = {
  id: string;
  conversationId: string;
  senderId: string | null;
  kind: MessageKind;
  content: string;
  createdAt: string;
};

function toMessage(row: Database['public']['Tables']['messages']['Row']): Message {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    senderId: row.sender_id,
    kind: row.kind,
    content: row.content,
    createdAt: row.created_at,
  };
}

export type MessagePage = {
  messages: Message[];
  /** Pass as `before` to fetch the next (older) page. Undefined once there are no more. */
  nextCursor: { createdAt: string; id: string } | undefined;
};

export type ListMessagesOptions = {
  /** Keyset cursor: fetch messages strictly older than this (created_at, id) pair. */
  before?: { createdAt: string; id: string };
  limit?: number;
};

const DEFAULT_PAGE_SIZE = 30;

/**
 * Newest-first keyset page over a conversation's messages, matching
 * messages_conversation_created_idx (conversation_id, created_at desc, id desc).
 * Offset pagination isn't used here — new messages arriving between page
 * fetches would shift an offset-based page and duplicate/skip rows.
 */
export async function listMessages(conversationId: string, options: ListMessagesOptions = {}): Promise<MessagePage> {
  const limit = options.limit ?? DEFAULT_PAGE_SIZE;
  let query = supabase
    .from('messages')
    .select()
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(limit);

  if (options.before) {
    // (created_at, id) < (before.createdAt, before.id) in keyset terms:
    // strictly older, or same instant with a strictly smaller id.
    query = query.or(
      `created_at.lt.${options.before.createdAt},and(created_at.eq.${options.before.createdAt},id.lt.${options.before.id})`,
    );
  }

  const { data, error } = await query;
  if (error) throw fromPostgrestError(error);

  const messages = data.map(toMessage);
  const last = messages.at(-1);
  return {
    messages,
    nextCursor: messages.length === limit && last ? { createdAt: last.createdAt, id: last.id } : undefined,
  };
}

/** Sends a message. `id` lets the caller show it optimistically before the insert round-trips. */
export async function sendMessage(conversationId: string, senderId: string, content: string): Promise<Message> {
  const id = crypto.randomUUID();
  const { data, error } = await supabase
    .from('messages')
    .insert({ id, conversation_id: conversationId, sender_id: senderId, content })
    .select()
    .single();
  if (error) throw fromPostgrestError(error);
  return toMessage(data);
}

/**
 * Subscribes to new messages in a conversation. Returns an unsubscribe
 * function — call it on unmount (removeChannel, not disconnect: see
 * conventions.md on realtime-js's 10s teardown timers).
 */
export function subscribeToMessages(conversationId: string, onInsert: (message: Message) => void): () => void {
  const channel: RealtimeChannel = supabase
    .channel(`messages:${conversationId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` },
      (payload) => onInsert(toMessage(payload.new as Database['public']['Tables']['messages']['Row'])),
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}
