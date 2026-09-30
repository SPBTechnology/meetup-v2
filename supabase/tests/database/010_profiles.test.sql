begin;
\ir _helpers.psql

select plan(13);

-- ── Arrange ──────────────────────────────────────────────────
select pg_temp.create_user('alice@example.test', '{"display_name":"Alice A"}') as alice \gset
select pg_temp.create_user('bob@example.test') as bob \gset
select pg_temp.create_user('carol@example.test') as carol \gset

-- Alice and Bob share a conversation; Carol is a stranger.
select pg_temp.login_as(:'alice');
select public.create_conversation('Trip') as conv \gset
select public.add_participants(:'conv', array[:'bob']::uuid[]);
reset role;

-- ── Profile trigger ──────────────────────────────────────────
select is(
  (select display_name from public.profiles where id = :'alice'),
  'Alice A',
  'trigger uses display_name from signup metadata'
);
select is(
  (select display_name from public.profiles where id = :'bob'),
  'bob',
  'trigger falls back to the email local part'
);
select pg_temp.create_user(null) as nameless \gset
select is(
  (select display_name from public.profiles where id = :'nameless'),
  'User',
  'trigger falls back to "User" with no email'
);

-- ── Reads ────────────────────────────────────────────────────
select pg_temp.login_as(:'alice');
select results_eq(
  $$ select count(*)::int from public.profiles where id = auth.uid() $$,
  array[1],
  'user reads own profile'
);
select results_eq(
  format('select count(*)::int from public.profiles where id = %L', :'bob'),
  array[1],
  'user reads a co-participant''s profile'
);
select is_empty(
  format('select 1 from public.profiles where id = %L', :'carol'),
  'user cannot read a stranger''s profile'
);

-- ── Writes ───────────────────────────────────────────────────
select lives_ok(
  $$ update public.profiles set display_name = 'Alice B', phone_number = '+447700900001'
     where id = auth.uid() $$,
  'user updates own display name and phone'
);
update public.profiles set display_name = 'Hacked' where id = :'bob';
select pg_temp.login_as(:'bob');
select is(
  (select display_name from public.profiles where id = auth.uid()),
  'bob',
  'user cannot update another user''s profile'
);
select throws_ok(
  $$ update public.profiles set created_at = now() where id = auth.uid() $$,
  '42501', null,
  'created_at is not client-writable'
);
select throws_ok(
  $$ update public.profiles set phone_number = '07700 900002' where id = auth.uid() $$,
  '23514', null,
  'phone number must be E.164'
);
select throws_ok(
  $$ update public.profiles set phone_number = '+447700900001' where id = auth.uid() $$,
  '23505', null,
  'phone number is unique across users'
);
select throws_ok(
  $$ insert into public.profiles (id, display_name) values (gen_random_uuid(), 'x') $$,
  '42501', null,
  'clients cannot insert profiles'
);

-- ── Anonymous ────────────────────────────────────────────────
reset role;
select pg_temp.login_anon();
select throws_ok(
  $$ select * from public.profiles $$,
  '42501', null,
  'anon cannot read profiles'
);

select * from finish();
rollback;
