-- ════════════════════════════════════════════════════════════════════════════
-- منتديات أثر — أمن الصفوف (Row Level Security)
--
-- المبدأ: المنع افتراضيًا. كل جدول مقفل، ثم نفتح بالضبط ما يلزم.
-- ملاحظة: نلفّ auth.uid() بـ (select ...) لأن Postgres يقيّمها مرة واحدة
-- بدل كل صف — فرق أداء كبير على الجداول الكبيرة.
-- ════════════════════════════════════════════════════════════════════════════

alter table public.site_settings          enable row level security;
alter table public.profiles               enable row level security;
alter table public.forums                 enable row level security;
alter table public.forum_memberships      enable row level security;
alter table public.events                 enable row level security;
alter table public.event_registrations    enable row level security;
alter table public.posts                  enable row level security;
alter table public.waitlist_subscribers   enable row level security;
alter table public.audit_log              enable row level security;

-- ════════════════════════════════════════════════════════════════════════════
-- site_settings — لا يُقرأ الجدول مباشرة من العموم (يحوي بُرد المشرفين الأوائل)
-- ════════════════════════════════════════════════════════════════════════════

drop policy if exists "settings: admins read" on public.site_settings;
create policy "settings: admins read"
  on public.site_settings for select
  to authenticated
  using (public.is_admin());

drop policy if exists "settings: admins update" on public.site_settings;
create policy "settings: admins update"
  on public.site_settings for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

/** الإعدادات العامة الآمنة — متاحة للجميع بلا كشف الحقول الحسّاسة. */
create or replace function public.get_public_settings()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'launch_at', launch_at,
    'teaser_mode', teaser_mode,
    'registration_open', registration_open,
    'allowed_email_domains', allowed_email_domains,
    'site_name_ar', site_name_ar,
    'site_name_en', site_name_en,
    'tagline_ar', tagline_ar,
    'tagline_en', tagline_en,
    'about_ar', about_ar,
    'about_en', about_en,
    'contact_email', contact_email
  )
  from public.site_settings
  where id;
$$;

revoke all on function public.get_public_settings() from public;
grant execute on function public.get_public_settings() to anon, authenticated;

-- ════════════════════════════════════════════════════════════════════════════
-- profiles — البريد والرقم الوظيفي والجوال لا تُكشف لبقيّة الموظفين
-- ════════════════════════════════════════════════════════════════════════════

drop policy if exists "profiles: read own" on public.profiles;
create policy "profiles: read own"
  on public.profiles for select
  to authenticated
  using ((select auth.uid()) = id);

drop policy if exists "profiles: admins read all" on public.profiles;
create policy "profiles: admins read all"
  on public.profiles for select
  to authenticated
  using (public.is_admin());

drop policy if exists "profiles: leads read their applicants" on public.profiles;
create policy "profiles: leads read their applicants"
  on public.profiles for select
  to authenticated
  using (
    exists (
      select 1
      from public.forum_memberships m
      where m.profile_id = public.profiles.id
        and public.is_forum_lead(m.forum_id)
    )
  );

drop policy if exists "profiles: update own" on public.profiles;
create policy "profiles: update own"
  on public.profiles for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

drop policy if exists "profiles: admins update" on public.profiles;
create policy "profiles: admins update"
  on public.profiles for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

/**
 * المستخدم لا يستطيع ترقية نفسه. أي تغيير على role أو is_active يجب أن يأتي
 * من مشرف — وهذا يُفحص هنا لا في الواجهة.
 */
create or replace function public.guard_profile_privileges()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_admin() then
    -- حتى المشرف لا يستطيع ترقية نفسه إلى super_admin
    if new.role = 'super_admin'
       and old.role is distinct from 'super_admin'
       and not public.is_super_admin() then
      raise exception 'رفع الصلاحية إلى «مشرف أعلى» يحتاج مشرفًا أعلى.'
        using errcode = '42501';
    end if;
    return new;
  end if;

  new.role := old.role;
  new.is_active := old.is_active;
  new.email := old.email;
  return new;
end;
$$;

drop trigger if exists profiles_guard_privileges on public.profiles;
create trigger profiles_guard_privileges
  before update on public.profiles
  for each row execute function public.guard_profile_privileges();

-- ════════════════════════════════════════════════════════════════════════════
-- forums
-- ════════════════════════════════════════════════════════════════════════════

drop policy if exists "forums: public reads published" on public.forums;
create policy "forums: public reads published"
  on public.forums for select
  to anon, authenticated
  using (status = 'published');

