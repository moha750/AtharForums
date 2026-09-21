-- ════════════════════════════════════════════════════════════════════════════
-- منتديات أثر — نظام إحصاءات الزوار
--
-- المبدأ: التسجيل من الخادم لا من المتصفّح. مانعات الإعلانات تحجب نصوص
-- التتبّع المعروفة، فالأرقام المبنية عليها ناقصة بنسبة تتراوح بين ١٠٪ و٤٠٪.
-- هنا يُسجَّل الطلب في الوسيط قبل أن تصل الصفحة للمتصفّح، فلا شيء يحجبه.
--
-- الخصوصية:
--   • عنوان IP لا يُخزَّن إطلاقًا. يدخل الدالّة، يُمزج بملح سرّي، ويخرج بصمة
--     لا رجعة منها. الملح يتبدّل كل شهر فتنقطع الصلة بين الشهور.
--   • لا كوكيز تتبّع — فلا لافتة موافقة، ولا وقوع تحت اشتراطات الكوكيز.
--   • الموظّف المسجَّل دخوله تُربط زيارته باسمه (قرار إداري صريح)، والبيانات
--     المرتبطة بالأسماء تُمحى بعد ٩٠ يومًا ويبقى المجمّع.
--   • عرض سلوك فرد بعينه مقصور على «المشرف الأعلى»، وكل فتح يُكتب في التدقيق.
--
-- منع التزوير: الكتابة لا تمرّ بالجداول مباشرة بل بدوالّ SECURITY DEFINER
-- تطلب مفتاحًا سرّيًا لا يعرفه المتصفّح. المفتاح العام وحده لا يكفي لحقن أرقام.
-- ════════════════════════════════════════════════════════════════════════════

-- ── الأنواع ────────────────────────────────────────────────────────────────

do $$ begin
  create type public.analytics_device as enum ('desktop', 'mobile', 'tablet', 'bot', 'unknown');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.analytics_kind as enum ('pageview', 'engagement', 'conversion');
exception when duplicate_object then null; end $$;

-- ── الملح الشهري: يحوّل IP إلى بصمة لا رجعة منها ───────────────────────────
-- لا يُمنح لأحد. تقرؤه دوالّ SECURITY DEFINER وحدها.
--
-- ملاحظة على search_path: pgcrypto في Supabase مثبَّت في مخطّط extensions لا
-- في public، فالدوالّ التي تستعمل digest وgen_random_bytes تضمّ extensions إلى
-- مسار البحث. وبقيّة الدوالّ لا تضمّه — أضيق مسار يكفي الغرض.

create table if not exists public.analytics_salt (
  period    text primary key,                                -- 'YYYY-MM'
  salt      bytea not null,
  created_at timestamptz not null default now()
);

-- ── مفتاح الإدخال: يمنع حقن زيارات مزوّرة ─────────────────────────────────

create table if not exists public.analytics_ingest_key (
  id         boolean primary key default true check (id),
  secret     text not null,
  rotated_at timestamptz not null default now(),
  constraint analytics_ingest_key_single check (id)
);

-- ── الزيارة (الجلسة) ───────────────────────────────────────────────────────

create table if not exists public.analytics_visits (
  id            uuid primary key default gen_random_uuid(),
  visitor_id    text not null,
  profile_id    uuid references public.profiles (id) on delete set null,

  started_at    timestamptz not null default now(),
  last_seen_at  timestamptz not null default now(),
  pageviews     integer not null default 0,
  duration_ms   integer not null default 0,

  entry_path    text,
  exit_path     text,
  locale        text,

  device        public.analytics_device not null default 'unknown',
  browser       text,
  os            text,
  screen_w      integer,

  country       text,
  region        text,

  referrer_host text,
  referrer_path text,
  utm_source    text,
  utm_medium    text,
  utm_campaign  text,
  utm_content   text,
  utm_term      text,

  is_returning  boolean not null default false,
  conversions   integer not null default 0
);

