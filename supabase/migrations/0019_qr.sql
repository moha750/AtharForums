-- ════════════════════════════════════════════════════════════════════════════
-- مساحة أثر — نظام الباركود الديناميكي
--
-- الفكرة: الباركود لا يحمل رابط الوجهة أبدًا، بل رابطنا القصير /q/{code}.
-- الوجهة صفّ هنا يُعدَّل بعد الطباعة، وكل مسح يمرّ بخادمنا فيُعَدّ ثم يُحوَّل.
--
-- بلا مفتاح service_role، على قاعدة المشروع. ما كان يحتاجه:
--   • باب المسح العام ← qr_resolve() بصلاحيات منشئها، يطلب سرّ خادم
--     (QR_SERVER_KEY) لا يعرفه المتصفّح — نمط analytics_track نفسه.
--   • المخزن ← تذاكر رفع يصكّها الخادم: سياسة الإدراج لا تقبل إلا مسارًا
--     صكّه الخادم لصاحبه قبل قليل، والمحو لا يقبل ملفًّا يشير إليه صفّ
--     (الفحص بدالّة SECURITY DEFINER ترى كل الصفوف).
--   • استنزاف التنبيهات ← دوالّ تطلب السرّ نفسه.
--
-- الصلاحيتان: use_qr_generator (إنشاء وإدارة) وoversee_qr (إشراف). كل
-- السياسات تشترط الملكية **و**الصلاحية معًا، فنزع الصلاحية يقطع الوصول حتى
-- لصفوف صاحبها.
-- ════════════════════════════════════════════════════════════════════════════

-- ════════════════════════════════════════════════════════════════════════════
-- ١. الصلاحيات
-- ════════════════════════════════════════════════════════════════════════════

do $$ begin
  create type public.app_permission as enum ('use_qr_generator', 'oversee_qr', 'qr_org_account');
exception when duplicate_object then null; end $$;

comment on type public.app_permission is
  'صلاحيات دقيقة فوق الدور: المولّد، والإشراف، وحساب الجهة (يرث باركودات الحسابات المحذوفة)';

create table if not exists public.profile_permissions (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  permission public.app_permission not null,
  granted_by uuid references public.profiles (id) on delete set null,
  granted_at timestamptz not null default now(),
  primary key (profile_id, permission)
);

-- حساب الجهة واحد لا أكثر: يُعرف بدوره لا ببريده
create unique index if not exists profile_permissions_one_org
  on public.profile_permissions (permission) where permission = 'qr_org_account';

/** هل يحمل المستخدم الحالي هذه الصلاحية، وحسابه فعّال؟ */
create or replace function public.has_permission(p public.app_permission)
returns boolean language sql stable security definer
set search_path = pg_catalog, public, pg_temp as $$
  select exists (
    select 1
    from public.profile_permissions pp
    join public.profiles pr on pr.id = pp.profile_id
    where pp.profile_id = auth.uid() and pp.permission = p and pr.is_active
  );
$$;

create or replace function public.qr_can_use()
returns boolean language sql stable security definer
set search_path = pg_catalog, public, pg_temp as $$
  select public.has_permission('use_qr_generator');
$$;

create or replace function public.qr_can_oversee()
returns boolean language sql stable security definer
set search_path = pg_catalog, public, pg_temp as $$
  select public.has_permission('oversee_qr');
$$;

revoke all on function public.has_permission(public.app_permission) from public, anon;
revoke all on function public.qr_can_use() from public, anon;
revoke all on function public.qr_can_oversee() from public, anon;
grant execute on function public.has_permission(public.app_permission) to authenticated;
grant execute on function public.qr_can_use() to authenticated;
grant execute on function public.qr_can_oversee() to authenticated;

-- المنح من المشرفين، والمشرف (غير الأعلى) لا يمنح نفسه ولا ينزع عنها
create or replace function public.guard_profile_permissions()
returns trigger language plpgsql security definer
set search_path = pg_catalog, public, pg_temp as $$
declare
  v_target uuid := coalesce(new.profile_id, old.profile_id);
begin
  if auth.uid() is not null and v_target = auth.uid() and not public.is_super_admin() then
    raise exception 'لا يمكنك تغيير صلاحياتك بنفسك.' using errcode = '42501';
  end if;
  if tg_op = 'INSERT' then
    new.granted_by := auth.uid();
    new.granted_at := now();
    return new;
  end if;
  return old;
end;
$$;

drop trigger if exists profile_permissions_guard on public.profile_permissions;
create trigger profile_permissions_guard
  before insert or delete on public.profile_permissions
  for each row execute function public.guard_profile_permissions();

create or replace function public.audit_profile_permissions()
returns trigger language plpgsql security definer
set search_path = pg_catalog, public, pg_temp as $$
begin
  insert into public.audit_log (actor_id, action, entity, entity_id, meta)
  values (
    auth.uid(),
    case tg_op when 'INSERT' then 'permission.grant' else 'permission.revoke' end,
    'profile_permissions',
    coalesce(new.profile_id, old.profile_id)::text,
    jsonb_build_object('permission', coalesce(new.permission, old.permission))
  );
  return null;
end;
$$;

drop trigger if exists profile_permissions_audit on public.profile_permissions;
create trigger profile_permissions_audit
  after insert or delete on public.profile_permissions
  for each row execute function public.audit_profile_permissions();

alter table public.profile_permissions enable row level security;
revoke all on public.profile_permissions from anon, authenticated;
grant select, delete on public.profile_permissions to authenticated;
grant insert (profile_id, permission) on public.profile_permissions to authenticated;

drop policy if exists "permissions: read own or admins" on public.profile_permissions;
create policy "permissions: read own or admins"
  on public.profile_permissions for select to authenticated
  using (profile_id = (select auth.uid()) or (select public.is_admin()));

drop policy if exists "permissions: admins grant" on public.profile_permissions;
create policy "permissions: admins grant"
  on public.profile_permissions for insert to authenticated
  with check ((select public.is_admin()));

drop policy if exists "permissions: admins revoke" on public.profile_permissions;
create policy "permissions: admins revoke"
  on public.profile_permissions for delete to authenticated
  using ((select public.is_admin()));

-- ════════════════════════════════════════════════════════════════════════════
-- ٢. مفتاح التشغيل للرموز المختارة، وسرّ الخادم
-- ════════════════════════════════════════════════════════════════════════════

alter table public.site_settings
  add column if not exists qr_custom_codes boolean not null default false;

comment on column public.site_settings.qr_custom_codes is
  'يسمح لحاملي صلاحية المولّد باختيار رمز الباركود بأنفسهم. مطفأ افتراضيًا.';

/** للواجهة: هل الرموز المختارة مفعّلة؟ */
create or replace function public.qr_custom_codes_enabled()
returns boolean language sql stable security definer
set search_path = pg_catalog, public, pg_temp as $$
  select coalesce((select qr_custom_codes from public.site_settings where id), false);
$$;

revoke all on function public.qr_custom_codes_enabled() from public, anon;
grant execute on function public.qr_custom_codes_enabled() to authenticated;

-- سرّ الخادم: يُدرج يدويًّا مرّة واحدة، ويطابق QR_SERVER_KEY في بيئة الخادم.
-- لا سياسة ولا منحة: لا يقرؤه إلا SECURITY DEFINER.
create table if not exists public.qr_server_key (
  id         boolean primary key default true check (id),
  secret     text not null check (length(secret) >= 32),
  rotated_at timestamptz not null default now()
);

alter table public.qr_server_key enable row level security;
revoke all on public.qr_server_key from anon, authenticated;

create or replace function public.qr_key_ok(p_secret text)
returns boolean language sql stable security definer
set search_path = pg_catalog, public, extensions, pg_temp as $$
  select exists (
    select 1 from public.qr_server_key
    where id and digest(secret, 'sha256') = digest(coalesce(p_secret, ''), 'sha256')
  );
$$;

revoke all on function public.qr_key_ok(text) from public, anon, authenticated;

/**
 * شبكة أمان للوجهة في القاعدة — نسخة مما يصدّقه التطبيق (src/lib/qr/target.ts)
 * حتى لا يتجاوزه من يكتب عبر الواجهة البرمجية بجلسته مباشرةً: لا محلّي، ولا
 * شبكة خاصّة، ولا عنوان رقمي، ولا بيانات دخول، وامتداد حقيقي، ولا دورة إلى
 * /q/ على مضيفنا.
 */
create or replace function public.qr_target_ok(p_url text, p_self_host text default null)
returns boolean language plpgsql immutable
set search_path = pg_catalog, pg_temp as $$
declare
  v_host text;
  v_path text;
begin
  if p_url is null or char_length(p_url) > 2000 or p_url !~ '^https?://\S+$' then
    return false;
  end if;
  if p_url ~ '^https?://[^/?#]*@' then
    return false;
  end if;
  v_host := rtrim(lower(substring(p_url from '^https?://(\[[^]]*\]|[^/:?#]*)')), '.');
  if v_host is null or v_host = '' or v_host like '[%' then
    return false;
  end if;
  if v_host = 'localhost' or v_host like '%.localhost' or v_host = 'local' or v_host like '%.local' then
    return false;
  end if;
  if v_host ~ '^[0-9]+(\.[0-9]+){3}$' then
    return false;
  end if;
  if v_host !~ '\.([a-z]{2,}|xn--[a-z0-9-]+)$' then
    return false;
  end if;
  if p_self_host is not null then
    v_path := coalesce(substring(p_url from '^https?://[^/?#]+(/[^?#]*)'), '');
    if regexp_replace(v_host, '^www\.', '') = regexp_replace(lower(p_self_host), '^www\.', '')
       and v_path ~* '^/q(/|$)' then
      return false;
    end if;
  end if;
  return true;
