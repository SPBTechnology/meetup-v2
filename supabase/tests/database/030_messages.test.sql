begin;
\ir _helpers.psql

select plan(9);

select pg_temp.create_user('alice@example.test') as alice \gset
select pg_temp.create_user('bob@example.test') as bob \gset
select pg_temp.create_user('carol@example.test') as carol \gset

select pg_temp.login_as(:'alice');
select public.create_conversation('Trip') as conv \gset
select public.add_participants(:'conv', array[:'bob']::uuid[]);

-- ── Sending ──────────────────────────────────────────────────
select lives_ok(
  format('insert into public.messages (id, conversation_id, sender_id, content) values (gen_random_uuid(), %L, auth.uid(), %L)', :'conv', 'hello'),
  'a member sends a message as themselves (client-generated id)'
);
select results_eq(
  format('select kind::text from public.messages where conversation_id = %L', :'conv'),
  array['user'],
  'client messages are always kind = user'
);
select throws_ok(
  format('insert into public.messages (conversation_id, sender_id, content) values (%L, %L, %L)', :'conv', :'bob', 'spoof'),
  '42501', null,
  'a member cannot send as someone else'
);
select throws_ok(
  format('insert into public.messages (conversation_id, sender_id, kind, content) values (%L, auth.uid(), %L, %L)', :'conv', 'system', 'fake system'),
  '42501', null,
  'clients cannot write system messages'
);
select throws_ok(
  format('insert into public.messages (conversation_id, sender_id, content) values (%L, auth.uid(), %L)', :'conv', ''),
  '23514', null,
  'empty messages are rejected'
);

-- ── Immutability ─────────────────────────────────────────────
select throws_ok(
  format('update public.messages set content = %L where conversation_id = %L', 'edited', :'conv'),
  '42501', null,
  'messages cannot be edited'
);
select throws_ok(
  format('delete from public.messages where conversation_id = %L', :'conv'),
  '42501', null,
  'messages cannot be deleted by clients'
);

-- ── Strangers ────────────────────────────────────────────────
reset role;
select pg_temp.login_as(:'carol');
select is_empty(
  format('select 1 from public.messages where conversation_id = %L', :'conv'),
  'a stranger cannot read messages'
);
select throws_ok(
  format('insert into public.messages (conversation_id, sender_id, content) values (%L, auth.uid(), %L)', :'conv', 'let me in'),
  '42501', null,
  'a stranger cannot post into the conversation'
);

select * from finish();
rollback;
