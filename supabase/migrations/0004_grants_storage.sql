-- ════════════════════════════════════════════════════════════════════════════
-- منتديات أثر — الصلاحيات الصريحة والتخزين
--
-- دفاع متعدّد الطبقات: حتى لو سقطت سياسة RLS سهوًا، لا يملك الزائر المجهول
-- صلاحية الجدول أصلًا.
-- ════════════════════════════════════════════════════════════════════════════

revoke all on all tables in schema public from anon, authenticated;

-- ── الزائر المجهول: قراءة المحتوى المنشور فقط ──────────────────────────────
grant select on public.forums to anon;
grant select on public.events to anon;
grant select on public.posts  to anon;

-- ── الموظّف المسجَّل ────────────────────────────────────────────────────────
grant select on public.forums to authenticated;
grant select on public.events to authenticated;
grant select on public.posts  to authenticated;
grant select on public.site_settings to authenticated;
grant select on public.audit_log to authenticated;
grant select on public.waitlist_subscribers to authenticated;

grant select, update on public.profiles to authenticated;
grant select, insert, update, delete on public.forum_memberships to authenticated;
grant select, insert, update, delete on public.event_registrations to authenticated;

-- الكتابة على المحتوى محكومة بـ RLS (مشرف أو رئيس منتدى)
grant insert, update, delete on public.forums to authenticated;
grant insert, update, delete on public.events to authenticated;
grant insert, update, delete on public.posts  to authenticated;
grant update on public.site_settings to authenticated;
grant delete on public.waitlist_subscribers to authenticated;

-- ════════════════════════════════════════════════════════════════════════════
-- دليل أعضاء المنتدى — يُظهر الاسم والمسمّى فقط، لا البريد ولا الرقم الوظيفي
-- ════════════════════════════════════════════════════════════════════════════

create or replace function public.forum_members_public(target_slug text)
returns table (
  profile_id uuid,
  full_name_ar text,
  full_name_en text,
  job_title text,
  avatar_url text,
  skills text[],
  membership_role public.membership_role,
  joined_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id,
    p.full_name_ar,
    p.full_name_en,
    p.job_title,
    p.avatar_url,
    p.skills,
    m.role,
    m.decided_at
  from public.forum_memberships m
  join public.forums f on f.id = m.forum_id
  join public.profiles p on p.id = m.profile_id
  where f.slug = target_slug
    and f.status = 'published'
    and m.status = 'approved'
    and p.is_active
  order by
    case m.role when 'lead' then 0 when 'core' then 1 else 2 end,
    m.decided_at nulls last;
$$;

revoke all on function public.forum_members_public(text) from public;
grant execute on function public.forum_members_public(text) to anon, authenticated;

/** إحصاءات الصفحة الرئيسية — أرقام مجمّعة لا تكشف أفرادًا. */
create or replace function public.platform_stats()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'forums', (select count(*) from public.forums where status = 'published'),
    'members', (select count(distinct profile_id) from public.forum_memberships where status = 'approved'),
    'events', (select count(*) from public.events where status = 'published'),
    'upcoming_events', (select count(*) from public.events where status = 'published' and starts_at >= now())
  );
$$;

revoke all on function public.platform_stats() from public;
grant execute on function public.platform_stats() to anon, authenticated;

-- ════════════════════════════════════════════════════════════════════════════
-- التخزين
-- ════════════════════════════════════════════════════════════════════════════

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('media',   'media',   true, 8388608,  array['image/png','image/jpeg','image/webp','image/svg+xml','image/avif']),
  ('avatars', 'avatars', true, 2097152,  array['image/png','image/jpeg','image/webp','image/avif'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ── media: قراءة للجميع، رفع للمشرفين ورؤساء المنتديات ─────────────────────
drop policy if exists "media: public read" on storage.objects;
create policy "media: public read"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'media');

drop policy if exists "media: staff write" on storage.objects;
create policy "media: staff write"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'media'
    and (public.is_admin() or public.current_app_role() = 'forum_lead')
  );

drop policy if exists "media: staff update" on storage.objects;
create policy "media: staff update"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'media'
    and (public.is_admin() or public.current_app_role() = 'forum_lead')
  );

drop policy if exists "media: admins delete" on storage.objects;
create policy "media: admins delete"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'media' and public.is_admin());

-- ── avatars: كل موظف يكتب في مجلّده باسم معرّفه فقط ────────────────────────
drop policy if exists "avatars: public read" on storage.objects;
create policy "avatars: public read"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'avatars');

drop policy if exists "avatars: write own folder" on storage.objects;
create policy "avatars: write own folder"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "avatars: update own folder" on storage.objects;
create policy "avatars: update own folder"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "avatars: delete own folder" on storage.objects;
create policy "avatars: delete own folder"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'avatars'
    and ((storage.foldername(name))[1] = (select auth.uid())::text or public.is_admin())
  );