end;
$$;

/** مضيف الرابط القصير المحفوظ في الوصفة — مضيفنا كما طُبع. */
create or replace function public.qr_host_of(p_url text)
returns text language sql immutable
set search_path = pg_catalog, pg_temp as $$
  select lower(substring(p_url from '^https?://([^/:?#]+)'));
$$;

-- ════════════════════════════════════════════════════════════════════════════
-- ٣. الجداول
-- ════════════════════════════════════════════════════════════════════════════

create table if not exists public.qr_campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  note text,
  owner_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint qr_campaigns_name_len check (char_length(btrim(name)) between 1 and 120 and char_length(name) <= 120),
  constraint qr_campaigns_note_len check (note is null or char_length(note) <= 200)
);

create index if not exists qr_campaigns_owner_idx on public.qr_campaigns (owner_id, created_at desc);

create table if not exists public.qr_links (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  title text not null,
  kind text not null default 'link',
  target_url text not null,
  file_path text,
  spec jsonb not null,
  owner_id uuid not null references public.profiles (id) on delete cascade,
  campaign_id uuid references public.qr_campaigns (id) on delete set null,
  active boolean not null default true,
  scan_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint qr_links_code_key unique (code),
  constraint qr_links_file_path_key unique (file_path),

  -- المولَّد ٧ محارف من الأبجدية الآمنة، والمختار ٣–٣٢ بشرطة في الوسط فقط
  constraint qr_links_code_shape check (
    char_length(code) between 3 and 32
    and code ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
    and code not in ('unavailable', 'new', 'admin', 'api', 'q')
  ),
  constraint qr_links_title_len check (char_length(btrim(title)) between 1 and 120 and char_length(title) <= 120),
  constraint qr_links_kind check (kind in ('link', 'file')),
  -- شبكة أمان أخيرة؛ التصديق الكامل في التطبيق (src/lib/qr/target.ts)
  constraint qr_links_target_shape check (char_length(target_url) <= 2000 and target_url ~ '^https?://\S+$'),
  constraint qr_links_target_safe check (
    kind <> 'link' or public.qr_target_ok(target_url, public.qr_host_of(spec ->> 'text'))
  ),
  constraint qr_links_link_has_no_file check (kind <> 'link' or file_path is null),
  constraint qr_links_file_shape check (
    kind <> 'file' or (
      file_path is not null
      and file_path ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(webp|jpg|png|pdf)$'
      -- صفحة العرض على مضيفنا نفسه كما في الرابط القصير المطبوع، لا غيره
      and target_url = (spec ->> 'text') || '/view'
    )
  ),
  -- نصّ الباركود هو الرابط القصير لهذا الرمز بالذات، لا ما يرسله المتصفّح
  constraint qr_links_spec_text check (
    jsonb_typeof(spec) = 'object'
    and coalesce(spec ->> 'text', '') ~ ('^https?://[^/[:space:]]+/q/' || code || '$')
  ),
  constraint qr_links_spec_size check (octet_length(spec::text) <= 1677721),
  constraint qr_links_scan_count check (scan_count >= 0)
);

create index if not exists qr_links_owner_idx on public.qr_links (owner_id, created_at desc);
create index if not exists qr_links_campaign_idx on public.qr_links (campaign_id) where campaign_id is not null;

create table if not exists public.qr_scans (
  id bigint generated always as identity primary key,
  link_id uuid not null references public.qr_links (id) on delete cascade,
  scanned_at timestamptz not null default now(),
  visitor text,
  referrer text,
  device text not null default 'unknown',
  is_bot boolean not null default false,
  constraint qr_scans_visitor_shape check (visitor is null or visitor ~ '^[0-9a-f]{64}$'),
  constraint qr_scans_referrer_len check (referrer is null or char_length(referrer) <= 500),
  constraint qr_scans_device check (device in ('mobile', 'tablet', 'desktop', 'unknown'))
);

create index if not exists qr_scans_link_time_idx on public.qr_scans (link_id, scanned_at desc);
create index if not exists qr_scans_link_visitor_idx on public.qr_scans (link_id, visitor, scanned_at desc);

create table if not exists public.qr_schedules (
  id uuid primary key default gen_random_uuid(),
  link_id uuid not null references public.qr_links (id) on delete cascade,
  target_url text not null,
  starts_at timestamptz,
  ends_at timestamptz,
  note text,
  created_at timestamptz not null default now(),
  constraint qr_schedules_target_shape check (char_length(target_url) <= 2000 and target_url ~ '^https?://\S+$'),
  constraint qr_schedules_window check (starts_at is null or ends_at is null or ends_at > starts_at),
  constraint qr_schedules_note_len check (note is null or (char_length(btrim(note)) between 1 and 120 and char_length(note) <= 120))
);

create index if not exists qr_schedules_link_idx on public.qr_schedules (link_id, starts_at desc nulls last);

-- سجل التدقيق: link_id بلا مفتاح أجنبي عمدًا، حتى يبقى السجل بعد الحذف.
-- وactor_id كذلك: من فعل يبقى معروفًا حتى لو حُذف حسابه.
create table if not exists public.qr_link_events (
  id bigint generated always as identity primary key,
  link_id uuid not null,
  actor_id uuid,
  kind text not null,
  old_value text,
  new_value text,
  at timestamptz not null default now(),
  constraint qr_link_events_kind check (
    kind in ('target', 'file', 'title', 'active', 'spec', 'delete', 'owner', 'schedule', 'campaign')
  )
);

create index if not exists qr_link_events_link_idx on public.qr_link_events (link_id, at desc);
create index if not exists qr_link_events_at_idx on public.qr_link_events (at desc);

