import { supabase } from '../lib/supabase';
import type { Database } from '../types/database.types';
import { fromPostgrestError } from './errors';

export type Invite = {
  id: string;
  conversationId: string;
  code: string;
  createdBy: string | null;
  expiresAt: string;
  maxUses: number | null;
  useCount: number;
  revokedAt: string | null;
  createdAt: string;
};

function toInvite(row: Database['public']['Tables']['conversation_invites']['Row']): Invite {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    code: row.code,
    createdBy: row.created_by,
    expiresAt: row.expires_at,
    maxUses: row.max_uses,
    useCount: row.use_count,
    revokedAt: row.revoked_at,
    createdAt: row.created_at,
  };
}

/** Creates an invite for a conversation the caller belongs to. Defaults: 7-day expiry, unlimited uses. */
export async function createInvite(conversationId: string, createdBy: string): Promise<Invite> {
  const { data, error } = await supabase
    .from('conversation_invites')
    .insert({ conversation_id: conversationId, created_by: createdBy })
    .select()
    .single();
  if (error) throw fromPostgrestError(error);
  return toInvite(data);
}

/** Invites for a conversation the caller belongs to, newest first. */
export async function listInvites(conversationId: string): Promise<Invite[]> {
  const { data, error } = await supabase
    .from('conversation_invites')
    .select()
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false });
  if (error) throw fromPostgrestError(error);
  return data.map(toInvite);
}

function isActive(invite: Invite): boolean {
  return invite.revokedAt === null && new Date(invite.expiresAt) > new Date();
}

/** Reuses the most recent active (unrevoked, unexpired) invite, or creates one if none exists. */
export async function getOrCreateActiveInvite(conversationId: string, createdBy: string): Promise<Invite> {
  const existing = await listInvites(conversationId);
  const active = existing.find(isActive);
  if (active) return active;
  return createInvite(conversationId, createdBy);
}

/** Redeems an invite code, joining the caller to its conversation. Returns the conversation id. */
export async function acceptInvite(code: string): Promise<string> {
  const { data, error } = await supabase.rpc('accept_invite', { p_code: code });
  if (error) throw fromPostgrestError(error);
  return data;
}

export type PhoneMatch = {
  userId: string;
  displayName: string;
  phoneNumber: string;
};

/** Finds existing users among the given phone numbers (excludes the caller). Max 1000 per call. */
export async function matchPhoneNumbers(phoneNumbers: string[]): Promise<PhoneMatch[]> {
  const { data, error } = await supabase.rpc('match_phone_numbers', { p_phone_numbers: phoneNumbers });
  if (error) throw fromPostgrestError(error);
  return data.map((row) => ({ userId: row.user_id, displayName: row.display_name, phoneNumber: row.phone_number }));
}
