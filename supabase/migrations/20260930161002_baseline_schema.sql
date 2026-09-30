-- =============================================================
-- Baseline schema (Phase 1)
--
-- Single starting point for meetup-v2. Design and rationale:
--   docs/context/data-model.md, docs/context/architecture.md,
--   ADR 0002 (auth.uid identity), ADR 0006 (RPC for multi-step writes).
--
-- Security model, in layers:
--   1. RLS on every table, policies `to authenticated` only.
--   2. Column-level grants: clients can only write the columns listed
--      in the Grants section — everything else is server-owned.
--   3. Cross-table checks go through `private.*` security definer
--      helpers (never raw subqueries on RLS-protected tables).
--   4. Membership changes happen only through RPCs; there is no
--      INSERT policy on conversation_participants.
-- =============================================================


-- ── Schemas ──────────────────────────────────────────────────
-- `private` holds helpers for policies and triggers. It is not in the
-- API's exposed schemas, so clients cannot call these via RPC.
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated, service_role;


-- ── Types ────────────────────────────────────────────────────
create type public.conversation_type as enum ('direct', 'group');
create type public.message_kind      as enum ('user', 'system');
create type public.event_status      as enum ('planning', 'confirmed', 'cancelled');
create type public.event_response    as enum ('accepted', 'maybe', 'declined');


-- ── Shared trigger functions ─────────────────────────────────
create function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;