create table if not exists public.qr_link_shares (
  link_id uuid not null references public.qr_links (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  access text not null,
  granted_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (link_id, user_id),
  constraint qr_link_shares_access check (access in ('read', 'edit'))
);

create index if not exists qr_link_shares_user_idx on public.qr_link_shares (user_id);

create table if not exists public.qr_campaign_shares (
  campaign_id uuid not null references public.qr_campaigns (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  access text not null,
  granted_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (campaign_id, user_id),
  constraint qr_campaign_shares_access check (access in ('read', 'edit'))
);

create index if not exists qr_campaign_shares_user_idx on public.qr_campaign_shares (user_id);

create table if not exists public.qr_alert_outbox (
  id bigint generated always as identity primary key,
  event_id bigint not null unique references public.qr_link_events (id) on delete cascade,
  link_id uuid not null,
  status text not null default 'pending',
  attempts integer not null default 0,
  error text,
  claimed_at timestamptz,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  constraint qr_alert_outbox_status check (status in ('pending', 'sent', 'failed', 'off'))
);

create index if not exists qr_alert_outbox_pending_idx
  on public.qr_alert_outbox (id) where status = 'pending';

-- تذكرة رفع: المسار الوحيد الذي يقبله المخزن من هذا المستخدم، لساعتين
create table if not exists public.qr_upload_tickets (
  path text primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  mime text not null,
  bytes integer not null,
  expires_at timestamptz not null default now() + interval '2 hours',
  created_at timestamptz not null default now()
);

create index if not exists qr_upload_tickets_user_idx on public.qr_upload_tickets (user_id, created_at desc);

-- ملفات خرجت من صفوفها (استبدال، تحويل إلى رابط، حذف) — يحقّ محوها من المخزن
create table if not exists public.qr_file_trash (
  path text primary key,
  link_id uuid,
  at timestamptz not null default now()
);

-- ════════════════════════════════════════════════════════════════════════════
-- ٤. دوالّ الوصول — بصلاحيات منشئها، فلا تدور السياسات على نفسها
-- ════════════════════════════════════════════════════════════════════════════

/**
 * إذن المشاركة للمستخدم الحالي على باركود: 'edit' أو 'read' أو null.
 * من مشاركة الباركود نفسه أو مشاركة حملته الحالية — وأوسع الإذنين يفوز.
 * مشاركة الحملة ديناميكية: تسري على ما فيها الآن، وتسقط عمّا يخرج منها.
 */
create or replace function public.share_access(p_link uuid)
returns text language sql stable security definer
set search_path = pg_catalog, public, pg_temp as $$
  select case
    when not public.has_permission('use_qr_generator') then null
    else (
      select case
        when bool_or(x.access = 'edit') then 'edit'
        when count(*) > 0 then 'read'
      end
      from (
        select s.access
        from public.qr_link_shares s
        where s.link_id = p_link and s.user_id = auth.uid()
        union all
        select cs.access
        from public.qr_links l
        join public.qr_campaign_shares cs on cs.campaign_id = l.campaign_id
        where l.id = p_link and cs.user_id = auth.uid()
      ) x
    )
  end;
$$;

/** هل المستخدم الحالي مالك الباركود ويحمل صلاحية المولّد؟ */
create or replace function public.qr_is_owner(p_link uuid)
returns boolean language sql stable security definer
set search_path = pg_catalog, public, pg_temp as $$
  select public.has_permission('use_qr_generator')
     and exists (select 1 from public.qr_links where id = p_link and owner_id = auth.uid());
$$;

/** صلة المستخدم بالباركود: owner أو edit أو read أو oversee أو null. */
create or replace function public.qr_link_access(p_link uuid)
returns text language sql stable security definer
set search_path = pg_catalog, public, pg_temp as $$
  select case
    when public.qr_is_owner(p_link) then 'owner'
    else coalesce(
      public.share_access(p_link),
      case when public.has_permission('oversee_qr')
            and exists (select 1 from public.qr_links where id = p_link) then 'oversee' end
    )
  end;
$$;

create or replace function public.qr_can_edit_link(p_link uuid)
returns boolean language sql stable security definer
set search_path = pg_catalog, public, pg_temp as $$
  select public.qr_is_owner(p_link) or coalesce(public.share_access(p_link) = 'edit', false);
$$;

create or replace function public.qr_can_read_link(p_link uuid)
returns boolean language sql stable security definer
set search_path = pg_catalog, public, pg_temp as $$
  select public.qr_link_access(p_link) is not null;
$$;

/** صلة المستخدم بالحملة: owner أو edit أو read أو null. */
create or replace function public.campaign_access(p_campaign uuid)
returns text language sql stable security definer
set search_path = pg_catalog, public, pg_temp as $$
  select case
    when not public.has_permission('use_qr_generator') then null
    when exists (select 1 from public.qr_campaigns where id = p_campaign and owner_id = auth.uid()) then 'owner'
    else (
      select case when bool_or(access = 'edit') then 'edit' when count(*) > 0 then 'read' end
      from public.qr_campaign_shares
      where campaign_id = p_campaign and user_id = auth.uid()
    )
  end;
$$;

create or replace function public.qr_is_campaign_owner(p_campaign uuid)
returns boolean language sql stable security definer
set search_path = pg_catalog, public, pg_temp as $$
  select coalesce(public.campaign_access(p_campaign) = 'owner', false);
$$;

/** هل يشير صفّ إلى هذا الملف؟ يرى كل الصفوف، لا ما تسمح به سياسات السائل. */
create or replace function public.qr_file_referenced(p_path text)
returns boolean language sql stable security definer
set search_path = pg_catalog, public, pg_temp as $$
  select exists (select 1 from public.qr_links where file_path = p_path);
$$;

/**
 * هل يحقّ للمستخدم الحالي محو هذا الملف من المخزن؟
 * لا يُمحى ملف ما زال صفّ يشير إليه، أبدًا. ثم: ملفّه هو (رفعٌ فشل بعده
 * الحفظ)، أو ملفّ خرج من صفّه (استبدال أو تحويل أو حذف).
 */
create or replace function public.qr_file_deletable(p_path text)
returns boolean language sql stable security definer
set search_path = pg_catalog, public, pg_temp as $$
  select not public.qr_file_referenced(p_path)
     and (
       (public.has_permission('use_qr_generator') and split_part(p_path, '/', 1) = auth.uid()::text)
       or (
         (public.has_permission('use_qr_generator') or public.has_permission('oversee_qr'))
         and exists (select 1 from public.qr_file_trash where path = p_path)
       )
     );
$$;

/** هل لدى المستخدم الحالي تذكرة رفع سارية لهذا المسار؟ */
create or replace function public.qr_upload_allowed(p_path text)
returns boolean language sql stable security definer
set search_path = pg_catalog, public, pg_temp as $$
  select public.has_permission('use_qr_generator')
     and exists (
       select 1 from public.qr_upload_tickets
       where path = p_path and user_id = auth.uid() and expires_at > now()
     );
$$;

do $$
declare f text;
begin
  foreach f in array array[
    'public.share_access(uuid)', 'public.qr_is_owner(uuid)', 'public.qr_link_access(uuid)',
    'public.qr_can_edit_link(uuid)', 'public.qr_can_read_link(uuid)', 'public.campaign_access(uuid)',
    'public.qr_is_campaign_owner(uuid)', 'public.qr_file_referenced(text)',
    'public.qr_file_deletable(text)', 'public.qr_upload_allowed(text)'
  ] loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;

-- ════════════════════════════════════════════════════════════════════════════
-- ٥. المحفّزات — الحرّاس قبل السياسات، والسجل لا يُتجاوز من المتصفّح
-- ════════════════════════════════════════════════════════════════════════════

/** سياق داخلي: دوالّ الإشراف ونقل الملكية عند حذف الحساب. */
create or replace function public.qr_internal()
returns boolean language sql stable
set search_path = pg_catalog, pg_temp as $$
  select coalesce(current_setting('qr.internal', true), '') = 'on';
$$;

revoke all on function public.qr_internal() from public, anon, authenticated;

create or replace function public.qr_links_touch()
returns trigger language plpgsql
set search_path = pg_catalog, public, pg_temp as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- عمود العدّاد خارج القائمة: كل مسح يزيده، ولا يُعدّ ذلك «تعديلًا»
drop trigger if exists qr_links_touch on public.qr_links;
create trigger qr_links_touch
  before update of title, target_url, kind, file_path, spec, active, campaign_id, owner_id, updated_at
  on public.qr_links
  for each row execute function public.qr_links_touch();

create or replace function public.qr_links_guard()
returns trigger language plpgsql security definer
set search_path = pg_catalog, public, pg_temp as $$
declare
  v_uid uuid := auth.uid();
  v_internal boolean := public.qr_internal();
  v_meta jsonb;
  v_ext text;
  v_mime text;
  v_limit bigint;
begin
  if tg_op = 'INSERT' then
    new.scan_count := 0;
    -- معرّف باركود محذوف لا يُعاد: سجلّه باقٍ بلا مفتاح أجنبي، ومن يرث المعرّف يرث قراءته
    if exists (select 1 from public.qr_link_events where link_id = new.id) then
      raise exception 'معرّف مستعمل من قبل.' using errcode = '23505';
    end if;
    -- الرمز المختار خلف مفتاح تشغيل. ما يطابق شكل المولَّد يمرّ دائمًا.
    if new.code !~ '^[23456789abcdefghjkmnpqrstuvwxyz]{7}$'
       and not public.qr_custom_codes_enabled() then
      raise exception 'الرموز المختارة غير مفعّلة.' using errcode = '42501';
    end if;
  end if;

  -- نصّ الباركود يُكتب مرّة عند الإنشاء ثم لا يتغيّر: هو ما طُبع على الملصق.
  -- بدون هذا يستطيع الشريك المحرِّر أن يضع مضيفًا آخر في ملفّ المالك المنزَّل.
  if tg_op = 'UPDATE' and jsonb_typeof(new.spec) = 'object' and old.spec ? 'text' then
    new.spec := jsonb_set(new.spec, '{text}', old.spec -> 'text');
  end if;

  -- وجهة الملف تكتبها القاعدة: صفحة العرض تحت الرابط القصير نفسه
  if new.kind = 'file' and jsonb_typeof(new.spec) = 'object' then
    new.target_url := (new.spec ->> 'text') || '/view';
  end if;

  -- الملف: في مجلّد من يكتب المسار، وموجود فعلًا في المخزن، ونوعه وحجمه كما صُكّت تذكرته
  if new.file_path is not null
     and (tg_op = 'INSERT' or new.file_path is distinct from old.file_path) then
    if v_uid is not null and not v_internal
       and split_part(new.file_path, '/', 1) <> v_uid::text then
      raise exception 'مسار الملف لا يخصّك.' using errcode = '42501';
    end if;
    select o.metadata into v_meta
    from storage.objects o
    where o.bucket_id = 'qr-files' and o.name = new.file_path;
    if not found then
      raise exception 'الملف غير موجود في المخزن.' using errcode = '23503';
    end if;
    v_ext := substring(new.file_path from '\.([a-z]+)$');
    v_mime := (array['image/webp', 'image/jpeg', 'image/png', 'application/pdf'])
              [array_position(array['webp', 'jpg', 'png', 'pdf'], v_ext)];
    v_limit := (array[4194304, 4194304, 4194304, 10485760])
               [array_position(array['webp', 'jpg', 'png', 'pdf'], v_ext)];
    if v_meta ? 'mimetype' and v_meta ->> 'mimetype' is distinct from v_mime then
      raise exception 'نوع الملف لا يطابق امتداده.' using errcode = '22023';
    end if;
    if coalesce(nullif(v_meta ->> 'size', '')::bigint, 0) > v_limit then
      raise exception 'حجم الملف يتجاوز الحدّ.' using errcode = '22023';
    end if;
    delete from public.qr_upload_tickets where path = new.file_path;
  end if;

  -- الحملة يجب أن تكون لمالك الباركود
  if new.campaign_id is not null
     and (tg_op = 'INSERT'
          or new.campaign_id is distinct from old.campaign_id
          or new.owner_id is distinct from old.owner_id) then
    if not exists (
      select 1 from public.qr_campaigns c
      where c.id = new.campaign_id and c.owner_id = new.owner_id
    ) then
      raise exception 'الحملة ليست لمالك الباركود.' using errcode = '42501';
    end if;
  end if;

  -- الضمّ والإخراج والنقل بين الحملات للمالك وحده — لا للشريك المحرِّر
  if tg_op = 'UPDATE'
     and new.campaign_id is distinct from old.campaign_id
     and v_uid is not null and not v_internal
     and v_uid <> old.owner_id then
    raise exception 'نقل الباركود بين الحملات لمالكه وحده.' using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists qr_links_guard on public.qr_links;
create trigger qr_links_guard
  before insert or update of file_path, campaign_id, owner_id, spec, kind, target_url on public.qr_links
  for each row execute function public.qr_links_guard();

create or replace function public.qr_campaign_name(p_id uuid)
returns text language sql stable security definer
set search_path = pg_catalog, public, pg_temp as $$
  select name from public.qr_campaigns where id = p_id;
$$;

revoke all on function public.qr_campaign_name(uuid) from public, anon, authenticated;

/** يسجّل كل تغيير ذي معنى. التصميم يُسجَّل وقوعًا بلا محتوى، والحملة باسمها. */
create or replace function public.qr_links_audit()
returns trigger language plpgsql security definer
set search_path = pg_catalog, public, pg_temp as $$
declare
  v_actor uuid := auth.uid();
begin
  if tg_op = 'DELETE' then
    insert into public.qr_link_events (link_id, actor_id, kind, old_value, new_value)
    values (old.id, v_actor, 'delete', old.code, old.title);
    if old.file_path is not null then
      insert into public.qr_file_trash (path, link_id) values (old.file_path, old.id)
      on conflict (path) do nothing;
    end if;
    return old;
  end if;

  if new.target_url is distinct from old.target_url then
    insert into public.qr_link_events (link_id, actor_id, kind, old_value, new_value)
    values (new.id, v_actor, 'target', old.target_url, new.target_url);
  end if;
  if new.file_path is distinct from old.file_path then
    insert into public.qr_link_events (link_id, actor_id, kind, old_value, new_value)
    values (new.id, v_actor, 'file', old.file_path, new.file_path);
    if old.file_path is not null then
      insert into public.qr_file_trash (path, link_id) values (old.file_path, old.id)
      on conflict (path) do nothing;
    end if;
  end if;
  if new.title is distinct from old.title then
    insert into public.qr_link_events (link_id, actor_id, kind, old_value, new_value)
    values (new.id, v_actor, 'title', old.title, new.title);
  end if;
  if new.active is distinct from old.active then
    insert into public.qr_link_events (link_id, actor_id, kind, old_value, new_value)
    values (new.id, v_actor, 'active', old.active::text, new.active::text);
  end if;
  if new.spec is distinct from old.spec then
    insert into public.qr_link_events (link_id, actor_id, kind)
    values (new.id, v_actor, 'spec');
  end if;
  if new.campaign_id is distinct from old.campaign_id then
    insert into public.qr_link_events (link_id, actor_id, kind, old_value, new_value)
    values (new.id, v_actor, 'campaign',
            public.qr_campaign_name(old.campaign_id), public.qr_campaign_name(new.campaign_id));
  end if;
  if new.owner_id is distinct from old.owner_id then
    insert into public.qr_link_events (link_id, actor_id, kind, old_value, new_value)
    values (new.id, v_actor, 'owner', old.owner_id::text, new.owner_id::text);
  end if;
  return new;
end;
$$;

drop trigger if exists qr_links_audit on public.qr_links;
create trigger qr_links_audit
  after update of target_url, file_path, title, active, spec, campaign_id, owner_id or delete
  on public.qr_links
  for each row execute function public.qr_links_audit();

/** الجدولة: الإضافة والتعديل والحذف تُقيَّد. حذف الباركود نفسه لا يكرّرها. */
create or replace function public.qr_schedules_audit()
returns trigger language plpgsql security definer
set search_path = pg_catalog, public, pg_temp as $$
declare
  v_old text;
  v_new text;
  v_link uuid := coalesce(new.link_id, old.link_id);
begin
  if tg_op = 'DELETE' and not exists (select 1 from public.qr_links where id = v_link) then
    return old;
  end if;
  if tg_op in ('UPDATE', 'DELETE') then
    v_old := concat_ws(' | ', old.target_url, coalesce(old.starts_at::text, '-'),
                       coalesce(old.ends_at::text, '-'), old.note);
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    v_new := concat_ws(' | ', new.target_url, coalesce(new.starts_at::text, '-'),
                       coalesce(new.ends_at::text, '-'), new.note);
  end if;
  insert into public.qr_link_events (link_id, actor_id, kind, old_value, new_value)
  values (v_link, auth.uid(), 'schedule', v_old, v_new);
  return coalesce(new, old);
end;
$$;

/** وجهة النافذة: شبكة الأمان نفسها، ولا دورة إلى مضيف الرابط القصير. */
create or replace function public.qr_schedules_guard()
returns trigger language plpgsql security definer
set search_path = pg_catalog, public, pg_temp as $$
begin
  if not public.qr_target_ok(
    new.target_url,
    (select public.qr_host_of(l.spec ->> 'text') from public.qr_links l where l.id = new.link_id)
  ) then
    raise exception 'وجهة غير مقبولة.' using errcode = '22023';
  end if;
  return new;
end;
$$;

drop trigger if exists qr_schedules_guard on public.qr_schedules;
create trigger qr_schedules_guard
  before insert or update of target_url on public.qr_schedules
  for each row execute function public.qr_schedules_guard();

drop trigger if exists qr_schedules_audit on public.qr_schedules;
create trigger qr_schedules_audit
  after insert or update or delete on public.qr_schedules
  for each row execute function public.qr_schedules_audit();

/**
 * تبديل الوجهة يكتب صفًّا في صندوق الصادر، والبريد خارج المعاملة. ونافذة
 * جدولة تُضاف أو تُعدَّل تبديلٌ للوجهة أيضًا — وإلا لأمكن تحويل المسح بنافذة
 * مفتوحة الطرفين دون أن يُنبَّه أحد.
 */
create or replace function public.qr_events_outbox()
returns trigger language plpgsql security definer
set search_path = pg_catalog, public, pg_temp as $$
begin
  insert into public.qr_alert_outbox (event_id, link_id) values (new.id, new.link_id);
  return null;
end;
$$;

drop trigger if exists qr_events_outbox on public.qr_link_events;
create trigger qr_events_outbox
  after insert on public.qr_link_events
  for each row when (new.kind = 'target' or (new.kind = 'schedule' and new.new_value is not null))
  execute function public.qr_events_outbox();

/** المشاركة: للمالك، مع حامل صلاحية المولّد غير المالك، ويُختم المانح. */
create or replace function public.qr_link_shares_guard()
returns trigger language plpgsql security definer
set search_path = pg_catalog, public, pg_temp as $$
begin
  if exists (select 1 from public.qr_links where id = new.link_id and owner_id = new.user_id) then
    raise exception 'المالك لا يُشارَك معه باركوده.' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.profile_permissions pp
    join public.profiles p on p.id = pp.profile_id
    where pp.profile_id = new.user_id and pp.permission = 'use_qr_generator' and p.is_active
  ) then
    raise exception 'المشاركة لحاملي صلاحية المولّد فقط.' using errcode = '22023';
  end if;
  new.granted_by := coalesce(auth.uid(), new.granted_by);
  return new;
end;
$$;

drop trigger if exists qr_link_shares_guard on public.qr_link_shares;
create trigger qr_link_shares_guard
  before insert or update on public.qr_link_shares
  for each row execute function public.qr_link_shares_guard();

create or replace function public.qr_campaign_shares_guard()
returns trigger language plpgsql security definer
set search_path = pg_catalog, public, pg_temp as $$
begin
  if exists (select 1 from public.qr_campaigns where id = new.campaign_id and owner_id = new.user_id) then
    raise exception 'المالك لا يُشارَك معه حملته.' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.profile_permissions pp
    join public.profiles p on p.id = pp.profile_id
    where pp.profile_id = new.user_id and pp.permission = 'use_qr_generator' and p.is_active
  ) then
    raise exception 'المشاركة لحاملي صلاحية المولّد فقط.' using errcode = '22023';
  end if;
  new.granted_by := coalesce(auth.uid(), new.granted_by);
  return new;
