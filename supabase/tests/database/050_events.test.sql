begin;
\ir _helpers.psql

select plan(23);

select pg_temp.create_user('alice@example.test') as alice \gset
select pg_temp.create_user('bob@example.test') as bob \gset
select pg_temp.create_user('carol@example.test') as carol \gset

select pg_temp.login_as(:'alice');
select public.create_conversation('Trip') as conv \gset
select public.add_participants(:'conv', array[:'bob']::uuid[]);

-- ── create_event ─────────────────────────────────────────────
select public.create_event(
  :'conv', '  Edinburgh  ', null,
  array['2027-03-27 19:00+00', '2027-04-03 19:00+00']::timestamptz[],
  array['The Bow Bar', 'Oxford Bar']
) as event \gset

select results_eq(
  format('select title, status::text from public.events where id = %L', :'event'),
  $$ values ('Edinburgh'::text, 'planning'::text) $$,
  'create_event trims the title and starts in planning'
);
select results_eq(
  format('select count(*)::int from public.event_date_options where event_id = %L', :'event'),
  array[2],
  'create_event inserts the date options'
);
select results_eq(
  format('select name from public.event_locations where event_id = %L order by sort_order', :'event'),
  array['The Bow Bar', 'Oxford Bar'],
  'create_event keeps location order'
);
select id as opt1 from public.event_date_options where event_id = :'event' order by starts_at limit 1 \gset

reset role;
select pg_temp.login_as(:'carol');
select throws_ok(
  format('select public.create_event(%L, %L)', :'conv', 'Gatecrash'),
  '42501', null,
  'a non-member cannot create an event in the conversation'
);
select is_empty(
  format('select 1 from public.events where id = %L', :'event'),
  'a non-member cannot see the event'
);
select is_empty(
  format('select 1 from public.event_date_options where event_id = %L', :'event'),
  'a non-member cannot see date options'
);

-- ── Member (not creator) rules ───────────────────────────────
reset role;
select pg_temp.login_as(:'bob');
select results_eq(
  format('select count(*)::int from public.event_locations where event_id = %L', :'event'),
  array[2],
  'a member sees the event''s locations'
);
update public.events set title = 'Bob''s plan' where id = :'event';
select is(
  (select title from public.events where id = :'event'),
  'Edinburgh',
  'a member cannot edit someone else''s event'
);
select throws_ok(
  format('insert into public.event_date_options (event_id, starts_at, created_by) values (%L, now(), auth.uid())', :'event'),
  '42501', null,
  'a member cannot add a date when alternative dates are off'
);
select throws_ok(
  format('insert into public.event_locations (event_id, name, created_by) values (%L, %L, auth.uid())', :'event', 'Pub'),
  '42501', null,
  'a member cannot add a location when alternative locations are off'
);

reset role;
select pg_temp.login_as(:'alice');
update public.events set allow_alt_dates = true, allow_alt_locations = true where id = :'event';
reset role;
select pg_temp.login_as(:'bob');
select lives_ok(
  format('insert into public.event_date_options (event_id, starts_at, created_by) values (%L, %L, auth.uid())', :'event', '2027-04-10 19:00+00'),
  'a member can add a date once the creator allows it'
);
select lives_ok(
  format('insert into public.event_locations (event_id, name, created_by) values (%L, %L, auth.uid())', :'event', 'Sandy Bell''s'),
  'a member can add a location once the creator allows it'
);
select throws_ok(
  format('insert into public.event_date_options (event_id, starts_at, created_by) values (%L, now(), %L)', :'event', :'alice'),
  '42501', null,
  'a member cannot add a date on someone else''s behalf'
);

-- ── Responses ────────────────────────────────────────────────
select lives_ok(
  format('insert into public.event_responses (date_option_id, user_id, response) values (%L, auth.uid(), %L)
          on conflict (date_option_id, user_id) do update set response = excluded.response', :'opt1', 'maybe'),
  'a member responds to a date (upsert)'
);
select lives_ok(
  format('insert into public.event_responses (date_option_id, user_id, response) values (%L, auth.uid(), %L)
          on conflict (date_option_id, user_id) do update set response = excluded.response', :'opt1', 'accepted'),
  'a member changes their response (upsert again)'
);
select results_eq(
  format('select response::text from public.event_responses where date_option_id = %L', :'opt1'),
  array['accepted'],
  'only one response per user per date, holding the latest answer'
);
select throws_ok(
  format('insert into public.event_responses (date_option_id, user_id, response) values (%L, %L, %L)', :'opt1', :'alice', 'declined'),
  '42501', null,
  'a member cannot respond on someone else''s behalf'
);

reset role;
select pg_temp.login_as(:'carol');
select throws_ok(
  format('insert into public.event_responses (date_option_id, user_id, response) values (%L, auth.uid(), %L)', :'opt1', 'accepted'),
  '42501', null,
  'a non-member cannot respond'
);

-- ── Confirming ───────────────────────────────────────────────
reset role;
select pg_temp.login_as(:'alice');
select throws_ok(
  format('update public.events set status = %L where id = %L', 'confirmed', :'event'),
  '23514', null,
  'an event cannot be confirmed without a chosen date'
);
select lives_ok(
  format('update public.events set status = %L, confirmed_option_id = %L where id = %L', 'confirmed', :'opt1', :'event'),
  'the creator confirms a date option'
);

select public.create_event(:'conv', 'Other event', null, array['2027-05-01 12:00+00']::timestamptz[]) as other \gset
select id as other_opt from public.event_date_options where event_id = :'other' \gset
select throws_ok(
  format('update public.events set confirmed_option_id = %L where id = %L', :'other_opt', :'event'),
  '23503', null,
  'the confirmed date must belong to the same event'
);
select throws_ok(
  format('delete from public.event_date_options where id = %L', :'opt1'),
  '23514', null,
  'the confirmed date cannot be deleted while the event is confirmed'
);

-- ── Cascade ──────────────────────────────────────────────────
delete from public.events where id = :'event';
reset role;
select is_empty(
  format('select 1 from public.event_date_options where event_id = %L
          union all select 1 from public.event_locations where event_id = %L', :'event', :'event'),
  'deleting an event removes its dates and locations'
);

select * from finish();
rollback;