-- ── Profiles ─────────────────────────────────────────────────
create table public.profiles (
  id            uuid        primary key references auth.users (id) on delete cascade,
  display_name  text        not null check (char_length(btrim(display_name)) between 1 and 40),
  avatar_url    text,
  phone_number  text        unique check (phone_number ~ '^\+[1-9][0-9]{6,14}$'),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on column public.profiles.phone_number is
  'E.164, e.g. +447700900123. Unique when set. Looked up only via match_phone_numbers().';

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function private.set_updated_at();

-- Every auth user gets a profile, created here rather than by the client so
-- it can't be skipped or raced. Display name: metadata, else email local
-- part, else 'User' (same rule as src/lib/displayName.ts).
create function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    left(
      coalesce(
        nullif(btrim(new.raw_user_meta_data ->> 'display_name'), ''),
        nullif(btrim(split_part(coalesce(new.email, ''), '@', 1)), ''),
        'User'
      ),
      40
    )
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();


-- ── Conversations ────────────────────────────────────────────
create table public.conversations (
  id          uuid                     primary key default gen_random_uuid(),
  type        public.conversation_type not null default 'group',
  name        text                     check (name is null or char_length(btrim(name)) between 1 and 80),
  created_by  uuid                     references public.profiles (id) on delete set null,
  created_at  timestamptz              not null default now()
);

create table public.conversation_participants (
  conversation_id  uuid        not null references public.conversations (id) on delete cascade,
  user_id          uuid        not null references public.profiles (id) on delete cascade,
  joined_at        timestamptz not null default now(),
  primary key (conversation_id, user_id)
);

create index conversation_participants_user_idx
  on public.conversation_participants (user_id);


-- ── Messages ─────────────────────────────────────────────────
-- sender_id is null for system messages and for senders who deleted
-- their account. Clients can only insert kind = 'user'; system messages
-- are written by RPCs.
create table public.messages (
  id               uuid                primary key default gen_random_uuid(),
  conversation_id  uuid                not null references public.conversations (id) on delete cascade,
  sender_id        uuid                references public.profiles (id) on delete set null,
  kind             public.message_kind not null default 'user',
  content          text                not null check (char_length(content) between 1 and 4000),
  created_at       timestamptz         not null default now()
);

-- Keyset pagination: newest first, id as tie-breaker.
create index messages_conversation_created_idx
  on public.messages (conversation_id, created_at desc, id desc);


-- ── Invites ──────────────────────────────────────────────────
-- 8 chars from a 32-symbol alphabet without look-alikes (0/O, 1/I):
-- ~10^12 codes. 256 % 32 = 0, so byte % 32 is unbiased. A collision
-- fails the unique constraint and the client retries.
create function private.generate_invite_code()
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  alphabet constant text  := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  bytes              bytea := extensions.gen_random_bytes(8);
  code               text  := '';
begin
  for i in 0..7 loop
    code := code || substr(alphabet, (get_byte(bytes, i) % 32) + 1, 1);
  end loop;
  return code;
end;
$$;

create table public.conversation_invites (
  id               uuid        primary key default gen_random_uuid(),
  conversation_id  uuid        not null references public.conversations (id) on delete cascade,
  code             text        not null unique default private.generate_invite_code(),
  created_by       uuid        references public.profiles (id) on delete set null,
  expires_at       timestamptz not null default now() + interval '7 days',
  max_uses         integer     check (max_uses is null or max_uses > 0),
  use_count        integer     not null default 0 check (use_count >= 0),
  revoked_at       timestamptz,
  created_at       timestamptz not null default now(),
  check (expires_at <= created_at + interval '30 days')
);

create index conversation_invites_conversation_idx
  on public.conversation_invites (conversation_id);


-- ── Events ───────────────────────────────────────────────────
create table public.events (
  id                   uuid                primary key default gen_random_uuid(),
  conversation_id      uuid                not null references public.conversations (id) on delete cascade,
  created_by           uuid                references public.profiles (id) on delete set null,
  title                text                not null check (char_length(btrim(title)) between 1 and 120),
  description          text                check (description is null or char_length(description) <= 2000),
  status               public.event_status not null default 'planning',
  allow_alt_dates      boolean             not null default false,
  allow_alt_locations  boolean             not null default false,
  confirmed_option_id  uuid,               -- FK added below, once event_date_options exists
  created_at           timestamptz         not null default now(),
  updated_at           timestamptz         not null default now(),
  check (status <> 'confirmed' or confirmed_option_id is not null)
);

create index events_conversation_idx
  on public.events (conversation_id, created_at desc);

create trigger events_set_updated_at
  before update on public.events
  for each row execute function private.set_updated_at();

create table public.event_date_options (
  id          uuid        primary key default gen_random_uuid(),
  event_id    uuid        not null references public.events (id) on delete cascade,
  starts_at   timestamptz not null,
  ends_at     timestamptz check (ends_at is null or ends_at > starts_at),
  created_by  uuid        references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  unique (event_id, id)   -- target of the composite FK from events
);

create index event_date_options_event_idx
  on public.event_date_options (event_id, starts_at);

-- The confirmed option must belong to the same event: composite FK on
-- (event id, option id). Deleting the confirmed option nulls only
-- confirmed_option_id — which the status check then rejects, so a
-- confirmed event's chosen date can't be deleted out from under it.
alter table public.events
  add constraint events_confirmed_option_fk
  foreign key (id, confirmed_option_id)
  references public.event_date_options (event_id, id)
  on delete set null (confirmed_option_id);

-- Ordered candidate places. Only `name` is used in MVP; place_id, address,
-- lat/lng and place_type are reserved for place search and venue features.
create table public.event_locations (
  id          uuid         primary key default gen_random_uuid(),
  event_id    uuid         not null references public.events (id) on delete cascade,
  name        text         not null check (char_length(btrim(name)) between 1 and 120),
  place_id    text,
  address     text,
  lat         numeric(9,6),
  lng         numeric(9,6),
  place_type  text,
  sort_order  smallint     not null default 0,
  created_by  uuid         references public.profiles (id) on delete set null,
  created_at  timestamptz  not null default now()
);

create index event_locations_event_idx
  on public.event_locations (event_id, sort_order);

create table public.event_responses (
  date_option_id  uuid                  not null references public.event_date_options (id) on delete cascade,
  user_id         uuid                  not null references public.profiles (id) on delete cascade,
  response        public.event_response not null,
  responded_at    timestamptz           not null default now(),
  primary key (date_option_id, user_id)
);

create index event_responses_user_idx
  on public.event_responses (user_id);

create function private.set_responded_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.responded_at := now();
  return new;
end;
$$;

create trigger event_responses_set_responded_at
  before update on public.event_responses
  for each row execute function private.set_responded_at();


-- ── Access helpers (private, security definer) ───────────────
-- Security definer so they read participant/event rows without
-- re-entering those tables' RLS policies. All are about the *caller*
-- (auth.uid()), so they reveal nothing about other users.
create function private.is_conversation_member(p_conversation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.conversation_participants
    where conversation_id = p_conversation_id
      and user_id = (select auth.uid())
  );
$$;

create function private.shares_conversation_with(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.conversation_participants mine
    join public.conversation_participants theirs
      on theirs.conversation_id = mine.conversation_id
    where mine.user_id = (select auth.uid())
      and theirs.user_id = p_user_id
  );
$$;

create function private.is_event_member(p_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.events e
    join public.conversation_participants p
      on p.conversation_id = e.conversation_id
    where e.id = p_event_id
      and p.user_id = (select auth.uid())
  );
$$;

create function private.is_event_creator(p_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.events
    where id = p_event_id
      and created_by = (select auth.uid())
  );
$$;

create function private.is_date_option_member(p_date_option_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.event_date_options o
    join public.events e on e.id = o.event_id
    join public.conversation_participants p on p.conversation_id = e.conversation_id
    where o.id = p_date_option_id
      and p.user_id = (select auth.uid())
  );
$$;

-- Creator may always add; other members only when the event allows it.
-- Both must still be members of the conversation.
create function private.can_add_date_option(p_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.events e
    join public.conversation_participants p on p.conversation_id = e.conversation_id
    where e.id = p_event_id
      and p.user_id = (select auth.uid())
      and (e.created_by = (select auth.uid()) or e.allow_alt_dates)
  );
$$;

create function private.can_add_location(p_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.events e
    join public.conversation_participants p on p.conversation_id = e.conversation_id
    where e.id = p_event_id
      and p.user_id = (select auth.uid())
      and (e.created_by = (select auth.uid()) or e.allow_alt_locations)
  );
$$;


-- ── Row level security ───────────────────────────────────────
alter table public.profiles                  enable row level security;
alter table public.conversations             enable row level security;
alter table public.conversation_participants enable row level security;
alter table public.messages                  enable row level security;
alter table public.conversation_invites      enable row level security;
alter table public.events                    enable row level security;
alter table public.event_date_options        enable row level security;
alter table public.event_locations           enable row level security;
alter table public.event_responses           enable row level security;

-- profiles: no insert (trigger) and no delete (cascades from auth.users).
create policy "profiles: read self and co-participants"
  on public.profiles for select to authenticated
  using (id = (select auth.uid()) or private.shares_conversation_with(id));

create policy "profiles: update self"
  on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- conversations: created only via create_conversation().
create policy "conversations: read as member"
  on public.conversations for select to authenticated
  using (private.is_conversation_member(id));

create policy "conversations: creator updates"
  on public.conversations for update to authenticated
  using (created_by = (select auth.uid()))
  with check (created_by = (select auth.uid()));

create policy "conversations: creator deletes"
  on public.conversations for delete to authenticated
  using (created_by = (select auth.uid()));

-- participants: joined only via RPCs; members can leave.
create policy "participants: read as member"
  on public.conversation_participants for select to authenticated
  using (private.is_conversation_member(conversation_id));

create policy "participants: leave"
  on public.conversation_participants for delete to authenticated
  using (user_id = (select auth.uid()));

-- messages: immutable once sent.
create policy "messages: read as member"
  on public.messages for select to authenticated
  using (private.is_conversation_member(conversation_id));

create policy "messages: send as self"
  on public.messages for insert to authenticated
  with check (
    sender_id = (select auth.uid())
    and kind = 'user'
    and private.is_conversation_member(conversation_id)
  );

-- invites: redeemed only via accept_invite().
create policy "invites: read as member"
  on public.conversation_invites for select to authenticated
  using (private.is_conversation_member(conversation_id));

create policy "invites: members create"
  on public.conversation_invites for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and private.is_conversation_member(conversation_id)
  );

