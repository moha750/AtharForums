-- ════════════════════════════════════════════════════════════════════════════
-- منتديات أثر — تصحيحات أمنية ووظيفية بعد مراجعة عدائية
--
-- ما يصلحه هذا الملف، بالترتيب:
--   ١. الزائر المجهول لم يكن يستطيع قراءة الفعاليات إطلاقًا (خطأ صامت)
--   ٢. المنتدى ذو «القبول التلقائي» كان يرفض كل طلبات الانضمام
--   ٣. من ينسحب أو يُرفض كان يُقفل عليه الباب إلى الأبد
--   ٤. دليل الأعضاء كان مكشوفًا للإنترنت بلا تسجيل دخول
--   ٥. المشرف كان يستطيع ترقية نفسه إلى «مشرف أعلى» وفتح نطاق البريد
--   ٦. رئيس المنتدى كان يقرأ جوال وأرقام الموظفين الوظيفية
--   ٧-٩. أعمدة غير مقيَّدة في سياسات التحديث
--   ١٠. «العضو الأساسي» كان مساويًا لرئيس المنتدى في كل شيء
--   ١١. is_active لم يكن يمنع شيئًا
--   ١٢. المشرف كان يستطيع عزل «المشرف الأعلى»
--   ١٣. سجلّ التدقيق كان يستحيل الكتابة فيه
--   ١٤. فعالية عامة «للأعضاء فقط» كانت تختفي عن الجميع
--   ١٥-١٩. عدّادات، وتقييد البريد عند تغييره، وتسريبات صغيرة
-- ════════════════════════════════════════════════════════════════════════════

-- ── الدوال المساعدة: search_path أمتن، وis_active يمنع فعلًا ───────────────

create or replace function public.is_admin()
returns boolean language sql stable security definer
set search_path = pg_catalog, public, pg_temp as $$
  select coalesce(
    (select role in ('admin', 'super_admin') and is_active
     from public.profiles where id = auth.uid()),
    false
  );
$$;

create or replace function public.is_super_admin()
returns boolean language sql stable security definer
set search_path = pg_catalog, public, pg_temp as $$
  select coalesce(
    (select role = 'super_admin' and is_active from public.profiles where id = auth.uid()),
    false
  );
$$;

/** رئيس المنتدى وحده — لقرارات الأشخاص. */
create or replace function public.is_forum_lead(target_forum uuid)
returns boolean language sql stable security definer
set search_path = pg_catalog, public, pg_temp as $$
  select exists (
    select 1 from public.forum_memberships m
    join public.profiles p on p.id = m.profile_id
    where m.forum_id = target_forum
      and m.profile_id = auth.uid()
      and m.status = 'approved'
      and m.role = 'lead'
      and p.is_active
  );
$$;

/** رئيس المنتدى أو الفريق الأساسي — لإدارة المحتوى لا الأشخاص. */
create or replace function public.is_forum_staff(target_forum uuid)
returns boolean language sql stable security definer
set search_path = pg_catalog, public, pg_temp as $$
  select exists (
    select 1 from public.forum_memberships m
    join public.profiles p on p.id = m.profile_id
    where m.forum_id = target_forum
      and m.profile_id = auth.uid()
      and m.status = 'approved'
      and m.role in ('lead', 'core')
      and p.is_active
  );
$$;

create or replace function public.is_forum_member(target_forum uuid)
returns boolean language sql stable security definer
set search_path = pg_catalog, public, pg_temp as $$
  select exists (
    select 1 from public.forum_memberships m
    join public.profiles p on p.id = m.profile_id
    where m.forum_id = target_forum
      and m.profile_id = auth.uid()
      and m.status = 'approved'
      and p.is_active
  );
$$;

/** هل الموقع مفتوح للعموم؟ (بعد التدشين أو بإطفاء الوضع التشويقي) */
create or replace function public.site_is_public()
returns boolean language sql stable security definer
set search_path = pg_catalog, public, pg_temp as $$
  select coalesce(
    (select not teaser_mode or launch_at <= now() from public.site_settings where id),
    false
  );
