-- RelayChat Phase 2: messaging schema, RLS, and secure helpers
-- Hybrid delivery: Postgres is source of truth for text messages.
-- WebRTC DataChannels are NOT implemented in this migration.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Private schema for sensitive helpers (not exposed via PostgREST)
-- ---------------------------------------------------------------------------
create schema if not exists private;
revoke all on schema private from public;
revoke all on schema private from anon, authenticated;
grant usage on schema private to postgres, service_role;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null
    check (char_length(trim(display_name)) between 1 and 80),
  avatar_url text
    check (avatar_url is null or char_length(avatar_url) <= 2048),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('direct', 'group')),
  title text
    check (
      title is null
      or (char_length(trim(title)) between 1 and 120)
    ),
  created_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint conversations_group_title_chk check (
    (type = 'direct' and title is null)
    or (type = 'group' and title is not null)
  )
);

create table public.conversation_members (
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);

create unique index conversation_members_user_conversation_uidx
  on public.conversation_members (user_id, conversation_id);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete restrict,
  body text not null
    check (char_length(body) between 1 and 4000),
  message_type text not null default 'text'
    check (message_type in ('text', 'system')),
  -- client_id enables idempotent sends (optimistic UI + retries)
  client_id uuid,
  created_at timestamptz not null default now(),
  constraint messages_text_body_chk check (
    message_type <> 'text' or char_length(trim(body)) >= 1
  )
);

create unique index messages_client_id_uidx
  on public.messages (client_id)
  where client_id is not null;

create index messages_conversation_created_idx
  on public.messages (conversation_id, created_at desc, id desc);

create index messages_sender_idx on public.messages (sender_id);

-- Delivery receipts are separate from persistence.
-- persisted = messages row exists
-- delivered = delivered_at set by recipient
-- read = read_at set by recipient
create table public.message_deliveries (
  message_id uuid not null references public.messages (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  delivered_at timestamptz,
  read_at timestamptz,
  primary key (message_id, user_id),
  constraint message_deliveries_read_after_delivered_chk check (
    read_at is null
    or delivered_at is not null
  )
);

create index message_deliveries_user_idx on public.message_deliveries (user_id);

-- ---------------------------------------------------------------------------
-- updated_at helper
-- ---------------------------------------------------------------------------
create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function private.set_updated_at();

create trigger conversations_set_updated_at
before update on public.conversations
for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- Profile bootstrap on signup
-- ---------------------------------------------------------------------------
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text;
begin
  v_name := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
    nullif(trim(split_part(new.email, '@', 1)), ''),
    'User'
  );

  insert into public.profiles (id, display_name)
  values (new.id, left(v_name, 80))
  on conflict (id) do nothing;

  return new;
end;
$$;

revoke all on function private.handle_new_user() from public;
grant execute on function private.handle_new_user() to supabase_auth_admin;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function private.handle_new_user();

-- ---------------------------------------------------------------------------
-- Membership helper (avoids recursive RLS)
-- ---------------------------------------------------------------------------
create or replace function private.is_conversation_member(p_conversation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.conversation_members m
    where m.conversation_id = p_conversation_id
      and m.user_id = (select auth.uid())
  );
$$;

revoke all on function private.is_conversation_member(uuid) from public;
grant execute on function private.is_conversation_member(uuid) to authenticated;

create or replace function private.shares_conversation_with(p_other_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.conversation_members me
    join public.conversation_members them
      on them.conversation_id = me.conversation_id
    where me.user_id = (select auth.uid())
      and them.user_id = p_other_user_id
  );
$$;

revoke all on function private.shares_conversation_with(uuid) from public;
grant execute on function private.shares_conversation_with(uuid) to authenticated;

