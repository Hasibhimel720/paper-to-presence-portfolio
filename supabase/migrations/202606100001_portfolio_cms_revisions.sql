-- Additive portfolio CMS storage. Review the remote schema for name collisions
-- before applying; this migration intentionally does not alter existing tables.
begin;

create table public.portfolio_cms_admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.portfolio_cms_sites (
  id text primary key,
  draft_revision_id uuid,
  published_revision_id uuid,
  updated_at timestamptz not null default now(),
  constraint portfolio_cms_sites_single_site check (id = 'portfolio')
);

create table public.portfolio_cms_revisions (
  id uuid primary key default gen_random_uuid(),
  site_id text not null references public.portfolio_cms_sites (id) on delete cascade,
  revision_number bigint not null check (revision_number > 0),
  status text not null check (status in ('draft', 'published', 'unpublished')),
  snapshot jsonb not null check (jsonb_typeof(snapshot) = 'object'),
  based_on_revision_id uuid references public.portfolio_cms_revisions (id),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  published_at timestamptz,
  unique (site_id, revision_number)
);

create index portfolio_cms_revisions_site_created_idx
  on public.portfolio_cms_revisions (site_id, created_at desc);

alter table public.portfolio_cms_sites
  add constraint portfolio_cms_sites_draft_revision_fk
  foreign key (draft_revision_id) references public.portfolio_cms_revisions (id);

alter table public.portfolio_cms_sites
  add constraint portfolio_cms_sites_published_revision_fk
  foreign key (published_revision_id) references public.portfolio_cms_revisions (id);

insert into public.portfolio_cms_sites (id)
values ('portfolio');

alter table public.portfolio_cms_admins enable row level security;
alter table public.portfolio_cms_sites enable row level security;
alter table public.portfolio_cms_revisions enable row level security;

create policy portfolio_cms_admins_read_self
  on public.portfolio_cms_admins
  for select to authenticated
  using (user_id = (select auth.uid()));

revoke all on public.portfolio_cms_admins from anon, authenticated;
grant select on public.portfolio_cms_admins to authenticated;
revoke all on public.portfolio_cms_sites from anon, authenticated;
revoke all on public.portfolio_cms_revisions from anon, authenticated;

create function public.portfolio_cms_assert_admin()
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $function$
declare
  requester_id uuid := auth.uid();
begin
  if requester_id is null or not exists (
    select 1
    from public.portfolio_cms_admins
    where user_id = requester_id
  ) then
    raise exception 'Administrator authorization required' using errcode = '42501';
  end if;

  return requester_id;
end;
$function$;

create function public.portfolio_cms_admin_state(p_site_id text default 'portfolio')
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $function$
declare
  site_row public.portfolio_cms_sites%rowtype;
  selected_revision uuid;
  selected_snapshot jsonb;
begin
  perform public.portfolio_cms_assert_admin();
  if p_site_id <> 'portfolio' then
    raise exception 'Unknown CMS site' using errcode = '22023';
  end if;

  select * into site_row
  from public.portfolio_cms_sites
  where id = p_site_id;

  if not found then
    raise exception 'CMS site is not initialized' using errcode = '55000';
  end if;

  selected_revision := coalesce(
    site_row.draft_revision_id,
    site_row.published_revision_id,
    (
      select r.id
      from public.portfolio_cms_revisions r
      where r.site_id = p_site_id
      order by r.revision_number desc
      limit 1
    )
  );

  if selected_revision is not null then
    select snapshot into selected_snapshot
    from public.portfolio_cms_revisions
    where id = selected_revision and site_id = p_site_id;
  end if;

  return jsonb_build_object(
    'snapshot', selected_snapshot,
    'current_revision_id', selected_revision,
    'draft_revision_id', site_row.draft_revision_id,
    'published_revision_id', site_row.published_revision_id,
    'updated_at', site_row.updated_at,
    'revisions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', r.id,
        'number', r.revision_number,
        'status', r.status,
        'created_at', r.created_at,
        'updated_at', r.created_at,
        'published_at', r.published_at,
        'based_on_revision_id', r.based_on_revision_id,
        'created_by', r.created_by
      ) order by r.revision_number desc)
      from public.portfolio_cms_revisions r
      where r.site_id = p_site_id
    ), '[]'::jsonb)
  );
end;
$function$;

