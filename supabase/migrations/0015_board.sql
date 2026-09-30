-- ════════════════════════════════════════════════════════════════════════════
-- مساحة أثر — مجلس الإدارة
--
-- هيكل المجلس كما يظهر في صفحة «عن أثر»، ومختصره في الصفحة الرئيسة. يُدار
-- من لوحة التحكم كالبانرات والأسئلة: عضو ينضمّ أو يتبدّل منصبه يُحدَّث في
-- دقيقة بلا إصدار ولا رفع.
--
-- الجدول قائم بذاته لا مربوط بـ profiles: عضو المجلس قد لا يملك حسابًا في
-- المنصّة، وربطه به يعني أن تمرّ صورته واسمه العامّان عبر جدولٍ الزائرُ
-- المجهول لا يملك صلاحية عليه أصلًا (القاعدة ٣ في README).
--
-- tier هو موضع العضو في الهيكل: ١ رأسه، وما تحته أدنى منه. الأعضاء في
-- المستوى الواحد يظهرون في صفّ واحد، وsort_order يرتّبهم داخله.
--
-- لا صفوف تُزرع هنا: أسماء الناس وصورهم لا تُخترع. الجدول يُنشأ فارغًا
-- ويُملأ من اللوحة.
-- ════════════════════════════════════════════════════════════════════════════

create table if not exists public.board_members (
  id uuid primary key default gen_random_uuid(),

  name_ar text not null,
  name_en text,

  -- المنصب في المجلس: «رئيس المجلس»، «نائب الرئيس»…
  position_ar text not null,
  position_en text,

  -- الدور في المبادرة بجملة قصيرة — ما يتولّاه فعلًا لا لقبه.
  role_ar text,
  role_en text,

  -- رابط عامّ في دلو media. اختياريّ: العضو يُضاف قبل أن تجهز صورته، ويظهر
  -- مكانها الحرف الأوّل من اسمه.
  photo_url text,

  tier smallint not null default 2,
  sort_order integer not null default 100,
  is_featured boolean not null default false,
  status public.publish_status not null default 'draft',

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint board_members_tier_range check (tier between 1 and 5),
  constraint board_members_photo_shape
    check (photo_url is null or photo_url ~ '^https://[^[:space:]]+$')
);

comment on table public.board_members is
  'مجلس إدارة مساحة أثر — يُدار من لوحة التحكم';
comment on column public.board_members.tier is
  'الموضع في الهيكل: ١ رأسه. أعضاء المستوى الواحد في صفّ واحد';
comment on column public.board_members.is_featured is
  'يظهر في مختصر المجلس بالصفحة الرئيسة إضافةً إلى صفحة «عن أثر»';

create index if not exists board_members_live_idx
  on public.board_members (status, tier, sort_order);

create or replace trigger board_members_touch
  before update on public.board_members
  for each row execute function public.touch_updated_at();

-- ── من يرى ومن يكتب ────────────────────────────────────────────────────────
alter table public.board_members enable row level security;

revoke all on public.board_members from anon, authenticated;
grant select on public.board_members to anon, authenticated;
grant insert, update, delete on public.board_members to authenticated;

drop policy if exists "board: public reads published" on public.board_members;
create policy "board: public reads published"
  on public.board_members for select
  to anon, authenticated
  using (status = 'published');

drop policy if exists "board: admins read all" on public.board_members;
create policy "board: admins read all"
  on public.board_members for select
  to authenticated
  using (public.is_admin());

drop policy if exists "board: admins insert" on public.board_members;
create policy "board: admins insert"
  on public.board_members for insert
  to authenticated
  with check (public.is_admin());

drop policy if exists "board: admins update" on public.board_members;
create policy "board: admins update"
  on public.board_members for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "board: admins delete" on public.board_members;
create policy "board: admins delete"
  on public.board_members for delete
  to authenticated
  using (public.is_admin());

-- ── أثر في السجلّ ──────────────────────────────────────────────────────────
-- اسم شخص وصورته ومنصبه على صفحة عامّة: يستحقّ أن يُعرف من غيّرها ومتى.
create or replace function public.audit_board_change()
returns trigger language plpgsql security definer
set search_path = pg_catalog, public, pg_temp as $$
declare
  rec public.board_members;
begin
  -- new غير مُسنَد في محفّز DELETE (انظر audit_banner_change في 0011).
  if tg_op = 'DELETE' then
    rec := old;
  else
    rec := new;
  end if;

  insert into public.audit_log (actor_id, action, entity, entity_id, meta)
  values (
    auth.uid(),
    'board.' || lower(tg_op),
    'board_members',
    rec.id::text,
    jsonb_build_object(
      'name', rec.name_ar,
      'position', rec.position_ar,
      'tier', rec.tier,
      'status', rec.status
    )
  );
  return rec;
end;
$$;

revoke all on function public.audit_board_change() from public, anon, authenticated;

drop trigger if exists board_members_audit on public.board_members;
create trigger board_members_audit
  after insert or update or delete on public.board_members
  for each row execute function public.audit_board_change();

select 'board_members' as table_created,
       (select count(*) from pg_policies where tablename = 'board_members') as policies,
       (select relrowsecurity from pg_class where oid = 'public.board_members'::regclass) as rls;