$$;

revoke all on function public.is_forum_staff(uuid) from public;
revoke all on function public.site_is_public() from public;
grant execute on function public.is_forum_staff(uuid) to authenticated;
grant execute on function public.site_is_public() to anon, authenticated;

-- ════════════════════════════════════════════════════════════════════════════
-- ١ + ١٤ + ١٨: الفعاليات — سياستان منفصلتان، والدوال لا تُستدعى للزائر المجهول
--
-- السبب: PostgreSQL يتحقّق من صلاحية تنفيذ الدالّة عند تهيئة التعبير، قبل
-- فحص أي صف. فوجود is_forum_member() في سياسة يراها anon كان يُفشل كل
-- استعلاماته حتى لو لم تكن هناك فعالية واحدة «للأعضاء فقط».
-- ════════════════════════════════════════════════════════════════════════════

drop policy if exists "events: public reads published" on public.events;

create policy "events: anon reads open published"
  on public.events for select to anon
  using (status = 'published' and not members_only and public.site_is_public());

create policy "events: authenticated reads published"
  on public.events for select to authenticated
  using (
    status = 'published'
    and (public.site_is_public() or public.is_admin())
    and (
      not members_only
      or public.is_admin()
      or (
        case
          when forum_id is null then exists (
            select 1 from public.forum_memberships m
            where m.profile_id = (select auth.uid()) and m.status = 'approved'
          )
          else public.is_forum_member(forum_id)
        end
      )
    )
  );

drop policy if exists "events: leads and admins read all" on public.events;
create policy "events: staff read all"
  on public.events for select to authenticated
  using (public.is_admin() or (forum_id is not null and public.is_forum_staff(forum_id)));

drop policy if exists "events: leads and admins write" on public.events;
create policy "events: staff insert"
  on public.events for insert to authenticated
  with check (public.is_admin() or (forum_id is not null and public.is_forum_staff(forum_id)));

drop policy if exists "events: leads and admins update" on public.events;
create policy "events: staff update"
  on public.events for update to authenticated
  using (public.is_admin() or (forum_id is not null and public.is_forum_staff(forum_id)))
  with check (public.is_admin() or (forum_id is not null and public.is_forum_staff(forum_id)));

drop policy if exists "events: admins delete" on public.events;
create policy "events: staff and admins delete"
  on public.events for delete to authenticated
  using (public.is_admin() or (forum_id is not null and public.is_forum_staff(forum_id)));

-- ── المنتديات والأخبار: بوابة ما قبل التدشين على مستوى قاعدة البيانات ──────

drop policy if exists "forums: public reads published" on public.forums;
create policy "forums: anon reads published"
  on public.forums for select to anon
  using (status = 'published' and public.site_is_public());

create policy "forums: authenticated reads published"
  on public.forums for select to authenticated
  using (status = 'published' and (public.site_is_public() or public.is_admin()));

drop policy if exists "forums: admins read all" on public.forums;
create policy "forums: staff read all"
  on public.forums for select to authenticated
  using (public.is_admin() or public.is_forum_staff(id));

drop policy if exists "forums: admins and leads update" on public.forums;
create policy "forums: staff update"
  on public.forums for update to authenticated
  using (public.is_admin() or public.is_forum_staff(id))
  with check (public.is_admin() or public.is_forum_staff(id));

drop policy if exists "posts: public reads published" on public.posts;
create policy "posts: anon reads published"
  on public.posts for select to anon
  using (
    status = 'published'
    and published_at is not null
    and published_at <= now()
    and public.site_is_public()
  );

create policy "posts: authenticated reads published"
  on public.posts for select to authenticated
  using (
    status = 'published'
    and published_at is not null
    and published_at <= now()
    and (public.site_is_public() or public.is_admin())
  );

drop policy if exists "posts: leads and admins read all" on public.posts;
create policy "posts: staff read all"
  on public.posts for select to authenticated
  using (public.is_admin() or (forum_id is not null and public.is_forum_staff(forum_id)));