create index if not exists analytics_visits_started_idx    on public.analytics_visits (started_at desc);
create index if not exists analytics_visits_visitor_idx    on public.analytics_visits (visitor_id, last_seen_at desc);
create index if not exists analytics_visits_profile_idx    on public.analytics_visits (profile_id, started_at desc) where profile_id is not null;
create index if not exists analytics_visits_last_seen_idx  on public.analytics_visits (last_seen_at desc);
create index if not exists analytics_visits_referrer_idx   on public.analytics_visits (referrer_host) where referrer_host is not null;
create index if not exists analytics_visits_campaign_idx   on public.analytics_visits (utm_campaign) where utm_campaign is not null;

-- ── الحدث (مشاهدة صفحة، تفاعل، تحوّل) ──────────────────────────────────────

create table if not exists public.analytics_events (
  id           bigint generated always as identity primary key,
  visit_id     uuid not null references public.analytics_visits (id) on delete cascade,
  occurred_at  timestamptz not null default now(),
  kind         public.analytics_kind not null default 'pageview',

  path         text not null,
  locale       text,
  page_type    text not null default 'other',
  entity_slug  text,
  entity_id    uuid,

  name         text,              -- للتحوّلات: waitlist_signup، join_request، …
  duration_ms  integer,           -- زمن البقاء، يصله من المتصفّح
  scroll_pct   smallint           -- عمق التمرير ٠..١٠٠
);

create index if not exists analytics_events_occurred_idx on public.analytics_events (occurred_at desc);
create index if not exists analytics_events_visit_idx    on public.analytics_events (visit_id);
create index if not exists analytics_events_path_idx     on public.analytics_events (path, occurred_at desc);
create index if not exists analytics_events_type_idx     on public.analytics_events (page_type, occurred_at desc);
create index if not exists analytics_events_name_idx     on public.analytics_events (name, occurred_at desc) where name is not null;
create index if not exists analytics_events_entity_idx   on public.analytics_events (entity_id, occurred_at desc) where entity_id is not null;

-- ── التجميع اليومي: يبقى بعد محو الصفوف الخام ──────────────────────────────

create table if not exists public.analytics_daily (
  day            date primary key,
  visitors       integer not null default 0,
  visits         integer not null default 0,
  pageviews      integer not null default 0,
  bounces        integer not null default 0,
  duration_ms    bigint  not null default 0,
  conversions    integer not null default 0,
  rolled_at      timestamptz not null default now()
);

create table if not exists public.analytics_daily_dim (
  day        date not null,
  dimension  text not null,           -- path | page_type | referrer_host | utm_campaign | device | browser | os | country | locale
  value      text not null,
  visits     integer not null default 0,
  pageviews  integer not null default 0,
  primary key (day, dimension, value)
);

create index if not exists analytics_daily_dim_idx on public.analytics_daily_dim (dimension, day desc);

-- ════════════════════════════════════════════════════════════════════════════
-- الصلاحيات: منع افتراضي. لا كتابة مباشرة البتّة، والقراءة للمشرفين فقط.
-- ════════════════════════════════════════════════════════════════════════════

alter table public.analytics_salt        enable row level security;
alter table public.analytics_ingest_key  enable row level security;
alter table public.analytics_visits      enable row level security;
alter table public.analytics_events      enable row level security;
alter table public.analytics_daily       enable row level security;
alter table public.analytics_daily_dim   enable row level security;

revoke all on public.analytics_salt       from anon, authenticated;
revoke all on public.analytics_ingest_key from anon, authenticated;
revoke all on public.analytics_visits     from anon, authenticated;
revoke all on public.analytics_events     from anon, authenticated;
revoke all on public.analytics_daily      from anon, authenticated;
revoke all on public.analytics_daily_dim  from anon, authenticated;

-- الملح والمفتاح: لا سياسة ولا منحة — لا يقرؤهما إلا SECURITY DEFINER.

grant select on public.analytics_visits    to authenticated;
grant select on public.analytics_events    to authenticated;
grant select on public.analytics_daily     to authenticated;
grant select on public.analytics_daily_dim to authenticated;