create policy "invites: creator revokes"
  on public.conversation_invites for update to authenticated
  using (created_by = (select auth.uid()))
  with check (created_by = (select auth.uid()));

-- events
create policy "events: read as member"
  on public.events for select to authenticated
  using (private.is_conversation_member(conversation_id));

create policy "events: members create"
  on public.events for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and private.is_conversation_member(conversation_id)
  );

create policy "events: creator updates"
  on public.events for update to authenticated
  using (created_by = (select auth.uid()))
  with check (created_by = (select auth.uid()));

create policy "events: creator deletes"
  on public.events for delete to authenticated
  using (created_by = (select auth.uid()));

-- event_date_options
create policy "date options: read as member"
  on public.event_date_options for select to authenticated
  using (private.is_event_member(event_id));

create policy "date options: add when allowed"
  on public.event_date_options for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and private.can_add_date_option(event_id)
  );

create policy "date options: event creator deletes"
  on public.event_date_options for delete to authenticated
  using (private.is_event_creator(event_id));

-- event_locations
create policy "locations: read as member"
  on public.event_locations for select to authenticated
  using (private.is_event_member(event_id));

create policy "locations: add when allowed"
  on public.event_locations for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and private.can_add_location(event_id)
  );

create policy "locations: event creator updates"
  on public.event_locations for update to authenticated
  using (private.is_event_creator(event_id))
  with check (private.is_event_creator(event_id));

