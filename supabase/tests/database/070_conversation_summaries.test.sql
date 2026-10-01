begin;
\ir _helpers.psql

select plan(5);

select pg_temp.create_user('alice@example.test') as alice \gset
select pg_temp.create_user('bob@example.test') as bob \gset
select pg_temp.create_user('carol@example.test') as carol \gset

select pg_temp.login_as(:'alice');
select public.create_conversation('Stag do') as conv \gset
select public.add_participants(:'conv', array[:'bob']::uuid[]);

-- ── No messages yet ──────────────────────────────────────────
select results_eq(
  format(
    'select last_message_content, last_activity_at = created_at
       from public.conversation_summaries where id = %L',
    :'conv'
  ),
  $$ values (null::text, true) $$,
  'with no messages, last_message_content is null and last_activity_at falls back to created_at'
);

-- ── Latest message wins ──────────────────────────────────────
insert into public.messages (conversation_id, sender_id, content)
  values (:'conv', :'alice', 'First message');

select results_eq(
  format(
    'select last_message_content, last_message_sender_id from public.conversation_summaries where id = %L',
    :'conv'
  ),
  $$ values ('First message'::text, auth.uid()) $$,
  'the summary reflects the only message'
);

-- pgTAP wraps the whole file in one transaction, so now() (used by the
-- created_at default) is frozen — both inserts would otherwise tie and
-- fall to the id tie-breaker, which is a random uuid. Clients can't write
-- created_at themselves (not in the insert grant), so push the first
-- message into the past as postgres to make the ordering deterministic.
reset role;
update public.messages set created_at = now() - interval '1 minute' where content = 'First message';

select pg_temp.login_as(:'bob');
insert into public.messages (conversation_id, sender_id, content)
  values (:'conv', :'bob', 'Second message');

select results_eq(
  format(
    'select last_message_content, last_message_sender_id from public.conversation_summaries where id = %L',
    :'conv'
  ),
  $$ values ('Second message'::text, auth.uid()) $$,
  'the summary reflects the newest message, not the first'
);
-- ── Visibility ───────────────────────────────────────────────
reset role;
select pg_temp.login_as(:'carol');
select is_empty(
  format('select 1 from public.conversation_summaries where id = %L', :'conv'),
  'a non-member sees no summary row for the conversation'
);

reset role;
select pg_temp.login_anon();
select throws_ok(
  $$ select 1 from public.conversation_summaries limit 1 $$,
  '42501', null,
  'anon has no select grant on conversation_summaries'
);

select * from finish();
rollback;