end;
$$;

drop trigger if exists qr_campaign_shares_guard on public.qr_campaign_shares;
create trigger qr_campaign_shares_guard
  before insert or update on public.qr_campaign_shares
  for each row execute function public.qr_campaign_shares_guard();

create or replace function public.qr_campaigns_touch()
returns trigger language plpgsql
set search_path = pg_catalog, public, pg_temp as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists qr_campaigns_touch on public.qr_campaigns;
create trigger qr_campaigns_touch
  before update on public.qr_campaigns
  for each row execute function public.qr_campaigns_touch();

/**
 * حذف الحملة يُخرج باركوداتها وتبقى تعمل. نُخرجها هنا قبل الحذف لا بـ
 * ON DELETE SET NULL وحده، حتى يُسجَّل اسم الحملة في كل واقعة.
 */
create or replace function public.qr_campaigns_detach()
returns trigger language plpgsql security definer
set search_path = pg_catalog, public, pg_temp as $$
begin
  perform set_config('qr.internal', 'on', true);
  update public.qr_links set campaign_id = null where campaign_id = old.id;
  perform set_config('qr.internal', '', true);
  return old;
end;
$$;

drop trigger if exists qr_campaigns_detach on public.qr_campaigns;
create trigger qr_campaigns_detach
  before delete on public.qr_campaigns
  for each row execute function public.qr_campaigns_detach();

/**
 * قبل حذف حساب: تُنقل حملاته ثم باركوداته إلى حساب الجهة، وتُسجَّل الوقائع.
 * الحملات أولًا حتى يبقى شرط «الحملة لمالك الباركود» صحيحًا في كل خطوة.
 * إن لم يوجد حساب جهة يمضي الحذف.
 */
create or replace function public.qr_reassign_on_profile_delete()
returns trigger language plpgsql security definer
set search_path = pg_catalog, public, pg_temp as $$
declare
  v_org uuid;