drop policy if exists "posts: leads and admins insert" on public.posts;
create policy "posts: staff insert"
  on public.posts for insert to authenticated
  with check (
    (public.is_admin() or (forum_id is not null and public.is_forum_staff(forum_id)))
    and author_id = (select auth.uid())
  );

drop policy if exists "posts: leads and admins update" on public.posts;
create policy "posts: staff update"
  on public.posts for update to authenticated
  using (public.is_admin() or (forum_id is not null and public.is_forum_staff(forum_id)))
  with check (public.is_admin() or (forum_id is not null and public.is_forum_staff(forum_id)));

drop policy if exists "posts: admins delete" on public.posts;
create policy "posts: staff and admins delete"
  on public.posts for delete to authenticated
  using (public.is_admin() or (forum_id is not null and public.is_forum_staff(forum_id)));

-- ════════════════════════════════════════════════════════════════════════════
-- ٢: القبول التلقائي — يصير بعد الإدراج لا قبله
--
-- السبب: مشغّل BEFORE INSERT يعدّل الصف قبل أن يفحصه WITH CHECK، فكان الصف
-- يصل إلى الفحص بحالة approved بينما السياسة تشترط pending — فتُرفض دائمًا.
-- ════════════════════════════════════════════════════════════════════════════

drop trigger if exists memberships_auto_approve on public.forum_memberships;

create or replace function public.apply_forum_auto_approve()
returns trigger language plpgsql security definer
set search_path = pg_catalog, public, pg_temp as $$
declare
  auto boolean;
begin
  if new.status <> 'pending' then
    return null;
  end if;

  select auto_approve into auto from public.forums where id = new.forum_id;

  if coalesce(auto, false) then
    update public.forum_memberships
    set status = 'approved', decided_at = now()
    where id = new.id;
  end if;

  return null;
end;
$$;

create trigger memberships_auto_approve
  after insert on public.forum_memberships
  for each row execute function public.apply_forum_auto_approve();

-- ════════════════════════════════════════════════════════════════════════════
-- ٣ + ٩: العضوية — حارس يثبّت ما لا يملكه العضو، ويسمح بإعادة التقديم
-- ════════════════════════════════════════════════════════════════════════════

create or replace function public.guard_membership_self_update()
returns trigger language plpgsql security definer
set search_path = pg_catalog, public, pg_temp as $$
begin
  if public.is_admin() or public.is_forum_lead(old.forum_id) then
    return new;
  end if;

  -- عضو عادي يعدّل صفّه: كل ما لا يخصّه يعود كما كان
  new.forum_id      := old.forum_id;
  new.profile_id    := old.profile_id;
  new.role          := old.role;
  new.decided_by    := old.decided_by;
  new.decision_note := old.decision_note;

  if new.status not in ('withdrawn', 'pending') then
    new.status := old.status;
  end if;

  -- إعادة التقديم مسموحة بعد الانسحاب أو الرفض فقط
  if new.status = 'pending' and old.status not in ('withdrawn', 'rejected') then
    new.status := old.status;
  end if;

  if new.status = 'pending' and old.status <> 'pending' then
    new.applied_at := now();
    new.decided_at := null;
  end if;

  return new;
end;
$$;

drop trigger if exists memberships_guard_self on public.forum_memberships;
create trigger memberships_guard_self
  before update on public.forum_memberships
  for each row execute function public.guard_membership_self_update();

drop policy if exists "memberships: withdraw own" on public.forum_memberships;
create policy "memberships: manage own application"
  on public.forum_memberships for update to authenticated
  using ((select auth.uid()) = profile_id)
  with check ((select auth.uid()) = profile_id and status in ('withdrawn', 'pending'));