create function public.portfolio_cms_save_draft(
  p_site_id text,
  p_expected_revision_id uuid,
  p_snapshot jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $function$
declare
  requester_id uuid := public.portfolio_cms_assert_admin();
  site_row public.portfolio_cms_sites%rowtype;
  next_revision_number bigint;
  new_revision_id uuid;
  based_on_id uuid;
  stored_snapshot jsonb;
begin
  if p_snapshot is null
    or p_site_id <> 'portfolio'
    or jsonb_typeof(p_snapshot) <> 'object'
    or p_snapshot->>'schemaVersion' <> '1'
    or jsonb_typeof(p_snapshot->'projects') <> 'array'
    or jsonb_typeof(p_snapshot->'pages') <> 'array'
  then
    raise exception 'Invalid CMS snapshot' using errcode = '22023';
  end if;

  select * into site_row
  from public.portfolio_cms_sites
  where id = p_site_id
  for update;

  if not found then
    raise exception 'CMS site is not initialized' using errcode = '55000';
  end if;
  based_on_id := coalesce(
    site_row.draft_revision_id,
    site_row.published_revision_id,
    (
      select r.id
      from public.portfolio_cms_revisions r
      where r.site_id = p_site_id
      order by r.revision_number desc
      limit 1
    )
  );
  if based_on_id is distinct from p_expected_revision_id then
    raise exception 'Draft revision conflict' using errcode = '40001';
  end if;

  select coalesce(max(revision_number), 0) + 1 into next_revision_number
  from public.portfolio_cms_revisions
  where site_id = p_site_id;

  stored_snapshot := jsonb_set(
    jsonb_set(
      jsonb_set(p_snapshot, '{origin}', '"cms"'::jsonb, true),
      '{revisions}', '[]'::jsonb, true
    ),
    '{publication}',
    '{"status":"unpublished","publishedRevisionId":null,"draftRevisionId":null,"updatedAt":null}'::jsonb,
    true
  );

  insert into public.portfolio_cms_revisions (
    site_id, revision_number, status, snapshot, based_on_revision_id, created_by
  )
  values (
    p_site_id, next_revision_number, 'draft', stored_snapshot, based_on_id, requester_id
  )
  returning id into new_revision_id;

  update public.portfolio_cms_sites
  set draft_revision_id = new_revision_id, updated_at = now()
  where id = p_site_id;

  return jsonb_build_object('revision_id', new_revision_id);
end;
$function$;

create function public.portfolio_cms_restore_revision(
  p_site_id text,
  p_revision_id uuid,
  p_expected_revision_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $function$
declare
  requester_id uuid := public.portfolio_cms_assert_admin();
  site_row public.portfolio_cms_sites%rowtype;
  source_snapshot jsonb;
  next_revision_number bigint;
  new_revision_id uuid;
begin
  if p_site_id <> 'portfolio' then
    raise exception 'Unknown CMS site' using errcode = '22023';
  end if;

  select * into site_row
  from public.portfolio_cms_sites
  where id = p_site_id
  for update;
  if not found then
    raise exception 'CMS site is not initialized' using errcode = '55000';
  end if;
  if coalesce(
    site_row.draft_revision_id,
    site_row.published_revision_id,
    (
      select r.id
      from public.portfolio_cms_revisions r
      where r.site_id = p_site_id
      order by r.revision_number desc
      limit 1
    )
  ) is distinct from p_expected_revision_id then
    raise exception 'Draft revision conflict' using errcode = '40001';
  end if;

  select snapshot into source_snapshot
  from public.portfolio_cms_revisions
  where id = p_revision_id and site_id = p_site_id;
  if not found then
    raise exception 'Revision not found' using errcode = '22023';
  end if;

  select coalesce(max(revision_number), 0) + 1 into next_revision_number
  from public.portfolio_cms_revisions
  where site_id = p_site_id;

  insert into public.portfolio_cms_revisions (
    site_id, revision_number, status, snapshot, based_on_revision_id, created_by
  )
  values (
    p_site_id, next_revision_number, 'draft', source_snapshot, p_revision_id, requester_id
  )
  returning id into new_revision_id;

  update public.portfolio_cms_sites
  set draft_revision_id = new_revision_id, updated_at = now()
  where id = p_site_id;

  return jsonb_build_object('revision_id', new_revision_id);
end;
$function$;

create function public.portfolio_cms_publish(
  p_site_id text,
  p_revision_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $function$
declare
  site_row public.portfolio_cms_sites%rowtype;
begin
  perform public.portfolio_cms_assert_admin();
  if p_site_id <> 'portfolio' then
    raise exception 'Unknown CMS site' using errcode = '22023';
  end if;

  select * into site_row
  from public.portfolio_cms_sites
  where id = p_site_id
  for update;
  if not found or site_row.draft_revision_id is distinct from p_revision_id then
    raise exception 'Draft revision conflict' using errcode = '40001';
  end if;

  if site_row.published_revision_id is not null then
    update public.portfolio_cms_revisions
    set status = 'unpublished'
    where id = site_row.published_revision_id and site_id = p_site_id;
  end if;

  update public.portfolio_cms_revisions
  set status = 'published', published_at = now()
  where id = p_revision_id and site_id = p_site_id and status = 'draft';
  if not found then
    raise exception 'Draft revision not found' using errcode = '22023';
  end if;

  update public.portfolio_cms_sites
  set published_revision_id = p_revision_id, draft_revision_id = null, updated_at = now()
  where id = p_site_id;

  return jsonb_build_object('published_revision_id', p_revision_id);
end;
$function$;

create function public.portfolio_cms_unpublish(p_site_id text)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $function$
declare
  site_row public.portfolio_cms_sites%rowtype;
begin
  perform public.portfolio_cms_assert_admin();
  if p_site_id <> 'portfolio' then
    raise exception 'Unknown CMS site' using errcode = '22023';
  end if;

  select * into site_row
  from public.portfolio_cms_sites
  where id = p_site_id
  for update;
  if not found then
    raise exception 'CMS site is not initialized' using errcode = '55000';
  end if;

  if site_row.published_revision_id is not null then
    update public.portfolio_cms_revisions
    set status = 'unpublished'
    where id = site_row.published_revision_id and site_id = p_site_id;
  end if;

  update public.portfolio_cms_sites
  set published_revision_id = null, updated_at = now()
  where id = p_site_id;

  return jsonb_build_object('published_revision_id', null);
end;
$function$;

create function public.portfolio_cms_get_published_snapshot(p_site_id text default 'portfolio')
returns jsonb
language sql
security definer
set search_path = pg_catalog, public
as $function$
  select jsonb_build_object(
    'snapshot', r.snapshot,
    'revision', jsonb_build_object(
      'id', r.id,
      'number', r.revision_number,
      'status', r.status,
      'created_at', r.created_at,
      'updated_at', r.created_at,
      'published_at', r.published_at,
      'based_on_revision_id', null,
      'created_by', null
    )
  )
  from public.portfolio_cms_sites s
  join public.portfolio_cms_revisions r
    on r.id = s.published_revision_id
   and r.site_id = s.id
   and r.status = 'published'
  where s.id = p_site_id and p_site_id = 'portfolio'
$function$;

revoke all on function public.portfolio_cms_assert_admin() from public, anon, authenticated;
revoke all on function public.portfolio_cms_admin_state(text) from public, anon, authenticated;
revoke all on function public.portfolio_cms_save_draft(text, uuid, jsonb) from public, anon, authenticated;
revoke all on function public.portfolio_cms_restore_revision(text, uuid, uuid) from public, anon, authenticated;
revoke all on function public.portfolio_cms_publish(text, uuid) from public, anon, authenticated;
revoke all on function public.portfolio_cms_unpublish(text) from public, anon, authenticated;
revoke all on function public.portfolio_cms_get_published_snapshot(text) from public, anon, authenticated;

grant execute on function public.portfolio_cms_admin_state(text) to authenticated;
grant execute on function public.portfolio_cms_save_draft(text, uuid, jsonb) to authenticated;
grant execute on function public.portfolio_cms_restore_revision(text, uuid, uuid) to authenticated;
grant execute on function public.portfolio_cms_publish(text, uuid) to authenticated;
grant execute on function public.portfolio_cms_unpublish(text) to authenticated;
grant execute on function public.portfolio_cms_get_published_snapshot(text) to anon, authenticated;

comment on table public.portfolio_cms_admins is
  'Trusted administrator allowlist. Provision user IDs only through a separately reviewed privileged operation.';

commit;
