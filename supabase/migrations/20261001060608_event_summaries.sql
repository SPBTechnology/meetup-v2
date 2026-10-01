-- Phase 5: the event chip list (EventBar, shown in the chat screen) needs
-- each event's date/response/location summary without an N+1 query per
-- row. security_invoker = true means the view runs with the querying
-- role's own RLS (is_event_member / is_date_option_member), same approach
-- as conversation_summaries.
--
-- Response counts and a "nearest date" only mean something when there's
-- exactly one date option — aggregating across multiple options is
-- misleading (a count of 3 "accepted" could be 3 different dates), so
-- both are null whenever there's more than one option. multi_date tells
-- the client to show "Multiple dates" and hide response counts instead.
create view public.event_summaries
with (security_invoker = true) as
select
  e.id,
  e.conversation_id,
  e.title,
  e.status,
  e.created_by,
  e.created_at,
  coalesce(opts.option_count, 0) > 1                      as multi_date,
  case when opts.option_count = 1 then opts.single_starts_at end        as nearest_date,
  case when opts.option_count = 1 then opts.single_option_id end        as single_date_option_id,
  case when opts.option_count = 1 then coalesce(resp.accepted_count, 0)::int end as accepted_count,
  case when opts.option_count = 1 then coalesce(resp.maybe_count, 0)::int end    as maybe_count,
  case when opts.option_count = 1 then coalesce(resp.declined_count, 0)::int end as declined_count,
  coalesce(locs.location_count, 0)::int                   as location_count,
  locs.first_location_name
from public.events e
left join lateral (
  select
    count(*)::int as option_count,
    (array_agg(id order by starts_at))[1] as single_option_id,
    (array_agg(starts_at order by starts_at))[1] as single_starts_at
  from public.event_date_options o
  where o.event_id = e.id
) opts on true
left join lateral (
  select
    count(*) filter (where r.response = 'accepted') as accepted_count,
    count(*) filter (where r.response = 'maybe')    as maybe_count,
    count(*) filter (where r.response = 'declined') as declined_count
  from public.event_responses r
  where r.date_option_id = opts.single_option_id
) resp on opts.option_count = 1
left join lateral (
  select
    count(*)::int as location_count,
    (array_agg(name order by sort_order))[1] as first_location_name
  from public.event_locations l
  where l.event_id = e.id
) locs on true;

-- Supabase's default privileges grant everything to anon/authenticated on new
-- objects too (baseline_schema.sql's blanket revoke only covered relations
-- that existed at the time it ran) — revoke first, then grant back only what's needed.
revoke all on public.event_summaries from anon, authenticated;
grant select on public.event_summaries to authenticated;