-- ١٠: قرارات الأشخاص لرئيس المنتدى وحده، ولا يقرّر أحد في نفسه
drop policy if exists "memberships: leads and admins decide" on public.forum_memberships;
create policy "memberships: leads and admins decide"
  on public.forum_memberships for update to authenticated
  using (
    (public.is_admin() or public.is_forum_lead(forum_id))
    and (public.is_admin() or profile_id <> (select auth.uid()))
  )
  with check (
    (public.is_admin() or public.is_forum_lead(forum_id))
    and (public.is_admin() or profile_id <> (select auth.uid()))
  );

drop policy if exists "memberships: leads and admins read" on public.forum_memberships;
create policy "memberships: staff and admins read"
  on public.forum_memberships for select to authenticated
  using (public.is_admin() or public.is_forum_staff(forum_id));

drop policy if exists "memberships: admins delete" on public.forum_memberships;
create policy "memberships: leads and admins delete"
  on public.forum_memberships for delete to authenticated
  using (public.is_admin() or public.is_forum_lead(forum_id));

-- العضو لا يتقدّم إلا وهو مفعَّل
drop policy if exists "memberships: apply for self" on public.forum_memberships;
create policy "memberships: apply for self"
  on public.forum_memberships for insert to authenticated
  with check (
    (select auth.uid()) = profile_id
    and status = 'pending'
    and role = 'member'
    and coalesce((select is_active from public.profiles where id = (select auth.uid())), false)
    and exists (
      select 1 from public.forums f
      where f.id = forum_id and f.status = 'published' and f.is_accepting
    )
  );

-- ════════════════════════════════════════════════════════════════════════════
-- ٤ + ٦: بيانات الموظفين — لا دليل أعضاء للعموم، ولا جوال لرئيس المنتدى
-- ════════════════════════════════════════════════════════════════════════════

revoke execute on function public.forum_members_public(text) from anon;

/** دليل الأعضاء: للمسجَّلين فقط، وبعد التدشين. */
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
language sql stable security definer
set search_path = pg_catalog, public, pg_temp as $$
  select p.id, p.full_name_ar, p.full_name_en, p.job_title, p.avatar_url,
         p.skills, m.role, m.decided_at
  from public.forum_memberships m
  join public.forums f on f.id = m.forum_id
  join public.profiles p on p.id = m.profile_id
  where f.slug = target_slug
    and f.status = 'published'
    and m.status = 'approved'
    and p.is_active
    and (public.site_is_public() or public.is_admin())
    and auth.uid() is not null
  order by
    case m.role when 'lead' then 0 when 'core' then 1 else 2 end,
    m.decided_at nulls last;
$$;

revoke all on function public.forum_members_public(text) from public;
grant execute on function public.forum_members_public(text) to authenticated;

-- رئيس المنتدى لم يعد يقرأ جدول profiles مباشرةً — بديله دالّة محدودة الأعمدة
drop policy if exists "profiles: leads read their applicants" on public.profiles;

/** طلبات وأعضاء منتدى بعينه — بلا بريد ولا جوال ولا رقم وظيفي. */
create or replace function public.forum_applicants(target_forum uuid)
returns table (
  profile_id uuid,
  full_name_ar text,
  full_name_en text,
  job_title text,
  department text,
  skills text[],
  membership_id uuid,
  status public.membership_status,
  membership_role public.membership_role,
  motivation text,
  relevant_skills text[],
  applied_at timestamptz
)
language sql stable security definer
set search_path = pg_catalog, public, pg_temp as $$
  select p.id, p.full_name_ar, p.full_name_en, p.job_title, p.department, p.skills,
         m.id, m.status, m.role, m.motivation, m.relevant_skills, m.applied_at
  from public.forum_memberships m
  join public.profiles p on p.id = m.profile_id
  where m.forum_id = target_forum
    and public.is_forum_lead(target_forum)
    and m.status in ('pending', 'approved')
  order by m.applied_at;
$$;

revoke all on function public.forum_applicants(uuid) from public;
grant execute on function public.forum_applicants(uuid) to authenticated;

-- ════════════════════════════════════════════════════════════════════════════
-- ٥: إعدادات الموقع — نطاقات البريد وبُرد المشرفين الأوائل للمشرف الأعلى وحده
-- ════════════════════════════════════════════════════════════════════════════

