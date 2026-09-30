-- ════════════════════════════════════════════════════════════════════════════
-- مساحة أثر — مناصب المجلس الثلاثة
--
-- 0015 جعل الهيكل مستوياتٍ حرّة (tier من ١ إلى ٥) لأنّ شكل المجلس لم يكن
-- معروفًا. وقد عُرف، وهو ثلاثة مناصب ثابتة:
--
--   ١. المدير العام لفرع الوزارة بالمنطقة الشرقية — واحد
--   ٢. رئيس مجلس إدارة مساحة أثر                 — واحد
--   ٣. عضو إداري                                  — عدد مفتوح
--
-- فالمستوى صار منصبًا (rank)، و«واحد» صار قيدًا في القاعدة لا تعليمات في
-- الواجهة: فهرس فريد جزئيّ يمنع نشر مديرَين عامَّين أو رئيسَين معًا. والقيد
-- على المنشور وحده، فتُحضَّر بطاقة الخلف مسوّدةً قبل تسليم المنصب.
--
-- ونصّ المنصب صار اختياريًّا: فارغًا يظهر المسمّى المعتمد من نصوص الواجهة
-- (بالعربية والإنجليزية)، ومكتوبًا يحلّ محلّه — لصيغة المؤنّث مثلًا
-- («عضوة إداريّة»، «رئيسة مجلس الإدارة») دون منصب رابع.
-- ════════════════════════════════════════════════════════════════════════════

do $$ begin
  create type public.board_rank as enum ('general_manager', 'chair', 'member');
exception when duplicate_object then null; end $$;

comment on type public.board_rank is
  'مناصب مجلس مساحة أثر مرتّبةً من الأعلى — ترتيب القيم هو ترتيب العرض';

alter table public.board_members
  add column if not exists rank public.board_rank not null default 'member';

-- تحويل المستويات إلى مناصب إن وُجدت صفوف (الجدول فارغ في الإنتاج عند
-- كتابة هذا الملف، والتحويل للاحتياط). ومشروط بوجود العمود ليبقى الملفّ
-- آمنًا للتكرار بعد حذفه.
do $$ begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'board_members'
               and column_name = 'tier') then
    execute $q$
      update public.board_members set rank = case tier
        when 1 then 'general_manager'::public.board_rank
        when 2 then 'chair'::public.board_rank
        else 'member'::public.board_rank
      end
    $q$;
  end if;
end $$;

-- المسمّى صار اختياريًّا: فارغًا يُعرض المعتمد للمنصب.
alter table public.board_members alter column position_ar drop not null;

comment on column public.board_members.rank is
  'المنصب: المدير العام وأعلى، ثم رئيس المجلس، ثم الأعضاء الإداريّون';
comment on column public.board_members.position_ar is
  'اختياريّ — فارغًا يظهر المسمّى المعتمد للمنصب؛ مكتوبًا يحلّ محلّه';

-- ── منصب واحد للمدير العام وللرئيس ─────────────────────────────────────────
create unique index if not exists board_members_single_rank
  on public.board_members (rank)
  where status = 'published' and rank in ('general_manager', 'chair');

-- ── سجلّ التدقيق يقرأ rank ─────────────────────────────────────────────────
-- يُستبدل قبل حذف tier: الدالّة القديمة تقرأ rec.tier، وplpgsql لا يفحص
-- ذلك إلا عند التنفيذ — فكان أوّل تعديل بعد الحذف سيفشل.
create or replace function public.audit_board_change()
returns trigger language plpgsql security definer
set search_path = pg_catalog, public, pg_temp as $$
declare
  rec public.board_members;
begin
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
      'rank', rec.rank,
      'position', rec.position_ar,
      'status', rec.status
    )
  );
  return rec;
end;
$$;

revoke all on function public.audit_board_change() from public, anon, authenticated;

-- ── حذف المستويات ──────────────────────────────────────────────────────────
drop index if exists public.board_members_live_idx;
alter table public.board_members drop constraint if exists board_members_tier_range;
alter table public.board_members drop column if exists tier;

create index if not exists board_members_live_idx
  on public.board_members (status, rank, sort_order);

select
  (select count(*) from public.board_members) as rows,
  (select count(*) from information_schema.columns
    where table_name = 'board_members' and column_name = 'tier') as tier_left,
  (select is_nullable from information_schema.columns
    where table_name = 'board_members' and column_name = 'position_ar') as position_nullable,
  (select count(*) from pg_indexes where indexname = 'board_members_single_rank') as single_rank_index;
