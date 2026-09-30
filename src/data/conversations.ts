import { supabase } from '../lib/supabase';
import type { Database } from '../types/database.types';
import { fromPostgrestError } from './errors';

export type ConversationType = Database['public']['Enums']['conversation_type'];

export type LastMessage = {
  id: string;
  content: string;
  senderId: string | null;
  createdAt: string;
};

export type ConversationSummary = {
  id: string;
  type: ConversationType;
  name: string | null;
  createdBy: string | null;
  createdAt: string;
  lastMessage: LastMessage | null;
  lastActivityAt: string;
};

function toConversationSummary(
  row: Database['public']['Views']['conversation_summaries']['Row'],
): ConversationSummary {
  // Every column here is nullable in the generated view type (PostgREST can't
  // know the LEFT JOIN LATERAL only produces nulls as a group), but id/type/
  // created_by/created_at/last_activity_at are never actually null — the view
  // selects them straight from conversations, which enforces them not-null.
  return {
    id: row.id!,
    type: row.type!,
    name: row.name,
    createdBy: row.created_by,
    createdAt: row.created_at!,
    lastMessage: row.last_message_id
      ? {
          id: row.last_message_id,
          content: row.last_message_content!,
          senderId: row.last_message_sender_id,
          createdAt: row.last_message_at!,
        }
      : null,
    lastActivityAt: row.last_activity_at!,
  };
}

/** Conversations the caller is a member of, newest activity first. */
export async function listConversations(): Promise<ConversationSummary[]> {
  const { data, error } = await supabase
    .from('conversation_summaries')
    .select()
    .order('last_activity_at', { ascending: false });
  if (error) throw fromPostgrestError(error);
  return data.map(toConversationSummary);
}

export type CreateConversationParams = {
  name?: string;
  type?: ConversationType;
};

/** Creates a conversation with the caller as its first (and only) participant. */
export async function createConversation(params: CreateConversationParams = {}): Promise<string> {
  const { data, error } = await supabase.rpc('create_conversation', {
    p_name: params.name,
    p_type: params.type,
  });
  if (error) throw fromPostgrestError(error);
  return data;
}

/** Adds existing users to a conversation the caller belongs to. Returns how many were newly added. */
export async function addParticipants(conversationId: string, userIds: string[]): Promise<number> {
  const { data, error } = await supabase.rpc('add_participants', {
    p_conversation_id: conversationId,
    p_user_ids: userIds,
  });
  if (error) throw fromPostgrestError(error);
  return data;
}