create or replace function public.guard_site_settings()
returns trigger language plpgsql security definer
set search_path = pg_catalog, public, pg_temp as $$
begin
  if not public.is_super_admin() then
    -- هذان العمودان يتحكّمان بمن يدخل المنصّة أصلًا
    new.bootstrap_admin_emails := old.bootstrap_admin_emails;
    new.allowed_email_domains  := old.allowed_email_domains;
  end if;
  new.id := true;
  new.updated_by := auth.uid();
  return new;
end;
$$;

drop trigger if exists site_settings_guard on public.site_settings;
create trigger site_settings_guard
  before update on public.site_settings
  for each row execute function public.guard_site_settings();

-- بُرد المشرفين الأوائل تعمل مرة واحدة: ما دام هناك مشرف أعلى، لا ترقية تلقائية
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer
set search_path = pg_catalog, public, pg_temp as $$
declare
  bootstrap text[];
  assigned_role public.app_role := 'member';
begin
  select bootstrap_admin_emails into bootstrap from public.site_settings where id;

  if bootstrap is not null
     and lower(new.email) = any (select lower(unnest(bootstrap)))
     and not exists (select 1 from public.profiles where role = 'super_admin') then
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

-- ════════════════════════════════════════════════════════════════════════════
-- ١٢: المشرف لا يعزل «المشرف الأعلى» ولا يغيّر صلاحية نفسه
-- ════════════════════════════════════════════════════════════════════════════

create or replace function public.guard_profile_privileges()
returns trigger language plpgsql security definer
set search_path = pg_catalog, public, pg_temp as $$
begin
  if public.is_admin() then
    if old.role = 'super_admin' and not public.is_super_admin() then
      raise exception 'لا يمكن تعديل حساب «مشرف أعلى» إلا بواسطة مشرف أعلى.'
        using errcode = '42501';
    end if;

    if old.id = new.id
       and (new.role is distinct from old.role or new.is_active is distinct from old.is_active)
       and not public.is_super_admin() then
      raise exception 'لا يمكنك تغيير صلاحيتك بنفسك.' using errcode = '42501';
    end if;

    if new.role = 'super_admin'
       and old.role is distinct from 'super_admin'
       and not public.is_super_admin() then
      raise exception 'رفع الصلاحية إلى «مشرف أعلى» يحتاج مشرفًا أعلى.'
        using errcode = '42501';
    end if;

    new.email := old.email;
    return new;
  end if;

  new.role := old.role;
  new.is_active := old.is_active;
  new.email := old.email;
  return new;
end;
$$;

-- ════════════════════════════════════════════════════════════════════════════
-- ٧ + ٨: تسجيل الفعاليات — لا نقل بين الفعاليات ولا تزوير حضور
-- ════════════════════════════════════════════════════════════════════════════

drop policy if exists "event regs: organizers update" on public.event_registrations;
create policy "event regs: organizers update"
  on public.event_registrations for update to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.events e
      where e.id = event_id and e.forum_id is not null and public.is_forum_staff(e.forum_id)
    )
  )
  with check (
    public.is_admin()
    or exists (
      select 1 from public.events e
      where e.id = event_id and e.forum_id is not null and public.is_forum_staff(e.forum_id)
    )
  );

drop policy if exists "event regs: organizers read" on public.event_registrations;
create policy "event regs: organizers read"
  on public.event_registrations for select to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.events e
      where e.id = event_id and e.forum_id is not null and public.is_forum_staff(e.forum_id)
    )
  );

