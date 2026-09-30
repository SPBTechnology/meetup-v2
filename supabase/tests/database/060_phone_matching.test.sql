begin;
\ir _helpers.psql

select plan(5);

select pg_temp.create_user('alice@example.test') as alice \gset
select pg_temp.create_user('bob@example.test') as bob \gset
select pg_temp.create_user('carol@example.test') as carol \gset

update public.profiles set phone_number = '+447700900001' where id = :'alice';
update public.profiles set phone_number = '+447700900002' where id = :'bob';
-- Carol has no phone number.

select pg_temp.login_as(:'alice');

select results_eq(
  $$ select user_id, display_name from public.match_phone_numbers(
       array['+447700900002', '+447700900099', '07700900002']) $$,
  format('values (%L::uuid, %L::text)', :'bob', 'bob'),
  'returns only exact E.164 matches for other users'
);
select is_empty(
  $$ select * from public.match_phone_numbers(array['+447700900001']) $$,
  'never returns the caller'
);
select is_empty(
  $$ select * from public.match_phone_numbers('{}') $$,
  'an empty list returns nothing'
);
select throws_ok(
  $$ select * from public.match_phone_numbers(
       array(select '+4477009' || lpad(g::text, 5, '0') from generate_series(1, 1001) g)) $$,
  'P0001', 'too_many_numbers',
  'rejects more than 1000 numbers per call'
);

reset role;
select pg_temp.login_anon();
select throws_ok(
  $$ select * from public.match_phone_numbers(array['+447700900002']) $$,
  '42501', null,
  'anon cannot look up phone numbers'
);

select * from finish();
rollback;