drop policy if exists "forums: admins read all" on public.forums;
create policy "forums: admins read all"
  on public.forums for select
  to authenticated
  using (public.is_admin() or public.is_forum_lead(id));

drop policy if exists "forums: admins insert" on public.forums;
create policy "forums: admins insert"
  on public.forums for insert
  to authenticated
  with check (public.is_admin());

drop policy if exists "forums: admins and leads update" on public.forums;
create policy "forums: admins and leads update"
  on public.forums for update
  to authenticated
  using (public.is_admin() or public.is_forum_lead(id))
  with check (public.is_admin() or public.is_forum_lead(id));

drop policy if exists "forums: admins delete" on public.forums;
create policy "forums: admins delete"
  on public.forums for delete
  to authenticated
  using (public.is_admin());

/** رئيس المنتدى يحرّر المحتوى الوصفي فقط — لا الحالة ولا الطاقة ولا الرابط. */
create or replace function public.guard_forum_privileged_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_admin() then
    return new;
  end if;

  new.slug := old.slug;
  new.status := old.status;
  new.capacity := old.capacity;
  new.auto_approve := old.auto_approve;
  new.sort_order := old.sort_order;
  new.members_count := old.members_count;
  new.created_by := old.created_by;
  return new;
end;
$$;

drop trigger if exists forums_guard_columns on public.forums;
create trigger forums_guard_columns
  before update on public.forums
  for each row execute function public.guard_forum_privileged_columns();

-- ════════════════════════════════════════════════════════════════════════════
-- forum_memberships
-- ════════════════════════════════════════════════════════════════════════════

drop policy if exists "memberships: read own" on public.forum_memberships;
create policy "memberships: read own"
  on public.forum_memberships for select
  to authenticated
  using ((select auth.uid()) = profile_id);

drop policy if exists "memberships: leads and admins read" on public.forum_memberships;
create policy "memberships: leads and admins read"
  on public.forum_memberships for select
  to authenticated
  using (public.is_admin() or public.is_forum_lead(forum_id));

drop policy if exists "memberships: apply for self" on public.forum_memberships;
create policy "memberships: apply for self"
  on public.forum_memberships for insert
  to authenticated
  with check (
    (select auth.uid()) = profile_id
    and status = 'pending'
    and role = 'member'
    and exists (
      select 1 from public.forums f
      where f.id = forum_id
        and f.status = 'published'
        and f.is_accepting
    )
  );

drop policy if exists "memberships: admins insert" on public.forum_memberships;
create policy "memberships: admins insert"
  on public.forum_memberships for insert
  to authenticated
  with check (public.is_admin());

drop policy if exists "memberships: withdraw own" on public.forum_memberships;
create policy "memberships: withdraw own"
  on public.forum_memberships for update
  to authenticated
  using ((select auth.uid()) = profile_id)
  with check ((select auth.uid()) = profile_id and status = 'withdrawn');

drop policy if exists "memberships: leads and admins decide" on public.forum_memberships;
create policy "memberships: leads and admins decide"
  on public.forum_memberships for update
  to authenticated
  using (public.is_admin() or public.is_forum_lead(forum_id))
  with check (public.is_admin() or public.is_forum_lead(forum_id));

drop policy if exists "memberships: admins delete" on public.forum_memberships;
create policy "memberships: admins delete"
  on public.forum_memberships for delete
  to authenticated
  using (public.is_admin() or public.is_forum_lead(forum_id));

/** القبول التلقائي إن كان المنتدى يسمح به. */
create or replace function public.apply_forum_auto_approve()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  auto boolean;
begin
  if new.status = 'pending' then
    select auto_approve into auto from public.forums where id = new.forum_id;
    if coalesce(auto, false) then
      new.status := 'approved';
      new.decided_at := now();
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists memberships_auto_approve on public.forum_memberships;
create trigger memberships_auto_approve
  before insert on public.forum_memberships
  for each row execute function public.apply_forum_auto_approve();

-- ════════════════════════════════════════════════════════════════════════════
-- events
-- ════════════════════════════════════════════════════════════════════════════

drop policy if exists "events: public reads published" on public.events;
create policy "events: public reads published"
  on public.events for select
  to anon, authenticated
  using (
    status = 'published'
    and (
      not members_only
      or (forum_id is not null and public.is_forum_member(forum_id))
      or public.is_admin()
    )
  );

drop policy if exists "events: leads and admins read all" on public.events;
create policy "events: leads and admins read all"
  on public.events for select
  to authenticated
  using (public.is_admin() or (forum_id is not null and public.is_forum_lead(forum_id)));