begin
  select profile_id into v_org
  from public.profile_permissions
  where permission = 'qr_org_account' and profile_id <> old.id
  limit 1;

  if v_org is null then
    return old;
  end if;

  perform set_config('qr.internal', 'on', true);
  update public.qr_campaigns set owner_id = v_org where owner_id = old.id;
  update public.qr_links set owner_id = v_org where owner_id = old.id;
  -- حساب الجهة صار مالكًا: مشاركاته السابقة عليها لا معنى لها
  delete from public.qr_link_shares s using public.qr_links l
  where s.link_id = l.id and l.owner_id = v_org and s.user_id = v_org;
  delete from public.qr_campaign_shares s using public.qr_campaigns c
  where s.campaign_id = c.id and c.owner_id = v_org and s.user_id = v_org;
  perform set_config('qr.internal', '', true);
  return old;
end;
$$;

drop trigger if exists qr_reassign_on_profile_delete on public.profiles;
create trigger qr_reassign_on_profile_delete
  before delete on public.profiles
  for each row execute function public.qr_reassign_on_profile_delete();

-- ════════════════════════════════════════════════════════════════════════════
-- ٦. السياسات والمنح
-- ════════════════════════════════════════════════════════════════════════════

alter table public.qr_campaigns        enable row level security;
alter table public.qr_links            enable row level security;
alter table public.qr_scans            enable row level security;
alter table public.qr_schedules        enable row level security;
alter table public.qr_link_events      enable row level security;
alter table public.qr_link_shares      enable row level security;
alter table public.qr_campaign_shares  enable row level security;
alter table public.qr_alert_outbox     enable row level security;
alter table public.qr_upload_tickets   enable row level security;
alter table public.qr_file_trash       enable row level security;

revoke all on public.qr_campaigns, public.qr_links, public.qr_scans, public.qr_schedules,
  public.qr_link_events, public.qr_link_shares, public.qr_campaign_shares,
  public.qr_alert_outbox, public.qr_upload_tickets, public.qr_file_trash
  from anon, authenticated;

-- ── الباركود ───────────────────────────────────────────────────────────────
-- الرمز والمالك والعدّاد خارج منحة التحديث: الرمز لا يُعدَّل بعد الإنشاء أبدًا
grant select, delete on public.qr_links to authenticated;
grant insert (id, code, title, kind, target_url, file_path, spec, owner_id, campaign_id, active)
  on public.qr_links to authenticated;
grant update (title, target_url, kind, file_path, spec, active, campaign_id, updated_at)
  on public.qr_links to authenticated;

drop policy if exists "qr_links: read" on public.qr_links;
create policy "qr_links: read"
  on public.qr_links for select to authenticated
  using (
    (owner_id = (select auth.uid()) and (select public.qr_can_use()))
    or public.share_access(id) is not null
    or (select public.qr_can_oversee())
  );

drop policy if exists "qr_links: create own" on public.qr_links;
create policy "qr_links: create own"
  on public.qr_links for insert to authenticated
  with check (owner_id = (select auth.uid()) and (select public.qr_can_use()));

drop policy if exists "qr_links: owner or editor updates" on public.qr_links;
create policy "qr_links: owner or editor updates"
  on public.qr_links for update to authenticated
  using (
    (owner_id = (select auth.uid()) and (select public.qr_can_use()))
    or public.share_access(id) = 'edit'
  )
  with check (
    (owner_id = (select auth.uid()) and (select public.qr_can_use()))
    or public.share_access(id) = 'edit'
  );

drop policy if exists "qr_links: owner deletes" on public.qr_links;
create policy "qr_links: owner deletes"
  on public.qr_links for delete to authenticated
  using (owner_id = (select auth.uid()) and (select public.qr_can_use()));

-- ── المسحات: قراءة لمن يرى الباركود، والإدراج عبر qr_resolve وحدها ──────────
grant select on public.qr_scans to authenticated;

drop policy if exists "qr_scans: read with link" on public.qr_scans;
create policy "qr_scans: read with link"
  on public.qr_scans for select to authenticated
  using (public.qr_can_read_link(link_id));

-- ── الجدولة ────────────────────────────────────────────────────────────────
grant select, delete on public.qr_schedules to authenticated;
grant insert (link_id, target_url, starts_at, ends_at, note) on public.qr_schedules to authenticated;
grant update (target_url, starts_at, ends_at, note) on public.qr_schedules to authenticated;

drop policy if exists "qr_schedules: read with link" on public.qr_schedules;
create policy "qr_schedules: read with link"
  on public.qr_schedules for select to authenticated
  using (public.qr_can_read_link(link_id));

drop policy if exists "qr_schedules: editors write" on public.qr_schedules;
create policy "qr_schedules: editors write"
  on public.qr_schedules for insert to authenticated
  with check (public.qr_can_edit_link(link_id));

drop policy if exists "qr_schedules: editors update" on public.qr_schedules;
create policy "qr_schedules: editors update"
  on public.qr_schedules for update to authenticated
  using (public.qr_can_edit_link(link_id))
  with check (public.qr_can_edit_link(link_id));

drop policy if exists "qr_schedules: editors delete" on public.qr_schedules;
create policy "qr_schedules: editors delete"
  on public.qr_schedules for delete to authenticated
  using (public.qr_can_edit_link(link_id));

-- ── سجل الأحداث: يقرؤه المالك والمشرف، ولا كتابة لأحد ───────────────────────
grant select on public.qr_link_events to authenticated;

drop policy if exists "qr_link_events: owner and overseer read" on public.qr_link_events;
create policy "qr_link_events: owner and overseer read"
  on public.qr_link_events for select to authenticated
  using ((select public.qr_can_oversee()) or public.qr_is_owner(link_id));

-- ── المشاركة ───────────────────────────────────────────────────────────────
grant select, delete on public.qr_link_shares to authenticated;
grant insert (link_id, user_id, access) on public.qr_link_shares to authenticated;
grant update (access) on public.qr_link_shares to authenticated;

drop policy if exists "qr_link_shares: read" on public.qr_link_shares;
create policy "qr_link_shares: read"
  on public.qr_link_shares for select to authenticated
  using (user_id = (select auth.uid()) or public.qr_is_owner(link_id));

drop policy if exists "qr_link_shares: owner grants" on public.qr_link_shares;
create policy "qr_link_shares: owner grants"
  on public.qr_link_shares for insert to authenticated
  with check (public.qr_is_owner(link_id));

drop policy if exists "qr_link_shares: owner changes" on public.qr_link_shares;
create policy "qr_link_shares: owner changes"
  on public.qr_link_shares for update to authenticated
  using (public.qr_is_owner(link_id))
  with check (public.qr_is_owner(link_id));

drop policy if exists "qr_link_shares: owner revokes" on public.qr_link_shares;
create policy "qr_link_shares: owner revokes"
  on public.qr_link_shares for delete to authenticated
  using (public.qr_is_owner(link_id));

-- ── الحملات ────────────────────────────────────────────────────────────────
grant select, delete on public.qr_campaigns to authenticated;
grant insert (id, name, note, owner_id) on public.qr_campaigns to authenticated;
grant update (name, note) on public.qr_campaigns to authenticated;

drop policy if exists "qr_campaigns: read" on public.qr_campaigns;
create policy "qr_campaigns: read"
  on public.qr_campaigns for select to authenticated
  using (
    (owner_id = (select auth.uid()) and (select public.qr_can_use()))
    or public.campaign_access(id) is not null
    or (select public.qr_can_oversee())
  );

drop policy if exists "qr_campaigns: create own" on public.qr_campaigns;
create policy "qr_campaigns: create own"
  on public.qr_campaigns for insert to authenticated
  with check (owner_id = (select auth.uid()) and (select public.qr_can_use()));

drop policy if exists "qr_campaigns: owner renames" on public.qr_campaigns;
create policy "qr_campaigns: owner renames"
  on public.qr_campaigns for update to authenticated
  using (owner_id = (select auth.uid()) and (select public.qr_can_use()))
  with check (owner_id = (select auth.uid()) and (select public.qr_can_use()));

drop policy if exists "qr_campaigns: owner deletes" on public.qr_campaigns;
create policy "qr_campaigns: owner deletes"
  on public.qr_campaigns for delete to authenticated
  using (owner_id = (select auth.uid()) and (select public.qr_can_use()));

grant select, delete on public.qr_campaign_shares to authenticated;
grant insert (campaign_id, user_id, access) on public.qr_campaign_shares to authenticated;
grant update (access) on public.qr_campaign_shares to authenticated;

drop policy if exists "qr_campaign_shares: read" on public.qr_campaign_shares;
create policy "qr_campaign_shares: read"
  on public.qr_campaign_shares for select to authenticated
  using (user_id = (select auth.uid()) or public.qr_is_campaign_owner(campaign_id));

drop policy if exists "qr_campaign_shares: owner grants" on public.qr_campaign_shares;
create policy "qr_campaign_shares: owner grants"
  on public.qr_campaign_shares for insert to authenticated
  with check (public.qr_is_campaign_owner(campaign_id));

drop policy if exists "qr_campaign_shares: owner changes" on public.qr_campaign_shares;
create policy "qr_campaign_shares: owner changes"
  on public.qr_campaign_shares for update to authenticated
  using (public.qr_is_campaign_owner(campaign_id))
  with check (public.qr_is_campaign_owner(campaign_id));

drop policy if exists "qr_campaign_shares: owner revokes" on public.qr_campaign_shares;
create policy "qr_campaign_shares: owner revokes"
  on public.qr_campaign_shares for delete to authenticated
  using (public.qr_is_campaign_owner(campaign_id));

-- ── صندوق التنبيهات: يقرؤه المشرف ليعرف حالة كل تبديل ─────────────────────
grant select on public.qr_alert_outbox to authenticated;