drop policy if exists "analytics_visits: admins read" on public.analytics_visits;
create policy "analytics_visits: admins read"
  on public.analytics_visits for select to authenticated
  using (public.is_admin());

drop policy if exists "analytics_events: admins read" on public.analytics_events;
create policy "analytics_events: admins read"
  on public.analytics_events for select to authenticated
  using (public.is_admin());

drop policy if exists "analytics_daily: admins read" on public.analytics_daily;
create policy "analytics_daily: admins read"
  on public.analytics_daily for select to authenticated
  using (public.is_admin());

drop policy if exists "analytics_daily_dim: admins read" on public.analytics_daily_dim;
create policy "analytics_daily_dim: admins read"
  on public.analytics_daily_dim for select to authenticated
  using (public.is_admin());

-- ════════════════════════════════════════════════════════════════════════════
-- الدوالّ الداخلية
-- ════════════════════════════════════════════════════════════════════════════

/** بصمة الزائر: IP + متصفّح + ملح الشهر. الملح يُولَّد مرة ولا يُقرأ خارجًا. */
create or replace function public.analytics_visitor_hash(p_ip text, p_ua text)
returns text language plpgsql security definer
set search_path = pg_catalog, public, extensions, pg_temp as $$
declare
  v_period text := to_char(now() at time zone 'UTC', 'YYYY-MM');
  v_salt   bytea;
begin
  select salt into v_salt from public.analytics_salt where period = v_period;

  if v_salt is null then
    insert into public.analytics_salt (period, salt)
    values (v_period, gen_random_bytes(32))
    on conflict (period) do nothing;

    select salt into v_salt from public.analytics_salt where period = v_period;
  end if;

  return encode(
    digest(v_salt || convert_to(coalesce(p_ip, '') || '|' || coalesce(p_ua, ''), 'UTF8'), 'sha256'),
    'hex'
  );
end;
$$;

revoke all on function public.analytics_visitor_hash(text, text) from public, anon, authenticated;

/** يتحقّق من مفتاح الإدخال. المقارنة ثابتة الزمن قدر ما يتيحه SQL. */
create or replace function public.analytics_key_ok(p_secret text)
returns boolean language sql stable security definer
set search_path = pg_catalog, public, extensions, pg_temp as $$
  select exists (
    select 1 from public.analytics_ingest_key
    where id and secret is not null and length(secret) >= 24
      and digest(secret, 'sha256') = digest(coalesce(p_secret, ''), 'sha256')
  );
$$;

revoke all on function public.analytics_key_ok(text) from public, anon, authenticated;

-- ════════════════════════════════════════════════════════════════════════════
-- التسجيل
-- ════════════════════════════════════════════════════════════════════════════

/**
 * يسجّل مشاهدة صفحة ويعيد معرّف الزيارة.
 * الزيارة واحدة ما دام الفاصل بين طلبين أقلّ من ثلاثين دقيقة — وهو العرف
 * المتّبع في أدوات القياس، وبه تُقاس «الجلسة» لا «الطلب».
 */
create or replace function public.analytics_track(
  p_secret     text,
  p_ip         text,
  p_ua         text,
  p_path       text,
  p_locale     text default null,
  p_page_type  text default 'other',
  p_entity_slug text default null,
  p_profile_id uuid default null,
  p_device     text default 'unknown',
  p_browser    text default null,
  p_os         text default null,
  p_country    text default null,
  p_region     text default null,
  p_referrer_host text default null,
  p_referrer_path text default null,
  p_utm        jsonb default '{}'::jsonb
)
returns uuid language plpgsql security definer
set search_path = pg_catalog, public, pg_temp as $$
declare
  v_visitor   text;
  v_visit     public.analytics_visits%rowtype;
  v_device    public.analytics_device;
  v_returning boolean := false;
  v_entity_id uuid;
