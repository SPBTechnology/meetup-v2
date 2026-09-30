-- Phase 3: conversation list needs each conversation's last message without
-- an N+1 query per row. security_invoker = true means the view runs with the
-- querying role's own RLS (conversations: read as member; messages: read as
-- member, both driven by private.is_conversation_member) rather than the
-- view owner's — no separate access logic to keep in sync.
create view public.conversation_summaries
with (security_invoker = true) as
select
  c.id,
  c.type,
  c.name,
  c.created_by,
  c.created_at,
  lm.id         as last_message_id,
  lm.content    as last_message_content,
  lm.sender_id  as last_message_sender_id,
  lm.created_at as last_message_at,
  coalesce(lm.created_at, c.created_at) as last_activity_at
from public.conversations c
left join lateral (
  select m.id, m.content, m.sender_id, m.created_at
  from public.messages m
  where m.conversation_id = c.id
  order by m.created_at desc, m.id desc
  limit 1
) lm on true;

-- Supabase's default privileges grant everything to anon/authenticated on new
-- objects too (baseline_schema.sql's blanket revoke only covered relations
-- that existed at the time it ran) — revoke first, then grant back only what's needed.
revoke all on public.conversation_summaries from anon, authenticated;
grant select on public.conversation_summaries to authenticated;
