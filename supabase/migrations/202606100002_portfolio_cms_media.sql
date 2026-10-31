-- Supabase Storage and media catalog for the namespaced portfolio CMS.
-- Review the remote Storage schema and bucket names before applying.
begin;

create table public.portfolio_cms_media (
  id text primary key,
  storage_key text not null unique,
  mime_type text not null check (mime_type in ('image/jpeg', 'image/png', 'image/webp', 'image/avif')),
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 10485760),
  width integer check (width is null or width > 0),
  height integer check (height is null or height > 0),
  alt text not null default '',
  caption text not null default '',
  deleting boolean not null default false,
  created_by uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint portfolio_cms_media_key_format
    check (storage_key ~ ('^portfolio/' || id || '/' || id || '\.(jpg|jpeg|png|webp|avif)$'))
);

alter table public.portfolio_cms_media enable row level security;
revoke all on public.portfolio_cms_media from anon, authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'portfolio-cms-media',
  'portfolio-cms-media',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/avif']::text[]
);

create policy portfolio_cms_media_upload_admin
  on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'portfolio-cms-media'
    and name ~* '^portfolio/[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|jpeg|png|webp|avif)$'
    and (metadata->>'mimetype') in ('image/jpeg', 'image/png', 'image/webp', 'image/avif')
    and exists (
      select 1 from public.portfolio_cms_admins a
      where a.user_id = (select auth.uid())
    )
  );

create function public.portfolio_cms_list_media()
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $function$
begin
  perform public.portfolio_cms_assert_admin();
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', m.id,
      'source', jsonb_build_object('kind', 'storage', 'key', m.storage_key),
      'mimeType', m.mime_type,
      'width', m.width,
      'height', m.height,
      'sizeBytes', m.size_bytes,
      'alt', m.alt,
      'caption', m.caption,
      'deleting', m.deleting
    ) order by m.created_at desc)
    from public.portfolio_cms_media m
  ), '[]'::jsonb);
end;
$function$;

create function public.portfolio_cms_can_read_media_object(p_storage_key text)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, auth
as $function$
  select exists (
    select 1
    from public.portfolio_cms_admins a
    where a.user_id = auth.uid()
  ) or exists (
    select 1
    from public.portfolio_cms_sites s
    join public.portfolio_cms_revisions r
      on r.id = s.published_revision_id
     and r.site_id = s.id
     and r.status = 'published'
    cross join lateral jsonb_array_elements(coalesce(r.snapshot->'media', '[]'::jsonb)) asset
    where s.id = 'portfolio'
      and asset->'source'->>'kind' = 'storage'
      and asset->'source'->>'key' = p_storage_key
  )
$function$;

create policy portfolio_cms_media_read_published
  on storage.objects
  for select to anon, authenticated
  using (
    bucket_id = 'portfolio-cms-media'
    and public.portfolio_cms_can_read_media_object(name)
  );