begin
  if not public.analytics_key_ok(p_secret) then
    raise exception 'مفتاح التسجيل غير صحيح.' using errcode = '42501';
  end if;

  if p_path is null or p_path = '' or length(p_path) > 512 then
    raise exception 'مسار غير صالح.' using errcode = '22023';
  end if;

  begin
    v_device := p_device::public.analytics_device;
  exception when others then
    v_device := 'unknown';
  end;

  v_visitor := public.analytics_visitor_hash(p_ip, p_ua);

  -- الوسيط يعرف الـ slug من المسار ولا يعرف المعرّف. نستخرجه هنا بقراءة
  -- مفهرسة واحدة بدل رحلة شبكة ثانية من التطبيق.
  if p_entity_slug is not null then
    v_entity_id := case p_page_type
      when 'forum'   then (select id from public.forums  where slug = p_entity_slug)
      when 'event'   then (select id from public.events  where slug = p_entity_slug)
      when 'article' then (select id from public.posts   where slug = p_entity_slug)
      else null
    end;
  end if;

  -- زيارة قائمة؟ (نفس الزائر، وآخر نشاط خلال ٣٠ دقيقة)
  select * into v_visit
  from public.analytics_visits
  where visitor_id = v_visitor
    and last_seen_at > now() - interval '30 minutes'
  order by last_seen_at desc
  limit 1;

  if v_visit.id is null then
    -- زائر عائد؟ (زيارة سابقة خلال ٣٠ يومًا، أو موظّف عرفناه من قبل)
    select exists (
      select 1 from public.analytics_visits
      where started_at > now() - interval '30 days'
        and (visitor_id = v_visitor
             or (p_profile_id is not null and profile_id = p_profile_id))
    ) into v_returning;

    insert into public.analytics_visits (
      visitor_id, profile_id, entry_path, exit_path, locale, device, browser, os,
      country, region, referrer_host, referrer_path,
      utm_source, utm_medium, utm_campaign, utm_content, utm_term,
      is_returning, pageviews
    ) values (
      v_visitor, p_profile_id, p_path, p_path, p_locale, v_device, p_browser, p_os,
      p_country, p_region, p_referrer_host, p_referrer_path,
      nullif(p_utm ->> 'source', ''), nullif(p_utm ->> 'medium', ''),
      nullif(p_utm ->> 'campaign', ''), nullif(p_utm ->> 'content', ''),
      nullif(p_utm ->> 'term', ''),
      v_returning, 1
    )
    returning * into v_visit;
  else
    update public.analytics_visits
    set last_seen_at = now(),
        pageviews    = pageviews + 1,
        exit_path    = p_path,
        duration_ms  = greatest(duration_ms, (extract(epoch from (now() - started_at)) * 1000)::integer),
        -- الهوية قد تظهر في منتصف الزيارة (سجّل الدخول أثناءها)
        profile_id   = coalesce(v_visit.profile_id, p_profile_id),
        locale       = coalesce(p_locale, locale)
    where id = v_visit.id
    returning * into v_visit;
  end if;

  insert into public.analytics_events (visit_id, kind, path, locale, page_type, entity_slug, entity_id)
  values (v_visit.id, 'pageview', p_path, p_locale, coalesce(p_page_type, 'other'), p_entity_slug, v_entity_id);

  return v_visit.id;
end;
$$;

revoke all on function public.analytics_track(text, text, text, text, text, text, text, uuid, text, text, text, text, text, text, text, jsonb) from public;
grant execute on function public.analytics_track(text, text, text, text, text, text, text, uuid, text, text, text, text, text, text, text, jsonb) to anon, authenticated;

/** الزيارة الجارية لهذا الزائر، إن وُجدت. لا نمرّر معرّفًا للمتصفّح أصلًا. */
create or replace function public.analytics_current_visit(p_ip text, p_ua text)
returns uuid language plpgsql security definer
set search_path = pg_catalog, public, pg_temp as $$
declare
  v_id uuid;