create or replace function public.guard_registration_self_update()
returns trigger language plpgsql security definer
set search_path = pg_catalog, public, pg_temp as $$
begin
  if public.is_admin()
     or exists (
       select 1 from public.events e
       where e.id = old.event_id and e.forum_id is not null and public.is_forum_staff(e.forum_id)
     ) then
    return new;
  end if;

  new.event_id   := old.event_id;
  new.profile_id := old.profile_id;
  new.attended   := old.attended;
  new.created_at := old.created_at;

  if new.status = 'registered' and old.status <> 'registered'
     and not exists (
       select 1 from public.events e
       where e.id = old.event_id
         and e.status = 'published'
         and e.registration_open
         and (
           not e.members_only
           or (e.forum_id is not null and public.is_forum_member(e.forum_id))
         )
     ) then
    raise exception 'التسجيل مغلق لهذه الفعالية.' using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists event_regs_guard_self on public.event_registrations;
create trigger event_regs_guard_self
  before update on public.event_registrations
  for each row execute function public.guard_registration_self_update();

-- ١٤: فعالية عامة «للأعضاء فقط» = لكل عضو معتمد في أي منتدى
drop policy if exists "event regs: register self" on public.event_registrations;
create policy "event regs: register self"
  on public.event_registrations for insert to authenticated
  with check (
    (select auth.uid()) = profile_id
    and coalesce((select is_active from public.profiles where id = (select auth.uid())), false)
    and exists (
      select 1 from public.events e
      where e.id = event_id
        and e.status = 'published'
        and e.registration_open
        and (
          not e.members_only
          or (
            case
              when e.forum_id is null then exists (
                select 1 from public.forum_memberships m
                where m.profile_id = (select auth.uid()) and m.status = 'approved'
              )
              else public.is_forum_member(e.forum_id)
            end
          )
        )
    )
  );

-- ١٩: منحة حذف بلا سياسة — تُسحب
revoke delete on public.event_registrations from authenticated;

-- ════════════════════════════════════════════════════════════════════════════
-- ١٥: عدّاد الأعضاء يحسب الطرفين عند نقل الصف
-- ════════════════════════════════════════════════════════════════════════════

create or replace function public.sync_forum_members_count()
returns trigger language plpgsql security definer
set search_path = pg_catalog, public, pg_temp as $$
declare
  targets uuid[];
  target uuid;
begin
  targets := array_remove(array[new.forum_id, old.forum_id], null);

  foreach target in array targets loop
    update public.forums f
    set members_count = (
      select count(*) from public.forum_memberships m
      where m.forum_id = target and m.status = 'approved'
    )
    where f.id = target;
  end loop;

  return coalesce(new, old);
end;
$$;

drop trigger if exists memberships_sync_count on public.forum_memberships;
create trigger memberships_sync_count
  after insert or update or delete on public.forum_memberships
  for each row execute function public.sync_forum_members_count();

-- ════════════════════════════════════════════════════════════════════════════
-- ١٦: تقييد نطاق البريد يشمل تغيير البريد، ولا يمرّ البريد الفارغ
-- ════════════════════════════════════════════════════════════════════════════

create or replace function public.enforce_allowed_email_domain()
returns trigger language plpgsql security definer
set search_path = pg_catalog, public, pg_temp as $$
declare
  allowed text[];
  incoming_domain text;
begin
  select allowed_email_domains into allowed from public.site_settings where id;

  if allowed is null or array_length(allowed, 1) is null then
    raise exception 'التسجيل مغلق: لم تُضبط نطاقات البريد المسموح بها.'
      using errcode = '42501';
  end if;

  incoming_domain := lower(split_part(coalesce(new.email, ''), '@', 2));

  if incoming_domain is null
     or incoming_domain = ''
     or not (incoming_domain = any (select lower(unnest(allowed)))) then
    raise exception 'البريد مقصور على النطاق الرسمي للوزارة (%).',
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

drop trigger if exists enforce_email_domain_on_change on auth.users;
create trigger enforce_email_domain_on_change
  before update of email on auth.users
  for each row
  when (new.email is distinct from old.email)
  execute function public.enforce_allowed_email_domain();

/** يُبقي profiles.email موافقًا لبريد الحساب بعد أي تغيير. */
create or replace function public.sync_profile_email()
returns trigger language plpgsql security definer
set search_path = pg_catalog, public, pg_temp as $$
begin
  update public.profiles set email = new.email where id = new.id;
  return new;