drop policy if exists "qr_alert_outbox: overseer reads" on public.qr_alert_outbox;
create policy "qr_alert_outbox: overseer reads"
  on public.qr_alert_outbox for select to authenticated
  using ((select public.qr_can_oversee()));

-- qr_upload_tickets وqr_file_trash: لا سياسة ولا منحة — للدوالّ وحدها.

-- ════════════════════════════════════════════════════════════════════════════
-- ٧. باب المسح وصفحة العرض
-- ════════════════════════════════════════════════════════════════════════════

/**
 * نداء واحد ذرّي لكل مسح: يجد الرابط الفعّال، ويختار الوجهة، ويسجّل المسح.
 *
 * الوجهة = آخر نافذة جدولة بدأت ولم تنتهِ (البداية الفارغة = −∞)، وإلا
 * الوجهة الأصلية. مسح البصمة نفسها خلال دقيقة لا يُسجَّل، والتحويل يتم دائمًا.
 * صف الآلة يُحفظ ولا يُعدّ.
 */
create or replace function public.qr_resolve(
  p_secret   text,
  p_code     text,
  p_visitor  text default null,
  p_referrer text default null,
  p_device   text default 'unknown',
  p_is_bot   boolean default false
)
returns text language plpgsql volatile security definer
set search_path = pg_catalog, public, pg_temp as $$
declare
  v_id      uuid;
  v_target  text;
  v_sched   text;
  v_visitor text := case when p_visitor ~ '^[0-9a-f]{64}$' then p_visitor end;
  v_device  text := case when p_device in ('mobile', 'tablet', 'desktop') then p_device else 'unknown' end;
  v_bot     boolean := coalesce(p_is_bot, false);
begin
  if not public.qr_key_ok(p_secret) then
    raise exception 'مفتاح الخادم غير صحيح.' using errcode = '42501';
  end if;

  select id, target_url into v_id, v_target
  from public.qr_links
  where code = p_code and active;

  if v_id is null then
    return null;
  end if;

  select s.target_url into v_sched
  from public.qr_schedules s
  where s.link_id = v_id
    and (s.starts_at is null or s.starts_at <= now())
    and (s.ends_at is null or s.ends_at > now())
  order by s.starts_at desc nulls last, s.created_at desc
  limit 1;

  if v_visitor is not null then
    -- قفل قصير على (الرابط، البصمة) حتى لا يُسجَّل مسحان متزامنان
    perform pg_advisory_xact_lock(hashtextextended(v_id::text || v_visitor, 0));
    if exists (
      select 1 from public.qr_scans
      where link_id = v_id and visitor = v_visitor and scanned_at > now() - interval '1 minute'
    ) then
      return coalesce(v_sched, v_target);
    end if;
  end if;

  insert into public.qr_scans (link_id, visitor, referrer, device, is_bot)
  values (v_id, v_visitor, left(nullif(p_referrer, ''), 500), v_device, v_bot);

  if not v_bot then
    update public.qr_links set scan_count = scan_count + 1 where id = v_id;
  end if;

  return coalesce(v_sched, v_target);
end;
$$;

revoke all on function public.qr_resolve(text, text, text, text, text, boolean) from public, anon;
grant execute on function public.qr_resolve(text, text, text, text, text, boolean) to anon, authenticated;

/** صفحة العرض العلنية: المسار وحده، لرابط فعّال من نوع ملف. لا عنوان ولا مالك. */
create or replace function public.qr_file_of(p_code text)
returns text language sql stable security definer
set search_path = pg_catalog, public, pg_temp as $$
  select file_path from public.qr_links
  where code = p_code and active and kind = 'file';
$$;

revoke all on function public.qr_file_of(text) from public, anon;
grant execute on function public.qr_file_of(text) to anon, authenticated;

-- ════════════════════════════════════════════════════════════════════════════
-- ٨. دوالّ الواجهة
-- ════════════════════════════════════════════════════════════════════════════

/** فحص التوفّر: وجودٌ فقط، لأن السياسات تخفي رموز الآخرين. */
create or replace function public.qr_code_taken(p_code text)
returns boolean language plpgsql stable security definer
set search_path = pg_catalog, public, pg_temp as $$
begin
  if not public.has_permission('use_qr_generator') then
    raise exception 'لا صلاحية.' using errcode = '42501';
  end if;
  return exists (select 1 from public.qr_links where code = lower(btrim(p_code)));
end;
$$;

revoke all on function public.qr_code_taken(text) from public, anon;
grant execute on function public.qr_code_taken(text) to authenticated;

create or replace function public.qr_display_name(p public.profiles)
returns text language sql immutable
set search_path = pg_catalog, public, pg_temp as $$
  -- بلا اسم: تسمية محايدة لا البريد — البريد لا يُكشف لبقيّة الموظفين
  select coalesce(nullif(btrim(p.full_name_ar), ''), nullif(btrim(p.full_name_en), ''),
                  'زميل ' || upper(left(p.id::text, 4)));
$$;

revoke all on function public.qr_display_name(public.profiles) from public, anon, authenticated;

/** المرشّحون للمشاركة: حاملو صلاحية المولّد عدا السائل — المعرّف والاسم فقط. */
create or replace function public.qr_share_candidates()
returns table (id uuid, name text) language plpgsql stable security definer
set search_path = pg_catalog, public, pg_temp as $$
begin
  if not public.has_permission('use_qr_generator') then
    raise exception 'لا صلاحية.' using errcode = '42501';
  end if;
  return query
    select p.id, public.qr_display_name(p)
    from public.profiles p
    join public.profile_permissions pp on pp.profile_id = p.id and pp.permission = 'use_qr_generator'
    where p.is_active and p.id <> auth.uid()
    order by 2;
end;
$$;

revoke all on function public.qr_share_candidates() from public, anon;
grant execute on function public.qr_share_candidates() to authenticated;

/** حاملو صلاحية المولّد — للمشرف حين ينقل ملكية. */
create or replace function public.qr_generator_holders()
returns table (id uuid, name text) language plpgsql stable security definer
set search_path = pg_catalog, public, pg_temp as $$
begin
  if not public.has_permission('oversee_qr') then
    raise exception 'لا صلاحية.' using errcode = '42501';
  end if;
  return query
    select p.id, public.qr_display_name(p)
    from public.profiles p
    join public.profile_permissions pp on pp.profile_id = p.id and pp.permission = 'use_qr_generator'
    where p.is_active
    order by 2;
end;
$$;

revoke all on function public.qr_generator_holders() from public, anon;
grant execute on function public.qr_generator_holders() to authenticated;

/**
 * أسماء لعرضها بجانب الوقائع والمشاركات. المشرف يرى أي اسم؛ وغيره يرى
 * أسماء أصحاب صلاحيات الباركود وحدهم. الاسم فقط — لا بريد ولا رقم.
 */
create or replace function public.qr_people(p_ids uuid[])
returns table (id uuid, name text) language plpgsql stable security definer
set search_path = pg_catalog, public, pg_temp as $$
declare
  v_oversee boolean := public.has_permission('oversee_qr');
begin
  if not (v_oversee or public.has_permission('use_qr_generator')) then
    raise exception 'لا صلاحية.' using errcode = '42501';
  end if;
  return query
    select p.id, public.qr_display_name(p)
    from public.profiles p
    where p.id = any (p_ids)
      and (v_oversee or exists (select 1 from public.profile_permissions pp where pp.profile_id = p.id));
end;
$$;

revoke all on function public.qr_people(uuid[]) from public, anon;
grant execute on function public.qr_people(uuid[]) to authenticated;

/**
 * قائمة المستخدم: ما يملكه + ما شُورك فيه + ما في حملات شُورك فيها، بلا
 * تكرار. تصفّي بالملكية صراحةً حتى لا يرى المشرف باركودات الجميع هنا.
 */
create or replace function public.qr_my_links()
returns table (
  id uuid, code text, title text, kind text, target_url text, file_path text,
  owner_id uuid, campaign_id uuid, active boolean, scan_count integer,
  created_at timestamptz, updated_at timestamptz, access text
) language sql stable security invoker
set search_path = pg_catalog, public, pg_temp as $$
  select l.id, l.code, l.title, l.kind, l.target_url, l.file_path, l.owner_id, l.campaign_id,
         l.active, l.scan_count, l.created_at, l.updated_at,
         case when l.owner_id = auth.uid() then 'owner' else public.share_access(l.id) end
  from public.qr_links l
  where (l.owner_id = auth.uid() and public.qr_can_use())
     or public.share_access(l.id) is not null
  order by l.created_at desc;
$$;

revoke all on function public.qr_my_links() from public, anon;
grant execute on function public.qr_my_links() to authenticated;

/** حملات المستخدم مع مجاميعها — تُحسب ولا تُخزَّن. */
create or replace function public.qr_my_campaigns()
returns table (
  id uuid, name text, note text, owner_id uuid, created_at timestamptz, updated_at timestamptz,
  access text, links integer, scans bigint
) language sql stable security invoker
set search_path = pg_catalog, public, pg_temp as $$
  select c.id, c.name, c.note, c.owner_id, c.created_at, c.updated_at,
         public.campaign_access(c.id),
         (select count(*)::integer from public.qr_links l where l.campaign_id = c.id),
         (select coalesce(sum(l.scan_count), 0)::bigint from public.qr_links l where l.campaign_id = c.id)
  from public.qr_campaigns c
  where public.campaign_access(c.id) is not null
  order by c.created_at desc;
$$;

revoke all on function public.qr_my_campaigns() from public, anon;
grant execute on function public.qr_my_campaigns() to authenticated;

