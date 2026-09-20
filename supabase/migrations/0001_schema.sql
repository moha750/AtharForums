-- ════════════════════════════════════════════════════════════════════════════
-- منتديات أثر — المخطّط الأساسي
-- وزارة الموارد البشرية والتنمية الاجتماعية
-- ════════════════════════════════════════════════════════════════════════════

create extension if not exists "pgcrypto";
create extension if not exists "citext";

-- ── الأنواع ────────────────────────────────────────────────────────────────
do $$ begin
  create type public.app_role as enum ('member', 'forum_lead', 'admin', 'super_admin');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.membership_status as enum ('pending', 'approved', 'rejected', 'withdrawn', 'removed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.membership_role as enum ('member', 'core', 'lead');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.publish_status as enum ('draft', 'published', 'archived');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.event_mode as enum ('onsite', 'online', 'hybrid');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.registration_status as enum ('registered', 'waitlisted', 'cancelled');
exception when duplicate_object then null; end $$;

-- ── دالّة تحديث updated_at ─────────────────────────────────────────────────
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ── إعدادات الموقع (صف واحد) ───────────────────────────────────────────────
create table if not exists public.site_settings (
  id boolean primary key default true check (id),

  -- التدشين
  launch_at timestamptz not null default '2026-09-27T09:00:00Z',
  teaser_mode boolean not null default true,

  -- التسجيل
  registration_open boolean not null default true,
  allowed_email_domains text[] not null default array['hrsd.gov.sa'],
  bootstrap_admin_emails text[] not null default array['admin@hrsd.gov.sa'],

  -- الهوية
  site_name_ar text not null default 'منتديات أثر',
  site_name_en text not null default 'Athar Forums',
  tagline_ar text not null default 'منتديات تواصل .. تصنع أثراً',
  tagline_en text not null default 'Forums that connect, and leave a mark',
  about_ar text,
  about_en text,
  contact_email text,

  updated_at timestamptz not null default now(),
  updated_by uuid
);

comment on table public.site_settings is 'إعدادات عامة للموقع — صف واحد فقط (id = true)';

create or replace trigger site_settings_touch
  before update on public.site_settings
  for each row execute function public.touch_updated_at();

-- ── الملفات الشخصية ────────────────────────────────────────────────────────
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email citext not null unique,

  full_name_ar text,
  full_name_en text,
  employee_no text,
  job_title text,
  department text,
  sector text,
  work_location text,
  phone text,

  avatar_url text,
  bio text,
  skills text[] not null default '{}',
  interests text[] not null default '{}',

  role public.app_role not null default 'member',
  is_active boolean not null default true,
  onboarded_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on column public.profiles.role is 'صلاحية المستخدم على مستوى المنصّة كلها';

create index if not exists profiles_role_idx on public.profiles (role);
create index if not exists profiles_skills_idx on public.profiles using gin (skills);

create or replace trigger profiles_touch
  before update on public.profiles
  for each row execute function public.touch_updated_at();

-- ── المنتديات ──────────────────────────────────────────────────────────────
create table if not exists public.forums (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),

  name_ar text not null,
  name_en text,
  tagline_ar text,
  tagline_en text,
  description_ar text,
  description_en text,
  mission_ar text,
  mission_en text,

  icon text not null default 'Sparkles',
  color text not null default 'teal' check (color in ('teal', 'sage', 'ember')),
  cover_url text,

  skills text[] not null default '{}',
  capacity int check (capacity is null or capacity > 0),
  auto_approve boolean not null default false,
  is_accepting boolean not null default true,

  status public.publish_status not null default 'draft',
  sort_order int not null default 0,
  members_count int not null default 0,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.profiles (id) on delete set null
);

create index if not exists forums_status_idx on public.forums (status, sort_order);
create index if not exists forums_skills_idx on public.forums using gin (skills);

create or replace trigger forums_touch
  before update on public.forums
  for each row execute function public.touch_updated_at();

-- ── العضويات / طلبات الانضمام ──────────────────────────────────────────────
create table if not exists public.forum_memberships (
  id uuid primary key default gen_random_uuid(),
  forum_id uuid not null references public.forums (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,

  role public.membership_role not null default 'member',
  status public.membership_status not null default 'pending',

  motivation text,
  relevant_skills text[] not null default '{}',

  applied_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid references public.profiles (id) on delete set null,
  decision_note text,

  unique (forum_id, profile_id)
);

create index if not exists memberships_forum_status_idx on public.forum_memberships (forum_id, status);
create index if not exists memberships_profile_idx on public.forum_memberships (profile_id, status);

-- ── الفعاليات ──────────────────────────────────────────────────────────────
create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  forum_id uuid references public.forums (id) on delete cascade,
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),

  title_ar text not null,
  title_en text,
  description_ar text,
  description_en text,
  cover_url text,

  starts_at timestamptz not null,
  ends_at timestamptz,
  mode public.event_mode not null default 'onsite',
  location_ar text,
  location_en text,
  meeting_url text,

  capacity int check (capacity is null or capacity > 0),
  registration_open boolean not null default true,
  members_only boolean not null default false,
  registrations_count int not null default 0,

  status public.publish_status not null default 'draft',

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.profiles (id) on delete set null,

  constraint events_time_order check (ends_at is null or ends_at >= starts_at)
);

create index if not exists events_status_start_idx on public.events (status, starts_at desc);
create index if not exists events_forum_idx on public.events (forum_id, starts_at desc);

create or replace trigger events_touch
  before update on public.events
  for each row execute function public.touch_updated_at();

-- ── تسجيل الحضور في الفعاليات ──────────────────────────────────────────────
create table if not exists public.event_registrations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  status public.registration_status not null default 'registered',
  attended boolean not null default false,
  note text,
  created_at timestamptz not null default now(),
  unique (event_id, profile_id)
);

create index if not exists event_regs_event_idx on public.event_registrations (event_id, status);

-- ── الأخبار / المقالات ─────────────────────────────────────────────────────
create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  forum_id uuid references public.forums (id) on delete cascade,
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),

  title_ar text not null,
  title_en text,
  excerpt_ar text,
  excerpt_en text,
  body_ar text,
  body_en text,
  cover_url text,

  status public.publish_status not null default 'draft',
  published_at timestamptz,

  author_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists posts_status_published_idx on public.posts (status, published_at desc);
create index if not exists posts_forum_idx on public.posts (forum_id, published_at desc);

create or replace trigger posts_touch
  before update on public.posts
  for each row execute function public.touch_updated_at();

-- ── قائمة المتحمّسين (الصفحة التشويقية) ────────────────────────────────────
create table if not exists public.waitlist_subscribers (
  id uuid primary key default gen_random_uuid(),
  email citext not null unique,
  full_name text,
  source text not null default 'teaser',
  interests text[] not null default '{}',
  notified_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists waitlist_created_idx on public.waitlist_subscribers (created_at desc);

-- ── سجلّ التدقيق ───────────────────────────────────────────────────────────
create table if not exists public.audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles (id) on delete set null,
  action text not null,
  entity text not null,
  entity_id text,
  meta jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_created_idx on public.audit_log (created_at desc);
create index if not exists audit_entity_idx on public.audit_log (entity, entity_id);