create policy "locations: event creator deletes"
  on public.event_locations for delete to authenticated
  using (private.is_event_creator(event_id));

-- event_responses: your own row per date option, if you're a member.
create policy "responses: read as member"
  on public.event_responses for select to authenticated
  using (private.is_date_option_member(date_option_id));

create policy "responses: insert own"
  on public.event_responses for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and private.is_date_option_member(date_option_id)
  );

create policy "responses: update own"
  on public.event_responses for update to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and private.is_date_option_member(date_option_id)
  );

create policy "responses: delete own"
  on public.event_responses for delete to authenticated
  using (user_id = (select auth.uid()));


-- ── RPCs (public API) ────────────────────────────────────────
-- Errors are raised with a stable snake_case message for the data layer
-- to map (src/data/). Auth failures use 42501 (→ HTTP 403).

-- Create a conversation with the caller as its first participant.
-- Security definer because there is deliberately no participant INSERT policy.
create function public.create_conversation(
  p_name text default null,
  p_type public.conversation_type default 'group'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_id  uuid;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  insert into public.conversations (type, name, created_by)
  values (p_type, nullif(btrim(p_name), ''), v_uid)
  returning id into v_id;

  insert into public.conversation_participants (conversation_id, user_id)
  values (v_id, v_uid);

  return v_id;
end;
$$;

-- Add existing users (e.g. phonebook matches) to a conversation the caller
-- belongs to. Returns how many were newly added.
create function public.add_participants(
  p_conversation_id uuid,
  p_user_ids uuid[]
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_added integer;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if not private.is_conversation_member(p_conversation_id) then
    raise exception 'not_a_member' using errcode = '42501';
  end if;
  if coalesce(cardinality(p_user_ids), 0) > 256 then
    raise exception 'too_many_users';
  end if;

  insert into public.conversation_participants (conversation_id, user_id)
  select p_conversation_id, p.id
  from public.profiles p
  where p.id = any (p_user_ids)
  on conflict do nothing;

  get diagnostics v_added = row_count;
  return v_added;
end;
$$;

-- Redeem an invite code. Idempotent for existing members (doesn't use up
-- the invite). Input is normalised: case-insensitive, separators ignored.
create function public.accept_invite(p_code text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid    uuid := auth.uid();
  v_code   text := upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
  v_invite public.conversation_invites;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  select * into v_invite
  from public.conversation_invites
  where code = v_code
  for update;

  if not found then
    raise exception 'invite_not_found';
  end if;
  if v_invite.revoked_at is not null then
    raise exception 'invite_revoked';
  end if;
  if v_invite.expires_at <= now() then
    raise exception 'invite_expired';
  end if;

  if exists (
    select 1 from public.conversation_participants
    where conversation_id = v_invite.conversation_id and user_id = v_uid
  ) then
    return v_invite.conversation_id;
  end if;

  if v_invite.max_uses is not null and v_invite.use_count >= v_invite.max_uses then
    raise exception 'invite_exhausted';
  end if;

  insert into public.conversation_participants (conversation_id, user_id)
  values (v_invite.conversation_id, v_uid);

  update public.conversation_invites
  set use_count = use_count + 1
  where id = v_invite.id;

  return v_invite.conversation_id;
end;
$$;

-- Contact discovery for phonebook invites: given E.164 numbers, return only
-- those that belong to other users. The profiles table itself is never
-- searchable by phone. (Enumeration via repeated calls is inherent to contact
-- discovery; add rate limiting before public launch.)
create function public.match_phone_numbers(p_phone_numbers text[])
returns table (user_id uuid, display_name text, phone_number text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if coalesce(cardinality(p_phone_numbers), 0) > 1000 then
    raise exception 'too_many_numbers';
  end if;

  return query
  select p.id, p.display_name, p.phone_number
  from public.profiles p
  where p.phone_number = any (p_phone_numbers)
    and p.id <> auth.uid();
end;
$$;

-- Create an event with its date options and locations in one transaction.
-- Security INVOKER: every insert is checked by the caller's own RLS policies.
create function public.create_event(
  p_conversation_id     uuid,
  p_title               text,
  p_description         text          default null,
  p_starts_at           timestamptz[] default '{}',
  p_locations           text[]        default '{}',
  p_allow_alt_dates     boolean       default false,
  p_allow_alt_locations boolean       default false
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_id  uuid := gen_random_uuid();
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  insert into public.events (
    id, conversation_id, created_by, title, description,
    allow_alt_dates, allow_alt_locations
  )
  values (
    v_id, p_conversation_id, v_uid, btrim(p_title), nullif(btrim(p_description), ''),
    p_allow_alt_dates, p_allow_alt_locations
  );

  insert into public.event_date_options (event_id, starts_at, created_by)
  select v_id, s, v_uid
  from unnest(coalesce(p_starts_at, '{}')) as s;

  insert into public.event_locations (event_id, name, sort_order, created_by)
  select v_id, btrim(l.name), (l.ord - 1)::smallint, v_uid
  from unnest(coalesce(p_locations, '{}')) with ordinality as l(name, ord);

  return v_id;
end;
$$;


-- ── Grants ───────────────────────────────────────────────────
-- Supabase's default privileges grant everything to anon/authenticated;
-- replace that with an explicit allow-list. RLS still applies on top.
revoke all on all tables in schema public from anon, authenticated;

grant select                                                   on public.profiles to authenticated;
grant update (display_name, avatar_url, phone_number)          on public.profiles to authenticated;

grant select, delete                                           on public.conversations to authenticated;
grant update (name)                                            on public.conversations to authenticated;

grant select, delete                                           on public.conversation_participants to authenticated;

grant select                                                   on public.messages to authenticated;
grant insert (id, conversation_id, sender_id, content)         on public.messages to authenticated;

grant select                                                   on public.conversation_invites to authenticated;
grant insert (conversation_id, created_by, expires_at, max_uses) on public.conversation_invites to authenticated;
grant update (revoked_at)                                      on public.conversation_invites to authenticated;

grant select, delete                                           on public.events to authenticated;
grant insert (id, conversation_id, created_by, title, description, allow_alt_dates, allow_alt_locations)
                                                               on public.events to authenticated;
grant update (title, description, status, allow_alt_dates, allow_alt_locations, confirmed_option_id)
                                                               on public.events to authenticated;

grant select, delete                                           on public.event_date_options to authenticated;
grant insert (id, event_id, starts_at, ends_at, created_by)    on public.event_date_options to authenticated;

grant select, delete                                           on public.event_locations to authenticated;
grant insert (id, event_id, name, place_id, address, lat, lng, place_type, sort_order, created_by)
                                                               on public.event_locations to authenticated;
grant update (name, place_id, address, lat, lng, place_type, sort_order)
                                                               on public.event_locations to authenticated;

-- Upserts (insert … on conflict do update) need UPDATE on every column in
-- the payload, including the key columns; RLS keeps user_id pinned to self.
grant select, delete                                           on public.event_responses to authenticated;
grant insert (date_option_id, user_id, response)               on public.event_responses to authenticated;
grant update (date_option_id, user_id, response)               on public.event_responses to authenticated;

-- Functions: Postgres grants EXECUTE to PUBLIC by default. Only signed-in
-- users may call anything.
revoke execute on all functions in schema public  from public, anon;
revoke execute on all functions in schema private from public, anon;
grant  execute on all functions in schema public  to authenticated;
grant  execute on all functions in schema private to authenticated;


-- ── Realtime ─────────────────────────────────────────────────
-- Changes are delivered to subscribers only after their RLS SELECT check.
alter publication supabase_realtime add table
  public.messages,
  public.conversation_participants,
  public.events,
  public.event_date_options,
  public.event_locations,
  public.event_responses;