end;
$$;

drop trigger if exists sync_profile_email_on_change on auth.users;
create trigger sync_profile_email_on_change
  after update of email on auth.users
  for each row
  when (new.email is distinct from old.email)
  execute function public.sync_profile_email();

-- ════════════════════════════════════════════════════════════════════════════
-- ١٣: سجلّ التدقيق — يُكتب بمشغّلات SECURITY DEFINER، فلا يُزوَّر ولا يُكتَم
-- ════════════════════════════════════════════════════════════════════════════

create or replace function public.audit_profile_change()
returns trigger language plpgsql security definer
set search_path = pg_catalog, public, pg_temp as $$
begin
  if new.role is distinct from old.role or new.is_active is distinct from old.is_active then
    insert into public.audit_log (actor_id, action, entity, entity_id, meta)
    values (
      auth.uid(), 'profile.privilege_change', 'profiles', new.id::text,
      jsonb_build_object(
        'old_role', old.role, 'new_role', new.role,
        'old_active', old.is_active, 'new_active', new.is_active
      )
    );
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_audit on public.profiles;
create trigger profiles_audit
  after update on public.profiles
  for each row execute function public.audit_profile_change();

create or replace function public.audit_settings_change()
returns trigger language plpgsql security definer
set search_path = pg_catalog, public, pg_temp as $$
begin
  insert into public.audit_log (actor_id, action, entity, entity_id, meta)
  values (
    auth.uid(), 'settings.update', 'site_settings', 'singleton',
    jsonb_build_object(
      'teaser_mode', new.teaser_mode,
      'registration_open', new.registration_open,
      'launch_at', new.launch_at,
      'domains', new.allowed_email_domains
    )
  );
  return new;
end;
$$;

drop trigger if exists site_settings_audit on public.site_settings;
create trigger site_settings_audit
  after update on public.site_settings
  for each row execute function public.audit_settings_change();

create or replace function public.audit_membership_decision()
returns trigger language plpgsql security definer
set search_path = pg_catalog, public, pg_temp as $$
begin
  if new.status is distinct from old.status or new.role is distinct from old.role then
    insert into public.audit_log (actor_id, action, entity, entity_id, meta)
    values (
      auth.uid(), 'membership.change', 'forum_memberships', new.id::text,
      jsonb_build_object(
        'forum_id', new.forum_id, 'profile_id', new.profile_id,
        'old_status', old.status, 'new_status', new.status,
        'old_role', old.role, 'new_role', new.role
      )
    );
  end if;
  return new;
end;
$$;

drop trigger if exists memberships_audit on public.forum_memberships;
create trigger memberships_audit
  after update on public.forum_memberships
  for each row execute function public.audit_membership_decision();

-- ════════════════════════════════════════════════════════════════════════════
-- ١٩: قائمة المهتمّين — لا يُعاد كتابة اسم مشترك موجود
-- ════════════════════════════════════════════════════════════════════════════

create or replace function public.join_waitlist(
  subscriber_email text,
  subscriber_name text default null,
  subscriber_source text default 'teaser'
)
returns void language plpgsql security definer
set search_path = pg_catalog, public, pg_temp as $$
declare
  cleaned citext := lower(trim(subscriber_email));
begin
  if cleaned !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'صيغة البريد الإلكتروني غير صحيحة.' using errcode = '22023';
  end if;

  insert into public.waitlist_subscribers (email, full_name, source)
  values (cleaned, nullif(trim(coalesce(subscriber_name, '')), ''), 'teaser')
  on conflict (email) do nothing;
end;
$$;

revoke all on function public.join_waitlist(text, text, text) from public;
grant execute on function public.join_waitlist(text, text, text) to anon, authenticated;

-- ════════════════════════════════════════════════════════════════════════════
-- ١٧: الجداول الجديدة لا تُمنح تلقائيًا لأحد
-- ════════════════════════════════════════════════════════════════════════════

alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on functions from public;
