begin;
\ir _helpers.psql

select plan(17);

select pg_temp.create_user('alice@example.test') as alice \gset
select pg_temp.create_user('bob@example.test') as bob \gset
select pg_temp.create_user('carol@example.test') as carol \gset
select pg_temp.create_user('dan@example.test') as dan \gset

select pg_temp.login_as(:'alice');
select public.create_conversation('Trip') as conv \gset

-- ── Creating ─────────────────────────────────────────────────
insert into public.conversation_invites (conversation_id, created_by, max_uses)
values (:'conv', auth.uid(), 1);
select code as code from public.conversation_invites where conversation_id = :'conv' \gset

select matches(
  :'code'::text,
  '^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$',
  'invite codes are 8 unambiguous characters'
);
select throws_ok(
  format('insert into public.conversation_invites (conversation_id, created_by, code) values (%L, auth.uid(), %L)', :'conv', 'CHOSEN12'),
  '42501', null,
  'clients cannot choose the code'
);
select throws_ok(
  format('insert into public.conversation_invites (conversation_id, created_by, expires_at) values (%L, auth.uid(), now() + interval %L)', :'conv', '90 days'),
  '23514', null,
  'invites cannot last longer than 30 days'
);
select throws_ok(
  format('update public.conversation_invites set use_count = 0 where conversation_id = %L', :'conv'),
  '42501', null,
  'use_count is not client-writable'
);

reset role;
select pg_temp.login_as(:'carol');
select throws_ok(
  format('insert into public.conversation_invites (conversation_id, created_by) values (%L, auth.uid())', :'conv'),
  '42501', null,
  'a non-member cannot create invites'
);
select is_empty(
  format('select 1 from public.conversation_invites where conversation_id = %L', :'conv'),
  'a non-member cannot list invites'
);

-- ── Accepting ────────────────────────────────────────────────
select is(
  public.accept_invite(lower(substr(:'code', 1, 4)) || '-' || substr(:'code', 5)),
  :'conv'::uuid,
  'accept_invite joins the conversation (case-insensitive, separators ignored)'
);
select results_eq(
  format('select count(*)::int from public.conversation_participants where conversation_id = %L', :'conv'),
  array[2],
  'the new member can now see participants'
);
select is(
  public.accept_invite(:'code'),
  :'conv'::uuid,
  'accepting again as a member is a no-op success'
);

reset role;
select pg_temp.login_as(:'dan');
select throws_ok(
  format('select public.accept_invite(%L)', :'code'),
  'P0001', 'invite_exhausted',
  'a single-use invite cannot be used twice'
);
select throws_ok(
  $$ select public.accept_invite('NOTACODE') $$,
  'P0001', 'invite_not_found',
  'unknown codes are rejected'
);

reset role;
select results_eq(
  format('select use_count from public.conversation_invites where code = %L', :'code'),
  array[1],
  'use_count counts only new members'
);

-- ── Revoked and expired ──────────────────────────────────────
insert into public.conversation_invites (conversation_id, created_by, code, expires_at, created_at)
values (:'conv', :'alice', 'EXPIRED2', now() - interval '1 day', now() - interval '8 days'),
       (:'conv', :'alice', 'REVOKED2', now() + interval '1 day', now());

select pg_temp.login_as(:'carol');  -- a member, but not the invite's creator
update public.conversation_invites set revoked_at = now() where code = 'REVOKED2';
reset role;
select ok(
  (select revoked_at is null from public.conversation_invites where code = 'REVOKED2'),
  'only the invite creator can revoke it'
);
select pg_temp.login_as(:'alice');
select lives_ok(
  $$ update public.conversation_invites set revoked_at = now() where code = 'REVOKED2' $$,
  'the invite creator revokes it'
);

reset role;
select pg_temp.login_as(:'dan');
select throws_ok(
  $$ select public.accept_invite('REVOKED2') $$,
  'P0001', 'invite_revoked',
  'revoked invites are rejected'
);
select throws_ok(
  $$ select public.accept_invite('EXPIRED2') $$,
  'P0001', 'invite_expired',
  'expired invites are rejected'
);

reset role;
select pg_temp.login_anon();
select throws_ok(
  format('select public.accept_invite(%L)', :'code'),
  '42501', null,
  'anon cannot accept invites'
);

select * from finish();
rollback;
