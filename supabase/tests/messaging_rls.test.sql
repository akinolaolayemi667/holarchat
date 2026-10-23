-- RelayChat RLS tests (pgTAP / Supabase db test style)
-- Run with: supabase test db
-- These tests do NOT pass until applied against a live database with the migration.

begin;

create extension if not exists pgtap with schema extensions;

select plan(18);

-- Fixtures: three auth users
select tests.create_supabase_user('alice@example.com');
select tests.create_supabase_user('bob@example.com');
select tests.create_supabase_user('carol@example.com');

-- Profiles should exist via trigger; if helpers differ, insert defensively
insert into public.profiles (id, display_name)
select id, 'Alice' from auth.users where email = 'alice@example.com'
on conflict (id) do update set display_name = excluded.display_name;

insert into public.profiles (id, display_name)
select id, 'Bob' from auth.users where email = 'bob@example.com'
on conflict (id) do update set display_name = excluded.display_name;

insert into public.profiles (id, display_name)
select id, 'Carol' from auth.users where email = 'carol@example.com'
on conflict (id) do update set display_name = excluded.display_name;

-- Unauthenticated cannot read profiles
set local role anon;
reset request.jwt.claim.sub;
select is_empty(
  $$ select * from public.profiles $$,
  'anon cannot select profiles'
);

select throws_ok(
  $$ insert into public.messages (conversation_id, body) values (gen_random_uuid(), 'x') $$,
  'anon cannot insert messages'
);

-- Authenticate as Alice
select tests.authenticate_as('alice@example.com');

-- Alice creates a direct conversation with Bob
create temporary table vars (
  alice uuid,
  bob uuid,
  carol uuid,
  conv uuid,
  msg uuid
);

insert into vars (alice, bob, carol)
select
  (select id from auth.users where email = 'alice@example.com'),
  (select id from auth.users where email = 'bob@example.com'),
  (select id from auth.users where email = 'carol@example.com');

update vars
set conv = public.create_direct_conversation((select bob from vars));

select ok(
  (select conv from vars) is not null,
  'alice can create direct conversation with bob'
);

-- Alice can list the conversation
select isnt_empty(
  $$ select * from public.conversations where id = (select conv from vars) $$,
  'alice can read own conversation'
);

-- Carol (non-member) cannot read that conversation
select tests.authenticate_as('carol@example.com');
select is_empty(
  $$ select * from public.conversations where id = (select conv from vars) $$,
  'non-member cannot read conversation'
);
select is_empty(
  $$ select * from public.messages where conversation_id = (select conv from vars) $$,
  'non-member cannot read messages'
);

-- Alice sends a message
select tests.authenticate_as('alice@example.com');
insert into public.messages (conversation_id, body, client_id)
values (
  (select conv from vars),
  'hello bob',
  '11111111-1111-1111-1111-111111111111'
)
returning id into temporary table msg_tmp;

update vars set msg = (select id from msg_tmp);

select is(
  (select sender_id from public.messages where id = (select msg from vars)),
  (select alice from vars),
  'sender_id forced to auth.uid()'
);

-- Impersonation attempt: trigger rewrites sender_id to auth.uid()
insert into public.messages (conversation_id, sender_id, body, client_id)
values (
  (select conv from vars),
  (select bob from vars),
  'spoof attempt',
  '22222222-2222-2222-2222-222222222222'
);

select is(
  (
    select sender_id from public.messages
    where client_id = '22222222-2222-2222-2222-222222222222'
  ),
  (select alice from vars),
  'sender impersonation is rewritten to auth.uid()'
);

-- Duplicate client_id rejected
select throws_ok(
  format(
    $$ insert into public.messages (conversation_id, body, client_id)
       values (%L, 'dup', '11111111-1111-1111-1111-111111111111') $$,
    (select conv from vars)
  ),
  'duplicate client_id is rejected'
);

-- Bob can read and mark delivered
select tests.authenticate_as('bob@example.com');
select isnt_empty(
  $$ select * from public.messages where id = (select msg from vars) $$,
  'bob can read member messages'
);

select lives_ok(
  $$ select public.mark_messages_delivered(array[(select msg from vars)]) $$,
  'bob can mark delivered'
);

-- Alice cannot forge Bob delivery row as herself for wrong user
select tests.authenticate_as('alice@example.com');
select throws_ok(
  format(
    $$ insert into public.message_deliveries (message_id, user_id, delivered_at)
       values (%L, %L, now()) $$,
    (select msg from vars),
    (select bob from vars)
  ),
  'cannot insert delivery receipt for another user'
);

-- Unauthorized update of another profile
select throws_ok(
  format(
    $$ update public.profiles set display_name = 'Hacked' where id = %L $$,
    (select bob from vars)
  ),
  'cannot update another user profile'
);

-- Bob can update own profile
select tests.authenticate_as('bob@example.com');
select lives_ok(
  $$ update public.profiles set display_name = 'Bobby' where id = (select bob from vars) $$,
  'user can update own profile'
);

-- Conversation isolation: Carol still blocked after messages exist
select tests.authenticate_as('carol@example.com');
select is_empty(
  $$ select * from public.messages where conversation_id = (select conv from vars) $$,
  'conversation isolation holds for non-member'
);

-- Body length validation
select tests.authenticate_as('alice@example.com');
select throws_ok(
  format(
    $$ insert into public.messages (conversation_id, body) values (%L, '') $$,
    (select conv from vars)
  ),
  'empty body rejected'
);

select * from finish();
rollback;
