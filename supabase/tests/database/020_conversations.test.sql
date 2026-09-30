begin;
\ir _helpers.psql

select plan(16);

select pg_temp.create_user('alice@example.test') as alice \gset
select pg_temp.create_user('bob@example.test') as bob \gset
select pg_temp.create_user('carol@example.test') as carol \gset

-- ── create_conversation ──────────────────────────────────────
select pg_temp.login_as(:'alice');
select public.create_conversation('  Stag do  ') as conv \gset

select results_eq(
  format('select name, created_by from public.conversations where id = %L', :'conv'),
  $$ values ('Stag do'::text, auth.uid()) $$,
  'create_conversation trims the name and records the creator'
);
select results_eq(
  format('select user_id from public.conversation_participants where conversation_id = %L', :'conv'),
  $$ values (auth.uid()) $$,
  'creator is the first participant'
);
select throws_ok(
  $$ insert into public.conversations (type) values ('group') $$,
  '42501', null,
  'conversations cannot be inserted directly'
);
select throws_ok(
  format('insert into public.conversation_participants (conversation_id, user_id) values (%L, %L)', :'conv', :'bob'),
  '42501', null,
  'participants cannot be inserted directly'
);

-- ── add_participants ─────────────────────────────────────────
select is(
  public.add_participants(:'conv', array[:'bob', :'bob', gen_random_uuid()]::uuid[]),
  1,
  'add_participants adds existing users once and ignores unknown ids'
);
select is(
  public.add_participants(:'conv', array[:'bob']::uuid[]),
  0,
  'add_participants is idempotent'
);

reset role;
select pg_temp.login_as(:'carol');
select throws_ok(
  format('select public.add_participants(%L, array[%L]::uuid[])', :'conv', :'carol'),
  '42501', 'not_a_member',
  'a non-member cannot add participants (including themselves)'
);

-- ── Visibility ───────────────────────────────────────────────
select is_empty(
  format('select 1 from public.conversations where id = %L', :'conv'),
  'a stranger cannot see the conversation'
);
select is_empty(
  format('select 1 from public.conversation_participants where conversation_id = %L', :'conv'),
  'a stranger cannot see its participants'
);

reset role;
select pg_temp.login_as(:'bob');
select results_eq(
  format('select count(*)::int from public.conversation_participants where conversation_id = %L', :'conv'),
  array[2],
  'a member sees all participants'
);

-- ── Update / delete ──────────────────────────────────────────
update public.conversations set name = 'Renamed by Bob' where id = :'conv';
reset role;
select pg_temp.login_as(:'alice');
select is(
  (select name from public.conversations where id = :'conv'),
  'Stag do',
  'a non-creator member cannot rename the conversation'
);
select lives_ok(
  format('update public.conversations set name = %L where id = %L', 'Stag do 2026', :'conv'),
  'the creator can rename the conversation'
);
select throws_ok(
  format('update public.conversations set created_by = %L where id = %L', :'bob', :'conv'),
  '42501', null,
  'created_by is not client-writable'
);

-- ── Leaving ──────────────────────────────────────────────────
reset role;
select pg_temp.login_as(:'bob');
delete from public.conversation_participants where conversation_id = :'conv' and user_id = auth.uid();
select is_empty(
  format('select 1 from public.conversations where id = %L', :'conv'),
  'after leaving, the conversation is no longer visible'
);

reset role;
select pg_temp.login_as(:'alice');
delete from public.conversation_participants where conversation_id = :'conv' and user_id <> auth.uid();
select results_eq(
  format('select count(*)::int from public.conversation_participants where conversation_id = %L', :'conv'),
  array[1],
  'a member cannot remove other participants'
);

-- ── Anonymous ────────────────────────────────────────────────
reset role;
select pg_temp.login_anon();
select throws_ok(
  $$ select public.create_conversation('x') $$,
  '42501', null,
  'anon cannot create conversations'
);

select * from finish();
rollback;