-- Force sender_id = auth.uid(); block client impersonation
create or replace function private.messages_force_sender()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'not authenticated';
  end if;

  new.sender_id := (select auth.uid());

  if new.message_type is distinct from 'text' and new.message_type is distinct from 'system' then
    raise exception 'invalid message_type';
  end if;

  -- Regular users may only insert text messages
  if (select auth.role()) = 'authenticated' and new.message_type <> 'text' then
    raise exception 'authenticated users may only send text messages';
  end if;

  if not private.is_conversation_member(new.conversation_id) then
    raise exception 'not a conversation member';
  end if;

  return new;
end;
$$;

create trigger messages_force_sender
before insert on public.messages
for each row execute function private.messages_force_sender();

create or replace function private.touch_conversation_on_message()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.conversations
  set updated_at = now()
  where id = new.conversation_id;
  return new;
end;
$$;

create trigger messages_touch_conversation
after insert on public.messages
for each row execute function private.touch_conversation_on_message();

-- ---------------------------------------------------------------------------
-- Secure conversation creation (transactional)
-- ---------------------------------------------------------------------------
create or replace function public.create_direct_conversation(other_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := (select auth.uid());
  v_existing uuid;
  v_new uuid;
begin
  if v_me is null then
    raise exception 'not authenticated';
  end if;

  if other_user_id is null or other_user_id = v_me then
    raise exception 'invalid peer';
  end if;

  if not exists (select 1 from public.profiles p where p.id = other_user_id) then
    raise exception 'user not found';
  end if;

  select c.id
  into v_existing
  from public.conversations c
  where c.type = 'direct'
    and exists (
      select 1 from public.conversation_members m
      where m.conversation_id = c.id and m.user_id = v_me
    )
    and exists (
      select 1 from public.conversation_members m
      where m.conversation_id = c.id and m.user_id = other_user_id
    )
    and (
      select count(*) from public.conversation_members m
      where m.conversation_id = c.id
    ) = 2
  limit 1;

  if v_existing is not null then
    return v_existing;
  end if;

  insert into public.conversations (type, created_by)
  values ('direct', v_me)
  returning id into v_new;

  insert into public.conversation_members (conversation_id, user_id, role)
  values
    (v_new, v_me, 'owner'),
    (v_new, other_user_id, 'member');

  return v_new;
end;
$$;

revoke all on function public.create_direct_conversation(uuid) from public;
grant execute on function public.create_direct_conversation(uuid) to authenticated;

create or replace function public.create_group_conversation(p_title text, member_ids uuid[])
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := (select auth.uid());
  v_new uuid;
  v_member uuid;
  v_unique uuid[];
begin
  if v_me is null then
    raise exception 'not authenticated';
  end if;

  if p_title is null or char_length(trim(p_title)) < 1 or char_length(trim(p_title)) > 120 then
    raise exception 'invalid title';
  end if;

  v_unique := array(
    select distinct x
    from unnest(coalesce(member_ids, '{}'::uuid[])) as x
    where x is distinct from v_me
  );

  if coalesce(array_length(v_unique, 1), 0) < 1 then
    raise exception 'group requires at least one other member';
  end if;

  if exists (
    select 1
    from unnest(v_unique) as mid
    where not exists (select 1 from public.profiles p where p.id = mid)
  ) then
    raise exception 'member not found';
  end if;

  insert into public.conversations (type, title, created_by)
  values ('group', trim(p_title), v_me)
  returning id into v_new;

  insert into public.conversation_members (conversation_id, user_id, role)
  values (v_new, v_me, 'owner');

  foreach v_member in array v_unique
  loop
    insert into public.conversation_members (conversation_id, user_id, role)
    values (v_new, v_member, 'member');
  end loop;

  return v_new;
end;
$$;

revoke all on function public.create_group_conversation(text, uuid[]) from public;
grant execute on function public.create_group_conversation(text, uuid[]) to authenticated;

create or replace function public.mark_messages_delivered(p_message_ids uuid[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := (select auth.uid());
begin
  if v_me is null then
    raise exception 'not authenticated';
  end if;

  insert into public.message_deliveries (message_id, user_id, delivered_at)
  select m.id, v_me, now()
  from public.messages m
  where m.id = any (p_message_ids)
    and m.sender_id is distinct from v_me
    and private.is_conversation_member(m.conversation_id)
  on conflict (message_id, user_id) do update
    set delivered_at = coalesce(public.message_deliveries.delivered_at, excluded.delivered_at);
end;
$$;

revoke all on function public.mark_messages_delivered(uuid[]) from public;
grant execute on function public.mark_messages_delivered(uuid[]) to authenticated;

create or replace function public.mark_messages_read(p_message_ids uuid[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := (select auth.uid());
begin
  if v_me is null then
    raise exception 'not authenticated';
  end if;

  insert into public.message_deliveries (message_id, user_id, delivered_at, read_at)
  select m.id, v_me, now(), now()
  from public.messages m
  where m.id = any (p_message_ids)
    and m.sender_id is distinct from v_me
    and private.is_conversation_member(m.conversation_id)
  on conflict (message_id, user_id) do update
    set delivered_at = coalesce(public.message_deliveries.delivered_at, excluded.delivered_at),
        read_at = coalesce(public.message_deliveries.read_at, excluded.read_at);
end;
$$;

revoke all on function public.mark_messages_read(uuid[]) from public;
grant execute on function public.mark_messages_read(uuid[]) to authenticated;

-- ---------------------------------------------------------------------------
-- Grants: revoke defaults, grant minimally
-- ---------------------------------------------------------------------------
revoke all on table public.profiles from public, anon, authenticated;
revoke all on table public.conversations from public, anon, authenticated;
revoke all on table public.conversation_members from public, anon, authenticated;
revoke all on table public.messages from public, anon, authenticated;
revoke all on table public.message_deliveries from public, anon, authenticated;

grant select, update on table public.profiles to authenticated;
grant select on table public.conversations to authenticated;
grant select on table public.conversation_members to authenticated;
grant select, insert on table public.messages to authenticated;
grant select, insert, update on table public.message_deliveries to authenticated;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages enable row level security;
alter table public.message_deliveries enable row level security;

alter table public.profiles force row level security;
alter table public.conversations force row level security;
alter table public.conversation_members force row level security;
alter table public.messages force row level security;
alter table public.message_deliveries force row level security;

-- profiles
create policy profiles_select_self_or_shared
on public.profiles
for select
to authenticated
using (
  id = (select auth.uid())
  or private.shares_conversation_with(id)
);

create policy profiles_update_own
on public.profiles
for update
to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

-- conversations
create policy conversations_select_member
on public.conversations
for select
to authenticated
using (private.is_conversation_member(id));

-- conversation_members
create policy conversation_members_select_member
on public.conversation_members
for select
to authenticated
using (private.is_conversation_member(conversation_id));

-- messages
create policy messages_select_member
on public.messages
for select
to authenticated
using (private.is_conversation_member(conversation_id));

create policy messages_insert_member_as_self
on public.messages
for insert
to authenticated
with check (
  sender_id = (select auth.uid())
  and private.is_conversation_member(conversation_id)
  and message_type = 'text'
);

-- No update/delete policies for messages: authors cannot rewrite history via API.

-- message_deliveries
create policy message_deliveries_select_member
on public.message_deliveries
for select
to authenticated
using (
  exists (
    select 1
    from public.messages m
    where m.id = message_id
      and private.is_conversation_member(m.conversation_id)
  )
);

create policy message_deliveries_insert_own
on public.message_deliveries
for insert
to authenticated
with check (
  user_id = (select auth.uid())
  and exists (
    select 1
    from public.messages m
    where m.id = message_id
      and m.sender_id is distinct from (select auth.uid())
      and private.is_conversation_member(m.conversation_id)
  )
);

create policy message_deliveries_update_own
on public.message_deliveries
for update
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Realtime publication (RLS still applies to postgres_changes)
-- ---------------------------------------------------------------------------
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.message_deliveries;
