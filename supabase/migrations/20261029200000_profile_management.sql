-- RelayChat: profile management fields + avatar storage
-- Additive only. Does not drop messaging tables or weaken conversation RLS.

-- ---------------------------------------------------------------------------
-- Profile columns
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists phone_number text
    check (
      phone_number is null
      or (
        char_length(trim(phone_number)) between 7 and 20
        and trim(phone_number) ~ '^\+?[0-9][0-9\s\-().]{5,18}[0-9]$'
      )
    );

alter table public.profiles
  add column if not exists bio text
    check (bio is null or char_length(bio) <= 280);

alter table public.profiles
  add column if not exists status_message text
    check (
      status_message is null
      or char_length(trim(status_message)) between 1 and 120
    );

comment on column public.profiles.phone_number is 'Optional contact phone; stored as user-entered text.';
comment on column public.profiles.bio is 'Optional short bio (max 280).';
comment on column public.profiles.status_message is 'Optional presence-style status line.';

-- Allow authenticated users to create their own profile row (idempotent with trigger).
grant insert on table public.profiles to authenticated;

drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own
on public.profiles
for insert
to authenticated
with check (id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Avatar storage bucket (public read; write limited to own folder)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,
  2097152,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists avatars_public_read on storage.objects;
create policy avatars_public_read
on storage.objects
for select
to public
using (bucket_id = 'avatars');

drop policy if exists avatars_insert_own on storage.objects;
create policy avatars_insert_own
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

drop policy if exists avatars_update_own on storage.objects;
create policy avatars_update_own
on storage.objects
for update
to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
)
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

drop policy if exists avatars_delete_own on storage.objects;
create policy avatars_delete_own
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);
