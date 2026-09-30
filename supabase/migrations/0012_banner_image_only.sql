-- ════════════════════════════════════════════════════════════════════════════
-- مساحة أثر — البانر بصورة وحدها
--
-- كان العنوان إلزاميًّا، وهذا يفترض أنّ كل بانر يحمل نصًّا فوق صورته. لكنّ
-- المصمّم قد يضع التصميم كلّه داخل الصورة ولا يريد طبقة نصّ أصلًا — فالعنوان
-- يصير حشوًا يُكتب ليُرضي حقلًا لا ليُقرأ.
--
-- والقيد على الزرّ يُخفَّف معه: كان يشترط النصّ والرابط معًا أو لا شيء، فصار
-- الرابط وحده جائزًا — عندها يصير البانر كلّه قابلًا للنقر بلا زرّ ظاهر،
-- وهو ما يحتاجه إعلانٌ تصميمه كامل داخل الصورة. والعكس يبقى ممنوعًا: نصّ
-- زرٍّ بلا رابط زرٌّ لا يؤدّي إلى شيء.
-- ════════════════════════════════════════════════════════════════════════════

alter table public.banners alter column title_ar drop not null;

-- drop قبل add ليبقى الملفّ آمنًا للتكرار
alter table public.banners drop constraint if exists banners_cta_pair;
alter table public.banners drop constraint if exists banners_cta_label_needs_href;
alter table public.banners add constraint banners_cta_label_needs_href
  check (cta_label_ar is null or cta_href is not null);

comment on column public.banners.title_ar is
  'اختياريّ — يُترك فارغًا للبانر الذي تصميمه كلّه داخل الصورة';

select
  (select is_nullable from information_schema.columns
    where table_name = 'banners' and column_name = 'title_ar') as title_nullable,
  (select count(*) from pg_constraint
    where conrelid = 'public.banners'::regclass and conname = 'banners_cta_pair') as old_constraint,
  (select count(*) from pg_constraint
    where conrelid = 'public.banners'::regclass and conname = 'banners_cta_label_needs_href') as new_constraint;
