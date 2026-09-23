-- Harness smoke test: proves `supabase test db` (pgTAP) runs.
-- Real policy tests live alongside this file, one file per table/concern,
-- and follow the same begin / plan / finish / rollback shape.
begin;
create extension if not exists pgtap with schema extensions;

select plan(2);

select has_schema('public', 'public schema exists');
select has_function('auth', 'uid', 'auth.uid() is available for RLS policies');

select * from finish();
rollback;