/**
 * تذكرة رفع: يفحص الصلاحية والنوع والحجم، ويصكّ المسار
 * {userId}/{uuid}.{ext}. سياسة المخزن لا تقبل إدراجًا إلا بتذكرة كهذه.
 */
create or replace function public.qr_issue_upload_ticket(p_mime text, p_bytes integer)
returns text language plpgsql volatile security definer
set search_path = pg_catalog, public, pg_temp as $$
declare
  v_uid  uuid := auth.uid();
  v_ext  text;
  v_path text;
begin
  if v_uid is null or not public.has_permission('use_qr_generator') then
    raise exception 'لا صلاحية.' using errcode = '42501';
  end if;

  v_ext := case p_mime
    when 'image/webp' then 'webp'
    when 'image/jpeg' then 'jpg'
    when 'image/png' then 'png'
    when 'application/pdf' then 'pdf'
  end;
  if v_ext is null then
    raise exception 'نوع الملف غير مقبول.' using errcode = '22023';
  end if;
  if p_bytes is null or p_bytes <= 0
     or (v_ext = 'pdf' and p_bytes > 10 * 1024 * 1024)
     or (v_ext <> 'pdf' and p_bytes > 4 * 1024 * 1024) then
    raise exception 'حجم الملف يتجاوز الحدّ.' using errcode = '22023';
  end if;

  delete from public.qr_upload_tickets where user_id = v_uid and expires_at <= now();
  if (select count(*) from public.qr_upload_tickets
      where user_id = v_uid and created_at > now() - interval '1 hour') >= 40 then
    raise exception 'محاولات رفع كثيرة. انتظر قليلًا.' using errcode = '54000';
  end if;

  v_path := v_uid::text || '/' || gen_random_uuid()::text || '.' || v_ext;
  insert into public.qr_upload_tickets (path, user_id, mime, bytes) values (v_path, v_uid, p_mime, p_bytes);
  return v_path;
end;
$$;

revoke all on function public.qr_issue_upload_ticket(text, integer) from public, anon;
grant execute on function public.qr_issue_upload_ticket(text, integer) to authenticated;

/**
 * إحصاء باركود واحد. سقف القراءة ٢٠٬٠٠٠ صفّ (الأحدث في المدّة)، والجواب
 * يقول إن بُلغ. المجموع وعدد الآلات وأول/آخر مسح من المدّة كاملة.
 * لا «زوار فريدون»: البصمة تدور يوميًّا، فالرقم مضلّل.
 */
create or replace function public.qr_link_stats(
  p_link uuid,
  p_from timestamptz default null,
  p_to   timestamptz default null
)
returns jsonb language plpgsql stable security definer
set search_path = pg_catalog, public, pg_temp as $$
declare
  v_tz      constant text := 'Asia/Riyadh';
  v_cap     constant integer := 20000;
  v_created timestamptz;
  v_from    timestamptz;
  v_to      timestamptz;
  v_total   bigint;
  v_bots    bigint;
  v_rows    bigint;
  v_start   date;
  v_end     date;
  v_bucket  text;
  v_result  jsonb;
begin
  if public.qr_link_access(p_link) is null then
    raise exception 'لم يُعثر على الباركود.' using errcode = 'P0002';
  end if;

  select created_at into v_created from public.qr_links where id = p_link;
  v_from := greatest(coalesce(p_from, v_created), v_created);
  v_to := least(coalesce(p_to, 'infinity'::timestamptz), now() + interval '1 second');
  if v_to < v_from then v_to := v_from; end if;

  select count(*) filter (where not is_bot), count(*) filter (where is_bot), count(*)
    into v_total, v_bots, v_rows
  from public.qr_scans
  where link_id = p_link and scanned_at >= v_from and scanned_at < v_to;

  v_start := (v_from at time zone v_tz)::date;
  v_end := ((v_to - interval '1 microsecond') at time zone v_tz)::date;
  if v_end < v_start then v_end := v_start; end if;
  v_bucket := case when v_end - v_start + 1 > 120 then 'week' else 'day' end;

  with base as materialized (
    select scanned_at, device, is_bot
    from public.qr_scans
    where link_id = p_link and scanned_at >= v_from and scanned_at < v_to
    order by scanned_at desc
    limit v_cap
  ),
  human as (
    select (scanned_at at time zone v_tz) as local, scanned_at, device from base where not is_bot
  ),
  days as (
    select d::date as day from generate_series(v_start, v_end, interval '1 day') d
  ),
  buckets as (
    select case when v_bucket = 'week'
                then day - extract(dow from day)::integer   -- الأسبوع يبدأ الأحد
                else day end as b,
           day
    from days
  ),
  series as (
    select bk.b, count(h.local) as n
    from (select distinct b from buckets) bk
    left join human h
      on (case when v_bucket = 'week'
               then h.local::date - extract(dow from h.local::date)::integer
               else h.local::date end) = bk.b
    group by bk.b
    order by bk.b desc
    limit 365
  )
  select jsonb_build_object(
    'total', v_total,
    'bots', v_bots,
    'capped', v_rows > v_cap,
    'cap', v_cap,
    'bucket', v_bucket,
    'from', v_from,
    'to', v_to,
    'series', (select coalesce(jsonb_agg(jsonb_build_object('d', b, 'n', n) order by b), '[]'::jsonb) from series),
    'devices', (
      select coalesce(jsonb_object_agg(device, n), '{}'::jsonb)
      from (select device, count(*) as n from human group by device) x
    ),
    'hours', (
      select jsonb_agg(coalesce(x.n, 0) order by h)
      from generate_series(0, 23) h
      left join (select extract(hour from local)::integer as hh, count(*) as n from human group by 1) x
        on x.hh = h
    ),
    'heatmap', (
      select jsonb_agg(row_hours order by dow)
      from (
        select dw.dow, jsonb_agg(coalesce(x.n, 0) order by hr.h) as row_hours
        from generate_series(0, 6) dw(dow)
        cross join generate_series(0, 23) hr(h)
        left join (
          select extract(dow from local)::integer as dd, extract(hour from local)::integer as hh, count(*) as n
          from human group by 1, 2
        ) x on x.dd = dw.dow and x.hh = hr.h
        group by dw.dow
      ) m
    ),
    'first', (
      select min(scanned_at) from public.qr_scans
      where link_id = p_link and not is_bot and scanned_at >= v_from and scanned_at < v_to
    ),
    'last', (
      select max(scanned_at) from public.qr_scans
      where link_id = p_link and not is_bot and scanned_at >= v_from and scanned_at < v_to
    ),
    'week', jsonb_build_object(
      'current', (select count(*) from human
                  where scanned_at >= greatest(v_from, v_to - interval '7 days')),
      'previous', (select count(*) from human
                   where scanned_at >= greatest(v_from, v_to - interval '14 days')
                     and scanned_at < greatest(v_from, v_to - interval '7 days'))
    )
  ) into v_result;

  return v_result;
end;
$$;

revoke all on function public.qr_link_stats(uuid, timestamptz, timestamptz) from public, anon;
grant execute on function public.qr_link_stats(uuid, timestamptz, timestamptz) to authenticated;

-- ════════════════════════════════════════════════════════════════════════════
-- ٩. الإشراف — دوالّ ضيّقة تفحص oversee_qr ولا تفتح سياسات كتابة
-- ════════════════════════════════════════════════════════════════════════════

create or replace function public.qr_require_overseer()
returns void language plpgsql stable security definer
set search_path = pg_catalog, public, pg_temp as $$
begin
  if not public.has_permission('oversee_qr') then
    raise exception 'الإشراف مقصور على حاملي صلاحيته.' using errcode = '42501';
  end if;
end;
$$;

revoke all on function public.qr_require_overseer() from public, anon, authenticated;

create or replace function public.qr_oversee_links()
returns table (
  id uuid, code text, title text, kind text, target_url text, active boolean,
  scan_count integer, owner_id uuid, owner_name text, campaign_id uuid,
  created_at timestamptz, updated_at timestamptz
) language plpgsql stable security definer
set search_path = pg_catalog, public, pg_temp as $$
begin
  perform public.qr_require_overseer();
  return query
    select l.id, l.code, l.title, l.kind, l.target_url, l.active, l.scan_count, l.owner_id,
           public.qr_display_name(p), l.campaign_id, l.created_at, l.updated_at
    from public.qr_links l
    join public.profiles p on p.id = l.owner_id
    order by l.updated_at desc;
end;
$$;

revoke all on function public.qr_oversee_links() from public, anon;
grant execute on function public.qr_oversee_links() to authenticated;

/** آخر الأحداث بأسماء الفاعلين، وحالة التنبيه لكل تبديل وجهة. */
create or replace function public.qr_oversee_events(p_limit integer default 60)
returns table (
  id bigint, link_id uuid, link_title text, link_code text, actor_id uuid, actor_name text,
  kind text, old_value text, new_value text, at timestamptz, alert_status text, alert_error text
) language plpgsql stable security definer
set search_path = pg_catalog, public, pg_temp as $$
begin
  perform public.qr_require_overseer();
  return query
    select e.id, e.link_id,
           coalesce(l.title, case when e.kind = 'delete' then e.new_value end),
           coalesce(l.code, case when e.kind = 'delete' then e.old_value end),
           e.actor_id, public.qr_display_name(p),
           e.kind,
           case when e.kind = 'spec' then null else e.old_value end,
           case when e.kind = 'spec' then null else e.new_value end,
           e.at, o.status, o.error
    from public.qr_link_events e
    left join public.qr_links l on l.id = e.link_id
    left join public.profiles p on p.id = e.actor_id
    left join public.qr_alert_outbox o on o.event_id = e.id
    order by e.at desc, e.id desc
    limit least(greatest(coalesce(p_limit, 60), 1), 500);
