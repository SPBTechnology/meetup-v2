-- Schema-wide guarantees. These catch mistakes in *future* migrations too:
-- a new table without RLS, a definer function without a pinned search_path,
-- or a function anon can call.
begin;
\ir _helpers.psql

select plan(7);

select has_schema('private', 'private schema exists for policy helpers');

select is_empty(
  $$ select c.relname
     from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity $$,
  'every table in public has RLS enabled'
);

select is_empty(
  $$ select p.proname
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname in ('public', 'private') and p.prosecdef
       and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%') $$,
  'every security definer function pins search_path'
);

select is_empty(
  $$ select p.proname
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname in ('public', 'private')
       and has_function_privilege('anon', p.oid, 'EXECUTE') $$,
  'anon cannot execute any public or private function'
);

select is_empty(
  $$ select table_name, privilege_type
     from information_schema.role_table_grants
     where table_schema = 'public' and grantee = 'anon' $$,
  'anon has no table privileges in public'
);

select tables_are(
  'public',
  array['profiles', 'conversations', 'conversation_participants', 'messages',
        'conversation_invites', 'events', 'event_date_options', 'event_locations',
        'event_responses'],
  'public schema has exactly the expected tables'
);

select set_eq(
  $$ select tablename::text from pg_publication_tables
     where pubname = 'supabase_realtime' and schemaname = 'public' $$,
  array['messages', 'conversation_participants', 'events', 'event_date_options',
        'event_locations', 'event_responses'],
  'realtime publication covers chat and event tables'
);

select * from finish();
rollback;
