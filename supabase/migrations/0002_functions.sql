-- ════════════════════════════════════════════════════════════════════════════
-- منتديات أثر — الدوال والمشغّلات
-- ════════════════════════════════════════════════════════════════════════════

-- ── دوال مساعدة للصلاحيات ──────────────────────────────────────────────────
-- SECURITY DEFINER مع search_path مقفل: تمنع الالتفاف وتمنع الدوران اللانهائي
-- في سياسات RLS التي تحتاج قراءة جدول profiles.

create or replace function public.current_app_role()
returns public.app_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select role in ('admin', 'super_admin') from public.profiles where id = auth.uid()),
    false
  );
$$;

create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select role = 'super_admin' from public.profiles where id = auth.uid()),
    false
  );
$$;

/** هل المستخدم الحالي قائد/عضو أساسي في هذا المنتدى؟ */
create or replace function public.is_forum_lead(target_forum uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.forum_memberships m
    where m.forum_id = target_forum
      and m.profile_id = auth.uid()
      and m.status = 'approved'
      and m.role in ('lead', 'core')
  );
$$;

/** هل المستخدم الحالي عضو معتمد في هذا المنتدى؟ */
create or replace function public.is_forum_member(target_forum uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.forum_memberships m
    where m.forum_id = target_forum
      and m.profile_id = auth.uid()
      and m.status = 'approved'
  );
$$;

revoke all on function public.current_app_role() from public;
revoke all on function public.is_admin() from public;
revoke all on function public.is_super_admin() from public;
revoke all on function public.is_forum_lead(uuid) from public;
revoke all on function public.is_forum_member(uuid) from public;

grant execute on function public.current_app_role() to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_super_admin() to authenticated;
grant execute on function public.is_forum_lead(uuid) to authenticated;
grant execute on function public.is_forum_member(uuid) to authenticated;

-- ════════════════════════════════════════════════════════════════════════════
-- تقييد التسجيل على نطاق بريد الوزارة — على مستوى قاعدة البيانات
-- هذه هي الحارس الحقيقي. التحقّق في الواجهة تجميلي فقط ويمكن الالتفاف عليه.
-- ════════════════════════════════════════════════════════════════════════════

create or replace function public.enforce_allowed_email_domain()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  allowed text[];
  incoming_domain text;
begin
  select allowed_email_domains into allowed from public.site_settings where id;

  -- إن لم تُضبط قائمة النطاقات، لا نفتح الباب — نمنع افتراضيًا.
  if allowed is null or array_length(allowed, 1) is null then
    raise exception 'التسجيل مغلق: لم تُضبط نطاقات البريد المسموح بها.'
      using errcode = '42501';
  end if;

  incoming_domain := lower(split_part(new.email, '@', 2));

  if not (incoming_domain = any (select lower(unnest(allowed)))) then
    raise exception 'التسجيل مقصور على البريد الرسمي للوزارة (%).',
      array_to_string(allowed, '، ')
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_email_domain on auth.users;
create trigger enforce_email_domain
  before insert on auth.users
  for each row execute function public.enforce_allowed_email_domain();

-- ── إنشاء الملف الشخصي تلقائيًا عند التسجيل ────────────────────────────────
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  bootstrap text[];
  assigned_role public.app_role := 'member';
begin
  select bootstrap_admin_emails into bootstrap from public.site_settings where id;

  if bootstrap is not null
     and lower(new.email) = any (select lower(unnest(bootstrap))) then
    assigned_role := 'super_admin';
  end if;

  insert into public.profiles (id, email, full_name_ar, role)
  values (
    new.id,
    new.email,
    nullif(trim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), ''),
    assigned_role
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── عدّاد أعضاء المنتدى ────────────────────────────────────────────────────
create or replace function public.sync_forum_members_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  affected uuid;
begin
  affected := coalesce(new.forum_id, old.forum_id);

  update public.forums f
  set members_count = (
    select count(*) from public.forum_memberships m
    where m.forum_id = affected and m.status = 'approved'
  )
  where f.id = affected;

  return coalesce(new, old);
end;
$$;

drop trigger if exists memberships_sync_count on public.forum_memberships;
create trigger memberships_sync_count
  after insert or update of status or delete on public.forum_memberships
  for each row execute function public.sync_forum_members_count();

-- ── عدّاد تسجيلات الفعالية ─────────────────────────────────────────────────
create or replace function public.sync_event_registrations_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  affected uuid;
begin
  affected := coalesce(new.event_id, old.event_id);

  update public.events e
  set registrations_count = (
    select count(*) from public.event_registrations r
    where r.event_id = affected and r.status = 'registered'
  )
  where e.id = affected;

  return coalesce(new, old);
end;
$$;

drop trigger if exists event_regs_sync_count on public.event_registrations;
create trigger event_regs_sync_count
  after insert or update of status or delete on public.event_registrations
  for each row execute function public.sync_event_registrations_count();

-- ── رفع صلاحية رئيس المنتدى على مستوى المنصّة ──────────────────────────────
create or replace function public.sync_forum_lead_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'approved' and new.role in ('lead', 'core') then
    update public.profiles
    set role = 'forum_lead'
    where id = new.profile_id and role = 'member';
  end if;
  return new;
end;
$$;

drop trigger if exists memberships_sync_lead_role on public.forum_memberships;
create trigger memberships_sync_lead_role
  after insert or update of role, status on public.forum_memberships
  for each row execute function public.sync_forum_lead_role();

-- ── منع تجاوز الطاقة الاستيعابية للمنتدى ───────────────────────────────────
create or replace function public.enforce_forum_capacity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  cap int;
  current_count int;
begin
  if new.status <> 'approved' then
    return new;
  end if;

  select capacity into cap from public.forums where id = new.forum_id;
  if cap is null then
    return new;
  end if;

  select count(*) into current_count
  from public.forum_memberships
  where forum_id = new.forum_id
    and status = 'approved'
    and id <> new.id;

  if current_count >= cap then
    raise exception 'اكتمل العدد في هذا المنتدى (الطاقة الاستيعابية %).', cap
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists memberships_enforce_capacity on public.forum_memberships;
create trigger memberships_enforce_capacity
  before insert or update of status on public.forum_memberships
  for each row execute function public.enforce_forum_capacity();

-- ── التسجيل في قائمة المتحمّسين (بدون كشف الجدول للعموم) ───────────────────
create or replace function public.join_waitlist(
  subscriber_email text,
  subscriber_name text default null,
  subscriber_source text default 'teaser'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  cleaned citext := lower(trim(subscriber_email));
begin
  if cleaned !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'صيغة البريد الإلكتروني غير صحيحة.' using errcode = '22023';
  end if;

  insert into public.waitlist_subscribers (email, full_name, source)
  values (cleaned, nullif(trim(coalesce(subscriber_name, '')), ''), subscriber_source)
  on conflict (email) do update
    set full_name = coalesce(excluded.full_name, public.waitlist_subscribers.full_name);
end;
$$;

revoke all on function public.join_waitlist(text, text, text) from public;
grant execute on function public.join_waitlist(text, text, text) to anon, authenticated;
