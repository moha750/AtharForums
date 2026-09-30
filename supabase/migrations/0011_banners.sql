-- ════════════════════════════════════════════════════════════════════════════
-- مساحة أثر — بانرات الصور والإعلانات
--
-- شريط يظهر في الصفحة الرئيسة بعد الهيرو، تديره لوحة التحكم. كل بانر صورة
-- خلفية وعنوان ونصّ قصير وزرّ اختياري، وله نافذة زمنية يظهر فيها ثمّ يختفي
-- وحده — فلا يبقى إعلان فعاليةٍ منتهية معلّقًا لأنّ أحدًا نسي إطفاءه.
--
-- الكتابة للمشرفين وحدهم: البانر يظهر لكل زائر في أبرز موضع بالموقع، فلا
-- يُفتح لقادة المساحات كما تُفتح أخبار مساحاتهم.
--
-- لا صفوف تُزرع هنا. الجدول يُنشأ فارغًا ويُملأ من اللوحة.
-- ════════════════════════════════════════════════════════════════════════════

create table if not exists public.banners (
  id uuid primary key default gen_random_uuid(),

  -- الصورة خلفية، والنصّ فوقها عنصر منفصل: نصٌّ داخل الصورة لا يقرؤه قارئ
  -- الشاشة ولا محرّك البحث، ولا يتكيّف مع عرض الجوّال.
  image_url text not null,
  image_alt_ar text,
  image_alt_en text,

  title_ar text not null,
  title_en text,
  body_ar text,
  body_en text,

  -- الزرّ اختياري، لكنّه إن وُجد فبنصّه ورابطه معًا (انظر banners_cta_pair).
  -- الرابط داخليّ يبدأ بـ / أو خارجيّ http(s) — لا javascript: ولا data:.
  cta_label_ar text,
  cta_label_en text,
  cta_href text,

  status public.publish_status not null default 'draft',
  starts_at timestamptz,
  ends_at timestamptz,
  sort_order integer not null default 100,

  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint banners_cta_href_shape
    check (cta_href is null or cta_href ~ '^(https?://|/)[^[:space:]]*$'),
  constraint banners_cta_pair
    check ((cta_href is null) = (cta_label_ar is null)),
  constraint banners_window
    check (starts_at is null or ends_at is null or ends_at > starts_at)
);

comment on table public.banners is
  'بانرات الصفحة الرئيسة — صور وإعلانات تُدار من لوحة التحكم';
comment on column public.banners.sort_order is
  'ترتيب الظهور داخل الشريط المتبدّل — الأصغر أوّلًا';

create index if not exists banners_live_idx
  on public.banners (status, sort_order, starts_at, ends_at);

create or replace trigger banners_touch
  before update on public.banners
  for each row execute function public.touch_updated_at();

-- ── من يرى ومن يكتب ────────────────────────────────────────────────────────
alter table public.banners enable row level security;

revoke all on public.banners from anon, authenticated;
grant select on public.banners to anon, authenticated;
grant insert, update, delete on public.banners to authenticated;

-- الزائر لا يرى إلا المنشور داخل نافذته الزمنية. الشرط في السياسة لا في
-- الاستعلام وحده: لو أخطأ استعلامٌ يومًا ما، تبقى المسوّدة محجوبة.
drop policy if exists "banners: public reads live" on public.banners;
create policy "banners: public reads live"
  on public.banners for select
  to anon, authenticated
  using (
    status = 'published'
    and (starts_at is null or starts_at <= now())
    and (ends_at is null or ends_at > now())
  );

drop policy if exists "banners: admins read all" on public.banners;
create policy "banners: admins read all"
  on public.banners for select
  to authenticated
  using (public.is_admin());

drop policy if exists "banners: admins insert" on public.banners;
create policy "banners: admins insert"
  on public.banners for insert
  to authenticated
  with check (public.is_admin());

drop policy if exists "banners: admins update" on public.banners;
create policy "banners: admins update"
  on public.banners for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "banners: admins delete" on public.banners;
create policy "banners: admins delete"
  on public.banners for delete
  to authenticated
  using (public.is_admin());

-- ── أثر في السجلّ ──────────────────────────────────────────────────────────
-- ما يُعرض على كل زائر في أبرز موضع يستحقّ أن يُعرف من نشره ومتى.
create or replace function public.audit_banner_change()
returns trigger language plpgsql security definer
set search_path = pg_catalog, public, pg_temp as $$
declare
  rec public.banners;
begin
  -- في محفّز DELETE يكون new غير مُسنَد، ولمس new.id يرفع خطأ وقت التشغيل —
  -- لا يظهر إلا عند أوّل حذف فعليّ. لذلك نختار السجلّ صراحةً بـ tg_op.
  if tg_op = 'DELETE' then
    rec := old;
  else
    rec := new;
  end if;

  insert into public.audit_log (actor_id, action, entity, entity_id, meta)
  values (
    auth.uid(),
    'banner.' || lower(tg_op),
    'banners',
    rec.id::text,
    jsonb_build_object(
      'title', rec.title_ar,
      'status', rec.status,
      'starts_at', rec.starts_at,
      'ends_at', rec.ends_at
    )
  );
  return rec;
end;
$$;

drop trigger if exists banners_audit on public.banners;
create trigger banners_audit
  after insert or update or delete on public.banners
  for each row execute function public.audit_banner_change();

select 'banners' as table_created,
       (select count(*) from pg_policies where tablename = 'banners') as policies;
