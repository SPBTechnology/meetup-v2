begin;
\ir _helpers.psql

select plan(7);

select pg_temp.create_user('alice@example.test') as alice \gset
select pg_temp.create_user('bob@example.test') as bob \gset
select pg_temp.create_user('carol@example.test') as carol \gset

select pg_temp.login_as(:'alice');
select public.create_conversation('Trip') as conv \gset
select public.add_participants(:'conv', array[:'bob']::uuid[]);

-- ── No date options yet ──────────────────────────────────────
select public.create_event(:'conv', 'Bare event') as bare_event \gset
select results_eq(
  format(
    'select multi_date, nearest_date, location_count from public.event_summaries where id = %L',
    :'bare_event'
  ),
  $$ values (false, null::timestamptz, 0) $$,
  'an event with no date options is not multi-date, has no nearest date, no locations'
);

-- ── Multiple date options: counts and nearest date hidden ────
select public.create_event(
  :'conv', 'Edinburgh', null,
  array['2027-03-27 19:00+00', '2027-04-03 19:00+00']::timestamptz[],
  array['The Bow Bar', 'Oxford Bar']
) as multi_event \gset

select results_eq(
  format(
    'select multi_date, nearest_date, accepted_count, location_count, first_location_name
       from public.event_summaries where id = %L',
    :'multi_event'
  ),
  $$ values (true, null::timestamptz, null::int, 2, 'The Bow Bar'::text) $$,
  'with 2+ date options, multi_date is true and per-date fields are null'
);

-- ── Single date option: nearest date and response counts ─────
select public.create_event(
  :'conv', 'Pub quiz', null, array['2027-05-01 19:00+00']::timestamptz[], array['The Pub']
) as single_event \gset
select id as single_opt from public.event_date_options where event_id = :'single_event' \gset

select results_eq(
  format(
    'select multi_date, nearest_date, accepted_count, maybe_count, declined_count
       from public.event_summaries where id = %L',
    :'single_event'
  ),
  $$ values (false, '2027-05-01 19:00+00'::timestamptz, 0, 0, 0) $$,
  'a single date option is reflected as the nearest date, with zeroed response counts'
);

insert into public.event_responses (date_option_id, user_id, response) values (:'single_opt', :'alice', 'accepted');
reset role;
select pg_temp.login_as(:'bob');
insert into public.event_responses (date_option_id, user_id, response) values (:'single_opt', :'bob', 'maybe');

select results_eq(
  format(
    'select accepted_count, maybe_count, declined_count from public.event_summaries where id = %L',
    :'single_event'
  ),
  $$ values (1, 1, 0) $$,
  'response counts reflect actual responses to the single date option'
);

-- ── Visibility ───────────────────────────────────────────────
reset role;
select pg_temp.login_as(:'carol');
select is_empty(
  format('select 1 from public.event_summaries where id = %L', :'multi_event'),
  'a non-member sees no summary row for the event'
);

reset role;
select pg_temp.login_as(:'bob');
select results_eq(
  format('select count(*)::int from public.event_summaries where conversation_id = %L', :'conv'),
  array[3],
  'a member sees all three events in the conversation'
);

reset role;
select pg_temp.login_anon();
select throws_ok(
  $$ select 1 from public.event_summaries limit 1 $$,
  '42501', null,
  'anon has no select grant on event_summaries'
);

select * from finish();
rollback;