begin
  select id into v_id
  from public.analytics_visits
  where visitor_id = public.analytics_visitor_hash(p_ip, p_ua)
    and last_seen_at > now() - interval '30 minutes'
  order by last_seen_at desc
  limit 1;

  return v_id;
end;
$$;

revoke all on function public.analytics_current_visit(text, text) from public, anon, authenticated;

/**
 * زمن البقاء وعمق التمرير — ما لا يعرفه الخادم ولا يعرفه إلا المتصفّح.
 * لا يستقبل معرّف زيارة من المتصفّح: يستنتجه من بصمة الزائر نفسها، فلا يملك
 * أحد معرّفًا يعبث به، ولا نحتاج كوكي ولا رحلة ذهاب وإياب في الوسيط.
 */
create or replace function public.analytics_engagement(
  p_secret      text,
  p_ip          text,
  p_ua          text,
  p_path        text,
  p_duration_ms integer,
  p_scroll_pct  integer default null,
  p_screen_w    integer default null
)
returns void language plpgsql security definer
set search_path = pg_catalog, public, pg_temp as $$
declare
  v_visit    uuid;
  v_duration integer := least(greatest(coalesce(p_duration_ms, 0), 0), 3600000);
  v_scroll   smallint := least(greatest(coalesce(p_scroll_pct, 0), 0), 100)::smallint;
begin
  if not public.analytics_key_ok(p_secret) then
    raise exception 'مفتاح التسجيل غير صحيح.' using errcode = '42501';
  end if;

  v_visit := public.analytics_current_visit(p_ip, p_ua);
  if v_visit is null then
    return;
  end if;

  update public.analytics_events
  set duration_ms = greatest(coalesce(duration_ms, 0), v_duration),
      scroll_pct  = greatest(coalesce(scroll_pct, 0), v_scroll)
  where id = (
    select id from public.analytics_events
    where visit_id = v_visit and path = p_path and kind = 'pageview'
    order by occurred_at desc limit 1
  );

  update public.analytics_visits
  set duration_ms  = greatest(
                       duration_ms,
                       (extract(epoch from (now() - started_at)) * 1000)::integer,
                       v_duration
                     ),
      last_seen_at = greatest(last_seen_at, now()),
      screen_w     = coalesce(screen_w, p_screen_w)
  where id = v_visit;
end;
$$;

revoke all on function public.analytics_engagement(text, text, text, text, integer, integer, integer) from public;
grant execute on function public.analytics_engagement(text, text, text, text, integer, integer, integer) to anon, authenticated;

/** تحوّل: تسجيل بريد، طلب انضمام، تسجيل في فعالية، طلب رابط دخول. */
create or replace function public.analytics_conversion(
  p_secret    text,
  p_ip        text,
  p_ua        text,
  p_name      text,
  p_path      text default null,
  p_entity_id uuid default null,
  p_locale    text default null
)
returns void language plpgsql security definer
set search_path = pg_catalog, public, pg_temp as $$
declare
  v_visit uuid;
begin
  if not public.analytics_key_ok(p_secret) then
    raise exception 'مفتاح التسجيل غير صحيح.' using errcode = '42501';
  end if;

  if p_name is null or length(p_name) > 64 then
    raise exception 'اسم التحوّل غير صالح.' using errcode = '22023';
  end if;

  v_visit := public.analytics_current_visit(p_ip, p_ua);
  if v_visit is null then
    return;   -- تحوّل بلا زيارة معروفة: نتجاهله بدل أن نفسد الأرقام
  end if;

  insert into public.analytics_events (visit_id, kind, path, locale, page_type, name, entity_id)
  values (v_visit, 'conversion', coalesce(p_path, '/'), p_locale, 'conversion', p_name, p_entity_id);

  update public.analytics_visits
  set conversions  = conversions + 1,
      last_seen_at = now()
  where id = v_visit;
end;
$$;

revoke all on function public.analytics_conversion(text, text, text, text, text, uuid, text) from public;
grant execute on function public.analytics_conversion(text, text, text, text, text, uuid, text) to anon, authenticated;