end;
$$;

revoke all on function public.qr_oversee_events(integer) from public, anon;
grant execute on function public.qr_oversee_events(integer) to authenticated;

create or replace function public.qr_oversee_set_active(p_link uuid, p_active boolean)
returns void language plpgsql volatile security definer
set search_path = pg_catalog, public, pg_temp as $$
begin
  perform public.qr_require_overseer();
  update public.qr_links set active = p_active where id = p_link;
  if not found then
    raise exception 'لم يُعثر على الباركود.' using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.qr_oversee_set_active(uuid, boolean) from public, anon;
grant execute on function public.qr_oversee_set_active(uuid, boolean) to authenticated;

/** يحذف ويُرجع مسار الملف (إن وُجد) ليمحوه الخادم بجلسة المشرف. */
create or replace function public.qr_oversee_delete(p_link uuid)
returns text language plpgsql volatile security definer
set search_path = pg_catalog, public, pg_temp as $$
declare
  v_path text;
begin
  perform public.qr_require_overseer();
  delete from public.qr_links where id = p_link returning file_path into v_path;
  if not found then
    raise exception 'لم يُعثر على الباركود.' using errcode = 'P0002';
  end if;
  return v_path;
end;
$$;

revoke all on function public.qr_oversee_delete(uuid) from public, anon;
grant execute on function public.qr_oversee_delete(uuid) to authenticated;

/** نقل ملكية إلى حامل صلاحية المولّد فقط. النقل يُخرج الباركود من حملته. */
create or replace function public.qr_oversee_transfer(p_link uuid, p_owner uuid)
returns void language plpgsql volatile security definer
set search_path = pg_catalog, public, pg_temp as $$
begin
  perform public.qr_require_overseer();
  if not exists (
    select 1 from public.profile_permissions pp
    join public.profiles p on p.id = pp.profile_id
    where pp.profile_id = p_owner and pp.permission = 'use_qr_generator' and p.is_active
  ) then
    raise exception 'المالك الجديد لا يحمل صلاحية المولّد.' using errcode = '22023';
  end if;

  perform set_config('qr.internal', 'on', true);
  update public.qr_links set owner_id = p_owner, campaign_id = null where id = p_link;
  if not found then
    perform set_config('qr.internal', '', true);
    raise exception 'لم يُعثر على الباركود.' using errcode = 'P0002';
  end if;
  delete from public.qr_link_shares where link_id = p_link and user_id = p_owner;
  perform set_config('qr.internal', '', true);
end;
$$;

revoke all on function public.qr_oversee_transfer(uuid, uuid) from public, anon;
grant execute on function public.qr_oversee_transfer(uuid, uuid) to authenticated;

/**
 * ملفّات خرجت من صفوفها ولم تُمحَ (حذف حساب بلا حساب جهة، أو انقطاع بعد
 * الاستبدال). المشرف وحده يملك محوها بجلسته، فتُكنس حين يفتح شاشته: تُنسى
 * المسارات التي لم يعد لها ملف، وتُرجَع التي ما زالت في المخزن ولا يشير إليها صفّ.
 */
create or replace function public.qr_trash_sweep(p_limit integer default 50)
returns setof text language plpgsql volatile security definer
set search_path = pg_catalog, public, pg_temp as $$
begin
  perform public.qr_require_overseer();
  delete from public.qr_file_trash t
  where not exists (select 1 from storage.objects o where o.bucket_id = 'qr-files' and o.name = t.path)
     or exists (select 1 from public.qr_links l where l.file_path = t.path);
  return query
    select t.path from public.qr_file_trash t
    order by t.at
    limit least(greatest(coalesce(p_limit, 50), 1), 200);
end;
$$;

revoke all on function public.qr_trash_sweep(integer) from public, anon;
grant execute on function public.qr_trash_sweep(integer) to authenticated;

-- ════════════════════════════════════════════════════════════════════════════
-- ١٠. تنبيه تبديل الوجهة — يستنزفه الخادم بالسرّ، دفعات من ٢٠
-- ════════════════════════════════════════════════════════════════════════════

/**
 * يحجز دفعة: ما لم يُحجز، أو حُجز قبل عشر دقائق ولم يُحسم (عملية سقطت).
 * SKIP LOCKED يمنع استنزافين متزامنين من إرسال الرسالة مرّتين.
 */
create or replace function public.qr_alerts_claim(p_secret text, p_limit integer default 20)
returns table (
  outbox_id bigint, link_id uuid, link_code text, link_title text, kind text,
  old_value text, new_value text, actor_name text, at timestamptz
) language plpgsql volatile security definer
set search_path = pg_catalog, public, pg_temp as $$
begin
  if not public.qr_key_ok(p_secret) then
    raise exception 'مفتاح الخادم غير صحيح.' using errcode = '42501';
  end if;

  return query
    with picked as (
      select o.id from public.qr_alert_outbox o
      where o.status = 'pending'
        and (o.claimed_at is null or o.claimed_at < now() - interval '10 minutes')
      order by o.id
      limit least(greatest(coalesce(p_limit, 20), 1), 20)
      for update skip locked
    ),
    claimed as (
      update public.qr_alert_outbox o
      set claimed_at = now(), attempts = o.attempts + 1
      from picked where o.id = picked.id
      returning o.id, o.event_id
    )
    select c.id, e.link_id, l.code, l.title, e.kind, e.old_value, e.new_value,
           public.qr_display_name(p), e.at
    from claimed c
    join public.qr_link_events e on e.id = c.event_id
    left join public.qr_links l on l.id = e.link_id
    left join public.profiles p on p.id = e.actor_id
    order by c.id;
end;
$$;

revoke all on function public.qr_alerts_claim(text, integer) from public, anon;
grant execute on function public.qr_alerts_claim(text, integer) to anon, authenticated;

create or replace function public.qr_alerts_recipients(p_secret text)
returns setof text language plpgsql stable security definer
set search_path = pg_catalog, public, pg_temp as $$
begin
  if not public.qr_key_ok(p_secret) then
    raise exception 'مفتاح الخادم غير صحيح.' using errcode = '42501';
  end if;
  return query
    select p.email::text
    from public.profiles p
    join public.profile_permissions pp on pp.profile_id = p.id and pp.permission = 'oversee_qr'
    where p.is_active
    order by 1;
end;
$$;

revoke all on function public.qr_alerts_recipients(text) from public, anon;
grant execute on function public.qr_alerts_recipients(text) to anon, authenticated;

create or replace function public.qr_alerts_mark(p_secret text, p_id bigint, p_status text, p_error text default null)
returns void language plpgsql volatile security definer
set search_path = pg_catalog, public, pg_temp as $$
begin
  if not public.qr_key_ok(p_secret) then
    raise exception 'مفتاح الخادم غير صحيح.' using errcode = '42501';
  end if;
  if p_status not in ('sent', 'failed', 'off') then
    raise exception 'حالة غير صالحة.' using errcode = '22023';
  end if;
  update public.qr_alert_outbox
  set status = p_status,
      error = left(p_error, 500),
      sent_at = case when p_status = 'sent' then now() else sent_at end
  where id = p_id and status = 'pending';
end;
$$;

revoke all on function public.qr_alerts_mark(text, bigint, text, text) from public, anon;
grant execute on function public.qr_alerts_mark(text, bigint, text, text) to anon, authenticated;

-- ════════════════════════════════════════════════════════════════════════════
-- ١١. صيانة يدوية — لا تُجدول ولا تُمنح لأحد؛ تُشغَّل من محرّر SQL
-- ════════════════════════════════════════════════════════════════════════════

/** المسحات تُحفظ للأبد. هذه للحذف اليدوي إن احتيج يومًا. */
create or replace function public.qr_prune_scans(p_before timestamptz)
returns bigint language plpgsql volatile security definer
set search_path = pg_catalog, public, pg_temp as $$
declare
  v_count bigint;
begin
  delete from public.qr_scans where scanned_at < p_before;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.qr_prune_scans(timestamptz) from public, anon, authenticated;

-- ════════════════════════════════════════════════════════════════════════════
-- ١٢. المخزن: قراءة علنية، ١٠ ميغابايت، ولا كتابة إلا بتذكرة من الخادم
-- ════════════════════════════════════════════════════════════════════════════

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('qr-files', 'qr-files', true, 10485760,
        array['image/webp', 'image/jpeg', 'image/png', 'application/pdf'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- لا سياسة قراءة عامّة: الدلو علنيّ فروابطه تعمل بلا سياسة، وسياسة قراءة
-- للعموم تعني أن أي زائر يسرد كل الملفات — ومنها ملفات الباركودات الموقوفة.
-- القراءة هنا لما يحتاجه المحو والرفع فقط: مجلّد المستخدم، وما يحقّ له محوه.
drop policy if exists "qr-files: own or deletable read" on storage.objects;
create policy "qr-files: own or deletable read"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'qr-files'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or public.qr_file_deletable(name)
    )
  );

drop policy if exists "qr-files: ticketed upload" on storage.objects;
create policy "qr-files: ticketed upload"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'qr-files' and public.qr_upload_allowed(name));

drop policy if exists "qr-files: delete unreferenced" on storage.objects;
create policy "qr-files: delete unreferenced"
  on storage.objects for delete to authenticated
  using (bucket_id = 'qr-files' and public.qr_file_deletable(name));