drop policy if exists "events: leads and admins write" on public.events;
create policy "events: leads and admins write"
  on public.events for insert
  to authenticated
  with check (public.is_admin() or (forum_id is not null and public.is_forum_lead(forum_id)));

drop policy if exists "events: leads and admins update" on public.events;
create policy "events: leads and admins update"
  on public.events for update
  to authenticated
  using (public.is_admin() or (forum_id is not null and public.is_forum_lead(forum_id)))
  with check (public.is_admin() or (forum_id is not null and public.is_forum_lead(forum_id)));

drop policy if exists "events: admins delete" on public.events;
create policy "events: admins delete"
  on public.events for delete
  to authenticated
  using (public.is_admin() or (forum_id is not null and public.is_forum_lead(forum_id)));

-- ════════════════════════════════════════════════════════════════════════════
-- event_registrations
-- ════════════════════════════════════════════════════════════════════════════

drop policy if exists "event regs: read own" on public.event_registrations;
create policy "event regs: read own"
  on public.event_registrations for select
  to authenticated
  using ((select auth.uid()) = profile_id);

drop policy if exists "event regs: organizers read" on public.event_registrations;
create policy "event regs: organizers read"
  on public.event_registrations for select
  to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.events e
      where e.id = event_id and e.forum_id is not null and public.is_forum_lead(e.forum_id)
    )
  );

drop policy if exists "event regs: register self" on public.event_registrations;
create policy "event regs: register self"
  on public.event_registrations for insert
  to authenticated
  with check (
    (select auth.uid()) = profile_id
    and exists (
      select 1 from public.events e
      where e.id = event_id
        and e.status = 'published'
        and e.registration_open
        and (
          not e.members_only
          or (e.forum_id is not null and public.is_forum_member(e.forum_id))
        )
    )
  );

drop policy if exists "event regs: cancel own" on public.event_registrations;
create policy "event regs: cancel own"
  on public.event_registrations for update
  to authenticated
  using ((select auth.uid()) = profile_id)
  with check ((select auth.uid()) = profile_id);

drop policy if exists "event regs: organizers update" on public.event_registrations;
create policy "event regs: organizers update"
  on public.event_registrations for update
  to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.events e
      where e.id = event_id and e.forum_id is not null and public.is_forum_lead(e.forum_id)
    )
  )
  with check (true);

-- ════════════════════════════════════════════════════════════════════════════
-- posts
-- ════════════════════════════════════════════════════════════════════════════

drop policy if exists "posts: public reads published" on public.posts;
create policy "posts: public reads published"
  on public.posts for select
  to anon, authenticated
  using (status = 'published' and published_at is not null and published_at <= now());

drop policy if exists "posts: leads and admins read all" on public.posts;
create policy "posts: leads and admins read all"
  on public.posts for select
  to authenticated
  using (public.is_admin() or (forum_id is not null and public.is_forum_lead(forum_id)));

drop policy if exists "posts: leads and admins insert" on public.posts;
create policy "posts: leads and admins insert"
  on public.posts for insert
  to authenticated
  with check (public.is_admin() or (forum_id is not null and public.is_forum_lead(forum_id)));

drop policy if exists "posts: leads and admins update" on public.posts;
create policy "posts: leads and admins update"
  on public.posts for update
  to authenticated
  using (public.is_admin() or (forum_id is not null and public.is_forum_lead(forum_id)))
  with check (public.is_admin() or (forum_id is not null and public.is_forum_lead(forum_id)));

drop policy if exists "posts: admins delete" on public.posts;
create policy "posts: admins delete"
  on public.posts for delete
  to authenticated
  using (public.is_admin() or (forum_id is not null and public.is_forum_lead(forum_id)));

-- ════════════════════════════════════════════════════════════════════════════
-- waitlist — لا أحد يقرأ القائمة إلا المشرفون، والإضافة تمرّ عبر دالّة فقط
-- ════════════════════════════════════════════════════════════════════════════

drop policy if exists "waitlist: admins read" on public.waitlist_subscribers;
create policy "waitlist: admins read"
  on public.waitlist_subscribers for select
  to authenticated
  using (public.is_admin());

drop policy if exists "waitlist: admins delete" on public.waitlist_subscribers;
create policy "waitlist: admins delete"
  on public.waitlist_subscribers for delete
  to authenticated
  using (public.is_admin());

-- ════════════════════════════════════════════════════════════════════════════
-- audit_log — قراءة للمشرفين، والكتابة عبر service_role فقط
-- ════════════════════════════════════════════════════════════════════════════

drop policy if exists "audit: admins read" on public.audit_log;
create policy "audit: admins read"
  on public.audit_log for select
  to authenticated
  using (public.is_admin());