create function public.portfolio_cms_register_media(
  p_id text,
  p_storage_key text,
  p_mime_type text,
  p_size_bytes bigint,
  p_width integer,
  p_height integer,
  p_alt text,
  p_caption text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth, storage
as $function$
declare
  requester_id uuid := public.portfolio_cms_assert_admin();
  object_row storage.objects%rowtype;
begin
  if p_id !~ '^[0-9a-f-]{36}$'
    or p_storage_key !~ ('^portfolio/' || p_id || '/' || p_id || '\.(jpg|jpeg|png|webp|avif)$')
    or p_mime_type not in ('image/jpeg', 'image/png', 'image/webp', 'image/avif')
    or p_size_bytes < 1 or p_size_bytes > 10485760
  then
    raise exception 'Invalid media metadata' using errcode = '22023';
  end if;

  select * into object_row
  from storage.objects
  where bucket_id = 'portfolio-cms-media' and name = p_storage_key;
  if not found
    or object_row.metadata->>'mimetype' is distinct from p_mime_type
    or object_row.metadata->>'size' !~ '^[0-9]+$'
    or (object_row.metadata->>'size')::bigint <> p_size_bytes
  then
    raise exception 'Uploaded object does not match the media metadata' using errcode = '22023';
  end if;

  insert into public.portfolio_cms_media (
    id, storage_key, mime_type, size_bytes, width, height, alt, caption, created_by
  )
  values (
    p_id, p_storage_key, p_mime_type, p_size_bytes, p_width, p_height,
    coalesce(p_alt, ''), coalesce(p_caption, ''), requester_id
  );

  return jsonb_build_object(
    'id', p_id,
    'source', jsonb_build_object('kind', 'storage', 'key', p_storage_key),
    'mimeType', p_mime_type,
    'width', p_width,
    'height', p_height,
    'sizeBytes', p_size_bytes,
    'alt', coalesce(p_alt, ''),
    'caption', coalesce(p_caption, '')
  );
end;
$function$;

create function public.portfolio_cms_update_media(
  p_id text,
  p_alt text,
  p_caption text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $function$
declare
  updated_row public.portfolio_cms_media%rowtype;
begin
  perform public.portfolio_cms_assert_admin();
  update public.portfolio_cms_media
  set alt = coalesce(p_alt, ''), caption = coalesce(p_caption, ''), updated_at = now()
  where id = p_id and not deleting
  returning * into updated_row;

  if not found then
    raise exception 'Media record not found' using errcode = '22023';
  end if;

  return jsonb_build_object('id', updated_row.id, 'alt', updated_row.alt, 'caption', updated_row.caption);
end;
$function$;

create function public.portfolio_cms_begin_media_delete(p_id text)
returns text
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $function$
declare
  media_row public.portfolio_cms_media%rowtype;
begin
  perform public.portfolio_cms_assert_admin();
  perform 1 from public.portfolio_cms_sites where id = 'portfolio' for update;

  select * into media_row
  from public.portfolio_cms_media
  where id = p_id
  for update;
  if not found then
    raise exception 'Media record not found' using errcode = '22023';
  end if;

  if exists (
    select 1
    from public.portfolio_cms_revisions r
    cross join lateral jsonb_array_elements(coalesce(r.snapshot->'media', '[]'::jsonb)) asset
    where asset->>'id' = media_row.id
      and asset->'source'->>'kind' = 'storage'
      and asset->'source'->>'key' = media_row.storage_key
  ) then
    raise exception 'Media is retained by revision history' using errcode = '55000';
  end if;

  update public.portfolio_cms_media
  set deleting = true, updated_at = now()
  where id = p_id;
  return media_row.storage_key;
end;
$function$;

create function public.portfolio_cms_finish_media_delete(p_id text)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public, auth, storage
as $function$
declare
  media_row public.portfolio_cms_media%rowtype;
begin
  perform public.portfolio_cms_assert_admin();
  perform 1 from public.portfolio_cms_sites where id = 'portfolio' for update;

  select * into media_row
  from public.portfolio_cms_media
  where id = p_id and deleting
  for update;
  if not found then
    raise exception 'Media deletion was not requested' using errcode = '22023';
  end if;

  if exists (
    select 1 from storage.objects
    where bucket_id = 'portfolio-cms-media' and name = media_row.storage_key
  ) then
    raise exception 'Storage object still exists; retry object deletion' using errcode = '55000';
  end if;

  delete from public.portfolio_cms_media where id = p_id;
  return true;
end;
$function$;

create function public.portfolio_cms_can_delete_media_object(p_storage_key text)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $function$
begin
  if not exists (
    select 1 from public.portfolio_cms_admins
    where user_id = auth.uid()
  ) then
    return false;
  end if;

  return exists (
    select 1 from public.portfolio_cms_media m
    where m.storage_key = p_storage_key and m.deleting
  ) and not exists (
    select 1
    from public.portfolio_cms_revisions r
    cross join lateral jsonb_array_elements(coalesce(r.snapshot->'media', '[]'::jsonb)) asset
    where asset->'source'->>'kind' = 'storage'
      and asset->'source'->>'key' = p_storage_key
  );
end;
$function$;

create policy portfolio_cms_media_delete_admin
  on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'portfolio-cms-media'
    and public.portfolio_cms_can_delete_media_object(name)
  );

create function public.portfolio_cms_validate_revision_media()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
begin
  if exists (
    select 1
    from jsonb_array_elements(coalesce(new.snapshot->'media', '[]'::jsonb)) asset
    where asset->'source'->>'kind' = 'storage'
      and not exists (
        select 1
        from public.portfolio_cms_media m
        where m.id = asset->>'id'
          and m.storage_key = asset->'source'->>'key'
          and not m.deleting
      )
  ) then
    raise exception 'Snapshot references missing or deleting CMS media' using errcode = '23503';
  end if;

  return new;
end;
$function$;

create trigger portfolio_cms_revisions_validate_media
  before insert on public.portfolio_cms_revisions
  for each row execute function public.portfolio_cms_validate_revision_media();

revoke all on function public.portfolio_cms_list_media() from public, anon, authenticated;
revoke all on function public.portfolio_cms_can_read_media_object(text) from public, anon, authenticated;
revoke all on function public.portfolio_cms_register_media(text, text, text, bigint, integer, integer, text, text) from public, anon, authenticated;
revoke all on function public.portfolio_cms_update_media(text, text, text) from public, anon, authenticated;
revoke all on function public.portfolio_cms_begin_media_delete(text) from public, anon, authenticated;
revoke all on function public.portfolio_cms_finish_media_delete(text) from public, anon, authenticated;
revoke all on function public.portfolio_cms_can_delete_media_object(text) from public, anon, authenticated;
revoke all on function public.portfolio_cms_validate_revision_media() from public, anon, authenticated;

grant execute on function public.portfolio_cms_list_media() to authenticated;
grant execute on function public.portfolio_cms_can_read_media_object(text) to anon, authenticated;
grant execute on function public.portfolio_cms_register_media(text, text, text, bigint, integer, integer, text, text) to authenticated;
grant execute on function public.portfolio_cms_update_media(text, text, text) to authenticated;
grant execute on function public.portfolio_cms_begin_media_delete(text) to authenticated;
grant execute on function public.portfolio_cms_finish_media_delete(text) to authenticated;
grant execute on function public.portfolio_cms_can_delete_media_object(text) to authenticated;

commit;
