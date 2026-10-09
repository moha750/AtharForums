-- ════════════════════════════════════════════════════════════════════════════
-- اختبار حرّاس الباركود — داخل معاملة تُلغى في آخرها، فلا يبقى منه شيء.
--
-- التشغيل (على أي قاعدة طُبّق عليها 0019_qr.sql، بصلاحية postgres):
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/0019_qr_guards.sql
-- أو الصق الملف كاملًا في محرّر SQL لدى Supabase.
--
-- كل حالة تطبع PASS، وأوّل فشل يوقف الملف برسالة FAIL ويُلغي المعاملة.
-- ════════════════════════════════════════════════════════════════════════════

begin;

set local search_path = public, extensions;

-- Supabase يمنع الحذف المباشر من جداول المخزن إلا عبر واجهته (storage.protect_delete).
-- نرفع المنع داخل هذه المعاملة وحدها، فتختبر الحالات سياساتنا نحن لا ذلك المنع.
select set_config('storage.allow_delete_query', 'true', true);

-- ── أدوات ───────────────────────────────────────────────────────────────────

create function pg_temp.login(p uuid) returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claims',
    json_build_object('sub', p, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', p::text, true);
  execute 'set local role authenticated';
end $$;

create function pg_temp.logout() returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claims', '', true);
  perform set_config('request.jwt.claim.sub', '', true);
end $$;

create function pg_temp.expect_fail(label text, stmt text) returns void language plpgsql as $$
begin
  begin
    execute stmt;
  exception when others then
    raise notice 'PASS  %  ← %', label, sqlerrm;
    return;
  end;
  raise exception 'FAIL  % — نُفّذ ولم يُرفض', label;
end $$;

create function pg_temp.expect_rows(label text, stmt text, expected integer) returns void language plpgsql as $$
declare n integer;
begin
  execute stmt;
  get diagnostics n = row_count;
  if n <> expected then
    raise exception 'FAIL  % — المتوقَّع % صفّ، والفعلي %', label, expected, n;
  end if;
  raise notice 'PASS  %', label;
end $$;

create function pg_temp.expect(label text, ok boolean) returns void language plpgsql as $$
begin
  if ok is distinct from true then
    raise exception 'FAIL  %', label;
  end if;
  raise notice 'PASS  %', label;
end $$;

grant execute on all functions in schema pg_temp to authenticated;

-- ── المعطيات ────────────────────────────────────────────────────────────────
-- A مالك · B محرِّر · C قارئ · D بلا صلاحية · O مشرف · G حساب الجهة · E مولّد آخر

select pg_temp.logout();

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-0000000000a1', 'qr-test-a@hrsd.gov.sa'),
  ('00000000-0000-4000-8000-0000000000b2', 'qr-test-b@hrsd.gov.sa'),
  ('00000000-0000-4000-8000-0000000000c3', 'qr-test-c@hrsd.gov.sa'),
  ('00000000-0000-4000-8000-0000000000d4', 'qr-test-d@hrsd.gov.sa'),
  ('00000000-0000-4000-8000-0000000000e5', 'qr-test-o@hrsd.gov.sa'),
  ('00000000-0000-4000-8000-0000000000f6', 'qr-test-g@hrsd.gov.sa'),
  ('00000000-0000-4000-8000-0000000000a7', 'qr-test-e@hrsd.gov.sa');

-- إن كان للقاعدة حساب جهة فعليّ، نُخرجه داخل المعاملة حتى يكون G هو حساب الجهة
delete from public.profile_permissions where permission = 'qr_org_account';

insert into public.profile_permissions (profile_id, permission) values
  ('00000000-0000-4000-8000-0000000000a1', 'use_qr_generator'),
  ('00000000-0000-4000-8000-0000000000b2', 'use_qr_generator'),
  ('00000000-0000-4000-8000-0000000000c3', 'use_qr_generator'),
  ('00000000-0000-4000-8000-0000000000e5', 'oversee_qr'),
  ('00000000-0000-4000-8000-0000000000f6', 'use_qr_generator'),
  ('00000000-0000-4000-8000-0000000000f6', 'qr_org_account'),
  ('00000000-0000-4000-8000-0000000000a7', 'use_qr_generator');

insert into public.qr_server_key (id, secret) values (true, 'test-secret-0123456789-abcdefghijklmnop')
on conflict (id) do update set secret = excluded.secret;

update public.site_settings set qr_custom_codes = false where id;

-- ملفّان حقيقيان في مجلّد A، وملفّ في مجلّد B
insert into storage.objects (bucket_id, name) values
  ('qr-files', '00000000-0000-4000-8000-0000000000a1/11111111-1111-4111-8111-111111111111.png'),
  ('qr-files', '00000000-0000-4000-8000-0000000000a1/22222222-2222-4222-8222-222222222222.pdf'),
  ('qr-files', '00000000-0000-4000-8000-0000000000b2/33333333-3333-4333-8333-333333333333.webp');

-- ── A ينشئ ──────────────────────────────────────────────────────────────────

select pg_temp.login('00000000-0000-4000-8000-0000000000a1');

insert into public.qr_campaigns (id, name, owner_id) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'حملة أ', '00000000-0000-4000-8000-0000000000a1'),
  ('aaaaaaaa-0000-4000-8000-000000000002', 'حملة أ٢', '00000000-0000-4000-8000-0000000000a1');

insert into public.qr_links (id, code, title, kind, target_url, spec, owner_id, campaign_id) values
  ('bbbbbbbb-0000-4000-8000-000000000001', 'k7m2p9x', 'رابط أ', 'link', 'https://example.org/a',
   '{"text":"https://athar.test/q/k7m2p9x"}', '00000000-0000-4000-8000-0000000000a1',
   'aaaaaaaa-0000-4000-8000-000000000001');

select pg_temp.expect('المالك يرى باركوده',
  exists (select 1 from public.qr_links where id = 'bbbbbbbb-0000-4000-8000-000000000001'));

-- ١) مسار بلا ملف
select pg_temp.expect_fail('مسار بلا ملف في المخزن', $q$
  insert into public.qr_links (code, title, kind, target_url, file_path, spec, owner_id) values
  ('h4n8r2t', 'ملف', 'file', 'https://athar.test/q/h4n8r2t/view',
   '00000000-0000-4000-8000-0000000000a1/99999999-9999-4999-8999-999999999999.png',
   '{"text":"https://athar.test/q/h4n8r2t"}', '00000000-0000-4000-8000-0000000000a1')
$q$);

-- ٢) مسار لغير كاتبه
select pg_temp.expect_fail('مسار في مجلّد مستخدم آخر', $q$
  insert into public.qr_links (code, title, kind, target_url, file_path, spec, owner_id) values
  ('h4n8r2t', 'ملف', 'file', 'https://athar.test/q/h4n8r2t/view',
   '00000000-0000-4000-8000-0000000000b2/33333333-3333-4333-8333-333333333333.webp',
   '{"text":"https://athar.test/q/h4n8r2t"}', '00000000-0000-4000-8000-0000000000a1')
$q$);

-- ٣) وجهة ملف غير صفحتها: القاعدة تكتبها بنفسها، فما يُرسل غيرها لا يبقى
select pg_temp.expect_fail('ملف بنصّ لرمز آخر', $q$
  insert into public.qr_links (code, title, kind, target_url, file_path, spec, owner_id) values
  ('h4n8r2t', 'ملف', 'file', 'https://evil.example/q/h4n8r2t/view',
   '00000000-0000-4000-8000-0000000000a1/11111111-1111-4111-8111-111111111111.png',
   '{"text":"https://athar.test/q/zzzzzzz"}', '00000000-0000-4000-8000-0000000000a1')
$q$);

select pg_temp.expect_rows('ملف صحيح يُقبل', $q$
  insert into public.qr_links (id, code, title, kind, target_url, file_path, spec, owner_id) values
  ('bbbbbbbb-0000-4000-8000-000000000002', 'h4n8r2t', 'ملف أ', 'file', 'https://athar.test/q/h4n8r2t/view',
   '00000000-0000-4000-8000-0000000000a1/11111111-1111-4111-8111-111111111111.png',
   '{"text":"https://athar.test/q/h4n8r2t"}', '00000000-0000-4000-8000-0000000000a1')
$q$, 1);

select pg_temp.expect('وجهة الملف صفحة عرضه على مضيف الرابط القصير',
  (select target_url from public.qr_links where id = 'bbbbbbbb-0000-4000-8000-000000000002')
    = 'https://athar.test/q/h4n8r2t/view');

select pg_temp.expect_rows('تحويل وجهة ملف إلى مضيف آخر يُعاد إلى صفحته', $q$
  update public.qr_links set target_url = 'https://evil.example/q/h4n8r2t/view'
  where id = 'bbbbbbbb-0000-4000-8000-000000000002'
$q$, 1);
select pg_temp.expect('…وبقيت صفحة العرض',
  (select target_url from public.qr_links where id = 'bbbbbbbb-0000-4000-8000-000000000002')
    = 'https://athar.test/q/h4n8r2t/view');

select pg_temp.expect_fail('وجهة محلّية بكتابة مباشرة', $q$
  update public.qr_links set target_url = 'http://localhost:8080/x' where id = 'bbbbbbbb-0000-4000-8000-000000000001'
$q$);
select pg_temp.expect_fail('وجهة شبكة خاصّة بكتابة مباشرة', $q$
  update public.qr_links set target_url = 'http://192.168.1.5/admin' where id = 'bbbbbbbb-0000-4000-8000-000000000001'
$q$);
select pg_temp.expect_fail('وجهة دائرية إلى /q/ عندنا', $q$
  update public.qr_links set target_url = 'https://athar.test/q/h4n8r2t' where id = 'bbbbbbbb-0000-4000-8000-000000000001'
$q$);
select pg_temp.expect_fail('بيانات دخول داخل الوجهة', $q$
  update public.qr_links set target_url = 'https://bank.example@evil.example/' where id = 'bbbbbbbb-0000-4000-8000-000000000001'
$q$);

select pg_temp.expect_fail('رابط عادي لا يحمل مسار ملف', $q$
  update public.qr_links set file_path = '00000000-0000-4000-8000-0000000000a1/22222222-2222-4222-8222-222222222222.pdf'
  where id = 'bbbbbbbb-0000-4000-8000-000000000001'
$q$);

select pg_temp.expect_fail('نصّ الباركود هو الرابط القصير لرمزه', $q$
  insert into public.qr_links (code, title, kind, target_url, spec, owner_id) values
  ('t5y6u7i', 'نصّ آخر', 'link', 'https://example.org', '{"text":"https://evil.example/elsewhere"}',
   '00000000-0000-4000-8000-0000000000a1')
$q$);
select pg_temp.expect_rows('المالك نفسه لا يغيّر النصّ بعد الإنشاء', $q$
  update public.qr_links set spec = '{"text":"https://evil.example/q/k7m2p9x"}'
  where id = 'bbbbbbbb-0000-4000-8000-000000000001'
$q$, 1);
select pg_temp.expect('…فيبقى ما طُبع',
  (select spec ->> 'text' from public.qr_links where id = 'bbbbbbbb-0000-4000-8000-000000000001')
    = 'https://athar.test/q/k7m2p9x');

select pg_temp.expect_rows('تحديث updated_at يدويًّا', $q$
  update public.qr_links set updated_at = '2000-01-01' where id = 'bbbbbbbb-0000-4000-8000-000000000001'
$q$, 1);
select pg_temp.expect('…لكن القاعدة تختمه بالآن',
  (select updated_at > now() - interval '1 minute' from public.qr_links where id = 'bbbbbbbb-0000-4000-8000-000000000001'));

select pg_temp.expect_fail('الرمز لا يُعدَّل بعد الإنشاء', $q$
  update public.qr_links set code = 'zzzzzzz' where id = 'bbbbbbbb-0000-4000-8000-000000000001'
$q$);

select pg_temp.expect_fail('العدّاد لا يُعدَّل', $q$
  update public.qr_links set scan_count = 999 where id = 'bbbbbbbb-0000-4000-8000-000000000001'
$q$);

select pg_temp.expect_fail('الوجهة شكلها http(s) — شبكة الأمان الأخيرة', $q$
  update public.qr_links set target_url = 'javascript:alert(1)' where id = 'bbbbbbbb-0000-4000-8000-000000000001'
$q$);

select pg_temp.expect_fail('الرمز المختار مطفأ افتراضيًّا', $q$
  insert into public.qr_links (code, title, kind, target_url, spec, owner_id) values
  ('my-event', 'مختار', 'link', 'https://example.org', '{"text":"https://athar.test/q/my-event"}',
   '00000000-0000-4000-8000-0000000000a1')
$q$);

select pg_temp.logout();
update public.site_settings set qr_custom_codes = true where id;
select pg_temp.login('00000000-0000-4000-8000-0000000000a1');

select pg_temp.expect_rows('الرمز المختار يُقبل حين يُفعَّل', $q$
  insert into public.qr_links (code, title, kind, target_url, spec, owner_id) values
  ('my-event', 'مختار', 'link', 'https://example.org', '{"text":"https://athar.test/q/my-event"}',
   '00000000-0000-4000-8000-0000000000a1')
$q$, 1);

select pg_temp.expect_fail('الرمز المحجوز مرفوض', $q$
  insert into public.qr_links (code, title, kind, target_url, spec, owner_id) values
  ('admin', 'محجوز', 'link', 'https://example.org', '{"text":"https://athar.test/q/admin"}',
   '00000000-0000-4000-8000-0000000000a1')
$q$);

select pg_temp.expect_fail('الشرطة في طرف الرمز مرفوضة', $q$
  insert into public.qr_links (code, title, kind, target_url, spec, owner_id) values
  ('my-event-', 'طرف', 'link', 'https://example.org', '{"text":"https://athar.test/q/my-event-"}',
   '00000000-0000-4000-8000-0000000000a1')
$q$);

select pg_temp.expect_fail('الرمز المأخوذ مرفوض', $q$
  insert into public.qr_links (code, title, kind, target_url, spec, owner_id) values
  ('my-event', 'مكرّر', 'link', 'https://example.org', '{"text":"https://athar.test/q/my-event"}',
   '00000000-0000-4000-8000-0000000000a1')
$q$);

-- المشاركة: B محرِّر على الباركود، وC قارئ عبر الحملة
insert into public.qr_link_shares (link_id, user_id, access) values
  ('bbbbbbbb-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000000b2', 'edit');
insert into public.qr_campaign_shares (campaign_id, user_id, access) values
  ('aaaaaaaa-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000000c3', 'read');

select pg_temp.expect_fail('المشاركة مع من لا يحمل صلاحية المولّد', $q$
  insert into public.qr_link_shares (link_id, user_id, access) values
  ('bbbbbbbb-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000000d4', 'read')
$q$);

-- ── E: حملة لغير المالك ─────────────────────────────────────────────────────

select pg_temp.login('00000000-0000-4000-8000-0000000000a7');
insert into public.qr_campaigns (id, name, owner_id) values
  ('aaaaaaaa-0000-4000-8000-0000000000e1', 'حملة هـ', '00000000-0000-4000-8000-0000000000a7');

select pg_temp.expect_fail('حملة لغير مالك الباركود', $q$
  insert into public.qr_links (code, title, kind, target_url, spec, owner_id, campaign_id) values
  ('w3e5r7t', 'هـ', 'link', 'https://example.org', '{"text":"https://athar.test/q/w3e5r7t"}',
   '00000000-0000-4000-8000-0000000000a7', 'aaaaaaaa-0000-4000-8000-000000000001')
$q$);

select pg_temp.expect('غير المشارَك لا يرى الباركود',
  not exists (select 1 from public.qr_links where id = 'bbbbbbbb-0000-4000-8000-000000000001'));

select pg_temp.login('00000000-0000-4000-8000-0000000000a1');
select pg_temp.expect_fail('المالك لا يضمّ باركوده إلى حملة غيره', $q$
  update public.qr_links set campaign_id = 'aaaaaaaa-0000-4000-8000-0000000000e1'
  where id = 'bbbbbbbb-0000-4000-8000-000000000001'
$q$);

-- ── B المحرِّر ──────────────────────────────────────────────────────────────

select pg_temp.login('00000000-0000-4000-8000-0000000000b2');

select pg_temp.expect_rows('المحرِّر يبدّل الوجهة', $q$
  update public.qr_links set target_url = 'https://example.org/b'
  where id = 'bbbbbbbb-0000-4000-8000-000000000001'
$q$, 1);

-- نصّ الباركود المطبوع لا يُغيَّر ولو بنصّ يطابق الشكل
select pg_temp.expect_rows('المحرِّر يحفظ تصميمًا بنصّ مضيف آخر', $q$
  update public.qr_links set spec = '{"text":"https://evil.example/q/k7m2p9x","ecc":"H"}'
  where id = 'bbbbbbbb-0000-4000-8000-000000000001'
$q$, 1);
select pg_temp.expect('…فيُحفظ التصميم ويبقى النصّ كما طُبع',
  (select spec ->> 'text' = 'https://athar.test/q/k7m2p9x' and spec ->> 'ecc' = 'H'
   from public.qr_links where id = 'bbbbbbbb-0000-4000-8000-000000000001'));

select pg_temp.expect_fail('نافذة جدولة إلى وجهة محلّية', $q$
  insert into public.qr_schedules (link_id, target_url) values
  ('bbbbbbbb-0000-4000-8000-000000000001', 'http://localhost:8080/x')
$q$);

-- ٥) شريك ينقل بين الحملات
select pg_temp.expect_fail('المحرِّر ينقل بين الحملات', $q$
  update public.qr_links set campaign_id = 'aaaaaaaa-0000-4000-8000-000000000002'
  where id = 'bbbbbbbb-0000-4000-8000-000000000001'
$q$);

select pg_temp.expect_fail('المحرِّر يُخرج من الحملة', $q$
  update public.qr_links set campaign_id = null
  where id = 'bbbbbbbb-0000-4000-8000-000000000001'
$q$);

select pg_temp.expect_rows('المحرِّر لا يحذف', $q$
  delete from public.qr_links where id = 'bbbbbbbb-0000-4000-8000-000000000001'
$q$, 0);

select pg_temp.expect_fail('المحرِّر لا يشارك', $q$
  insert into public.qr_link_shares (link_id, user_id, access) values
  ('bbbbbbbb-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000000a7', 'read')
$q$);

select pg_temp.expect_rows('المحرِّر يضيف نافذة جدولة', $q$
  insert into public.qr_schedules (link_id, target_url, starts_at, ends_at, note) values
  ('bbbbbbbb-0000-4000-8000-000000000001', 'https://example.org/now',
   now() - interval '1 hour', now() + interval '1 hour', 'الآن')
$q$, 1);

select pg_temp.expect_fail('نهاية النافذة قبل بدايتها', $q$
  insert into public.qr_schedules (link_id, target_url, starts_at, ends_at) values
  ('bbbbbbbb-0000-4000-8000-000000000001', 'https://example.org/x', now(), now() - interval '1 hour')
$q$);

-- ── C القارئ (عبر الحملة) ───────────────────────────────────────────────────

select pg_temp.login('00000000-0000-4000-8000-0000000000c3');

select pg_temp.expect('مشاركة الحملة تُري باركوداتها',
  exists (select 1 from public.qr_links where id = 'bbbbbbbb-0000-4000-8000-000000000001'));
select pg_temp.expect('القارئ يرى الإحصاء',
  (public.qr_link_stats('bbbbbbbb-0000-4000-8000-000000000001') ->> 'total') is not null);
select pg_temp.expect_rows('القارئ لا يعدّل', $q$
  update public.qr_links set title = 'x' where id = 'bbbbbbbb-0000-4000-8000-000000000001'
$q$, 0);
select pg_temp.expect('القارئ لا يرى السجل',
  not exists (select 1 from public.qr_link_events where link_id = 'bbbbbbbb-0000-4000-8000-000000000001'));
select pg_temp.expect('فحص التوفّر يُرجع وجودًا فقط', public.qr_code_taken('K7M2P9X') = true);

-- ── D بلا صلاحية ───────────────────────────────────────────────────────────

select pg_temp.login('00000000-0000-4000-8000-0000000000d4');
select pg_temp.expect_fail('بلا صلاحية: لا إنشاء', $q$
  insert into public.qr_links (code, title, kind, target_url, spec, owner_id) values
  ('d4d4d4d', 'د', 'link', 'https://example.org', '{"text":"https://athar.test/q/d4d4d4d"}',
   '00000000-0000-4000-8000-0000000000d4')
$q$);
select pg_temp.expect_fail('بلا صلاحية: لا إشراف', $q$ select public.qr_oversee_links() $q$);
select pg_temp.expect_fail('بلا صلاحية: لا تذكرة رفع', $q$ select public.qr_issue_upload_ticket('image/png', 1000) $q$);
select pg_temp.expect_fail('بلا صلاحية: لا إحصاء', $q$
  select public.qr_link_stats('bbbbbbbb-0000-4000-8000-000000000001')
$q$);

-- ── المخزن ──────────────────────────────────────────────────────────────────

select pg_temp.login('00000000-0000-4000-8000-0000000000a1');

select pg_temp.expect_fail('رفع بلا تذكرة', $q$
  insert into storage.objects (bucket_id, name) values
  ('qr-files', '00000000-0000-4000-8000-0000000000a1/44444444-4444-4444-8444-444444444444.png')
$q$);

select pg_temp.expect_fail('تذكرة لنوع مرفوض', $q$ select public.qr_issue_upload_ticket('image/heic', 1000) $q$);
select pg_temp.expect_fail('صورة فوق ٤ ميغابايت', $q$ select public.qr_issue_upload_ticket('image/webp', 5000000) $q$);
select pg_temp.expect_fail('PDF فوق ١٠ ميغابايت', $q$ select public.qr_issue_upload_ticket('application/pdf', 11000000) $q$);

do $$
declare v_path text;
begin
  v_path := public.qr_issue_upload_ticket('application/pdf', 9000000);
  perform pg_temp.expect('المسار يُصكّ في مجلّد صاحبه',
    v_path ~ '^00000000-0000-4000-8000-0000000000a1/[0-9a-f-]{36}\.pdf$');
  insert into storage.objects (bucket_id, name) values ('qr-files', v_path);
  perform pg_temp.expect('الرفع بالتذكرة يُقبل',
    exists (select 1 from storage.objects where name = v_path));
end $$;

select pg_temp.expect_rows('لا يُمحى ملف يشير إليه صفّ', $q$
  delete from storage.objects
  where bucket_id = 'qr-files' and name = '00000000-0000-4000-8000-0000000000a1/11111111-1111-4111-8111-111111111111.png'
$q$, 0);

-- الاستبدال: الجديد أولًا، والقديم يصير قابلًا للمحو بعد قبول القاعدة
select pg_temp.expect_rows('استبدال الملف', $q$
  update public.qr_links
  set file_path = '00000000-0000-4000-8000-0000000000a1/22222222-2222-4222-8222-222222222222.pdf'
  where id = 'bbbbbbbb-0000-4000-8000-000000000002'
$q$, 1);
select pg_temp.expect_rows('القديم يُمحى بعد الاستبدال', $q$
  delete from storage.objects
  where bucket_id = 'qr-files' and name = '00000000-0000-4000-8000-0000000000a1/11111111-1111-4111-8111-111111111111.png'
$q$, 1);

-- ── باب المسح ──────────────────────────────────────────────────────────────

select pg_temp.logout();
set local role anon;

select pg_temp.expect_fail('باب المسح بلا سرّ', $q$
  select public.qr_resolve('wrong', 'k7m2p9x', null, null, 'mobile', false)
$q$);

select pg_temp.expect('النافذة الجارية تغلب الوجهة الأصلية',
  public.qr_resolve('test-secret-0123456789-abcdefghijklmnop', 'k7m2p9x',
    repeat('a', 64), 'wa.me', 'mobile', false) = 'https://example.org/now');
select pg_temp.expect('مسح البصمة نفسها خلال دقيقة يُحوَّل ولا يُسجَّل',
  public.qr_resolve('test-secret-0123456789-abcdefghijklmnop', 'k7m2p9x',
    repeat('a', 64), null, 'mobile', false) = 'https://example.org/now');
select public.qr_resolve('test-secret-0123456789-abcdefghijklmnop', 'k7m2p9x', null, null, 'unknown', true);
select pg_temp.expect('الرمز المجهول يُرجع null',
  public.qr_resolve('test-secret-0123456789-abcdefghijklmnop', 'nope123', null, null, 'mobile', false) is null);
select pg_temp.expect('صفحة العرض تجد ملف الرابط الفعّال',
  public.qr_file_of('h4n8r2t') like '%.pdf');
select pg_temp.expect('صفحة العرض لا تجد رابطًا عاديًّا', public.qr_file_of('k7m2p9x') is null);

reset role;
select pg_temp.expect('مسحان مسجّلان، والآلة لا تُعدّ',
  (select count(*) from public.qr_scans where link_id = 'bbbbbbbb-0000-4000-8000-000000000001') = 2
  and (select scan_count from public.qr_links where id = 'bbbbbbbb-0000-4000-8000-000000000001') = 1);
select pg_temp.expect('المُحيل اسم مضيف فقط والبصمة لا IP',
  exists (select 1 from public.qr_scans where referrer = 'wa.me' and visitor = repeat('a', 64)));

-- ── السجل والتنبيه ─────────────────────────────────────────────────────────

select pg_temp.expect('تبديل الوجهة سُجّل بفاعله',
  exists (select 1 from public.qr_link_events
          where link_id = 'bbbbbbbb-0000-4000-8000-000000000001' and kind = 'target'
            and actor_id = '00000000-0000-4000-8000-0000000000b2'
            and old_value = 'https://example.org/a' and new_value = 'https://example.org/b'));
select pg_temp.expect('وتبديل الوجهة كتب صفًّا في صندوق الصادر',
  exists (select 1 from public.qr_alert_outbox o join public.qr_link_events e on e.id = o.event_id
          where e.link_id = 'bbbbbbbb-0000-4000-8000-000000000001' and o.status = 'pending'));
select pg_temp.expect('ونافذة الجدولة نبّهت كذلك (تبديل وجهة)',
  exists (select 1 from public.qr_alert_outbox o join public.qr_link_events e on e.id = o.event_id
          where e.link_id = 'bbbbbbbb-0000-4000-8000-000000000001' and e.kind = 'schedule'));
select pg_temp.expect('والجدولة سُجّلت',
  exists (select 1 from public.qr_link_events
          where link_id = 'bbbbbbbb-0000-4000-8000-000000000001' and kind = 'schedule'));
select pg_temp.expect('واستبدال الملف سُجّل',
  exists (select 1 from public.qr_link_events
          where link_id = 'bbbbbbbb-0000-4000-8000-000000000002' and kind = 'file'));

select pg_temp.login('00000000-0000-4000-8000-0000000000b2');
select pg_temp.expect_fail('لا كتابة في السجل من المتصفّح', $q$
  insert into public.qr_link_events (link_id, kind) values ('bbbbbbbb-0000-4000-8000-000000000001', 'title')
$q$);
select pg_temp.expect_fail('لا إدراج مسحات مباشرة', $q$
  insert into public.qr_scans (link_id) values ('bbbbbbbb-0000-4000-8000-000000000001')
$q$);

-- ── نزع الصلاحية يقطع الوصول حتى للمالك ────────────────────────────────────

select pg_temp.logout();
delete from public.profile_permissions
where profile_id = '00000000-0000-4000-8000-0000000000a1' and permission = 'use_qr_generator';
select pg_temp.login('00000000-0000-4000-8000-0000000000a1');
select pg_temp.expect('بلا صلاحية لا يرى المالك صفّه',
  not exists (select 1 from public.qr_links where id = 'bbbbbbbb-0000-4000-8000-000000000001'));
select pg_temp.logout();
insert into public.profile_permissions (profile_id, permission)
values ('00000000-0000-4000-8000-0000000000a1', 'use_qr_generator');

-- ── الإشراف ────────────────────────────────────────────────────────────────

select pg_temp.login('00000000-0000-4000-8000-0000000000e5');
select pg_temp.expect('المشرف يرى كل الباركودات',
  (select count(*) from public.qr_oversee_links()) >= 2);
select pg_temp.expect_rows('المشرف لا يكتب مباشرة', $q$
  update public.qr_links set title = 'x' where id = 'bbbbbbbb-0000-4000-8000-000000000001'
$q$, 0);
select pg_temp.expect_fail('النقل لغير حامل المولّد', $q$
  select public.qr_oversee_transfer('bbbbbbbb-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000000d4')
$q$);
select public.qr_oversee_transfer('bbbbbbbb-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000000a7');
select pg_temp.expect('النقل يُخرج الباركود من حملته ويُسجَّل بالقيمتين',
  (select campaign_id is null and owner_id = '00000000-0000-4000-8000-0000000000a7'
   from public.qr_links where id = 'bbbbbbbb-0000-4000-8000-000000000001')
  and exists (select 1 from public.qr_link_events
              where link_id = 'bbbbbbbb-0000-4000-8000-000000000001' and kind = 'owner'
                and old_value = '00000000-0000-4000-8000-0000000000a1'
                and new_value = '00000000-0000-4000-8000-0000000000a7'));
select public.qr_oversee_set_active('bbbbbbbb-0000-4000-8000-000000000001', false);

select pg_temp.logout();
set local role anon;
select pg_temp.expect('الموقوف لا يُحوَّل إلى وجهته',
  public.qr_resolve('test-secret-0123456789-abcdefghijklmnop', 'k7m2p9x', null, null, 'mobile', false) is null);
reset role;

-- ── حذف الحملة يُخرج باركوداتها وتبقى تعمل ──────────────────────────────────

select pg_temp.login('00000000-0000-4000-8000-0000000000a1');
update public.qr_links set campaign_id = 'aaaaaaaa-0000-4000-8000-000000000002'
where id = 'bbbbbbbb-0000-4000-8000-000000000002';
delete from public.qr_campaigns where id = 'aaaaaaaa-0000-4000-8000-000000000002';
select pg_temp.expect('حذف الحملة أخرج الباركود وسجّل اسمها',
  (select campaign_id is null from public.qr_links where id = 'bbbbbbbb-0000-4000-8000-000000000002')
  and exists (select 1 from public.qr_link_events
              where link_id = 'bbbbbbbb-0000-4000-8000-000000000002' and kind = 'campaign'
                and old_value = 'حملة أ٢' and new_value is null));

-- ── حذف حساب: حملاته ثم باركوداته إلى حساب الجهة ──────────────────────────

select pg_temp.logout();
delete from auth.users where id = '00000000-0000-4000-8000-0000000000a1';
select pg_temp.expect('باركودات المحذوف وحملاته انتقلت إلى حساب الجهة',
  (select owner_id from public.qr_links where id = 'bbbbbbbb-0000-4000-8000-000000000002')
    = '00000000-0000-4000-8000-0000000000f6'
  and (select owner_id from public.qr_campaigns where id = 'aaaaaaaa-0000-4000-8000-000000000001')
    = '00000000-0000-4000-8000-0000000000f6');
select pg_temp.expect('ووقائع النقل في السجل',
  exists (select 1 from public.qr_link_events
          where link_id = 'bbbbbbbb-0000-4000-8000-000000000002' and kind = 'owner'
            and new_value = '00000000-0000-4000-8000-0000000000f6'));

-- ── الحذف النهائي يبقى في السجل ─────────────────────────────────────────────

select pg_temp.login('00000000-0000-4000-8000-0000000000f6');
delete from public.qr_links where id = 'bbbbbbbb-0000-4000-8000-000000000002';
select pg_temp.logout();
select pg_temp.expect('واقعة الحذف باقية بعد ذهاب الصفّ، والملف صار قابلًا للمحو',
  exists (select 1 from public.qr_link_events
          where link_id = 'bbbbbbbb-0000-4000-8000-000000000002' and kind = 'delete')
  and exists (select 1 from public.qr_file_trash
              where path = '00000000-0000-4000-8000-0000000000a1/22222222-2222-4222-8222-222222222222.pdf'));

select pg_temp.login('00000000-0000-4000-8000-0000000000b2');
select pg_temp.expect_fail('إعادة معرّف باركود محذوف لقراءة سجلّه', $q$
  insert into public.qr_links (id, code, title, kind, target_url, spec, owner_id) values
  ('bbbbbbbb-0000-4000-8000-000000000002', 'r3e4w5q', 'وريث', 'link', 'https://example.org',
   '{"text":"https://athar.test/q/r3e4w5q"}', '00000000-0000-4000-8000-0000000000b2')
$q$);
select pg_temp.expect('الاسم الفارغ لا يكشف البريد',
  not exists (select 1 from public.qr_share_candidates() where name like 'qr-test%'));
select pg_temp.logout();

do $$ begin raise notice 'كل الحالات نجحت — والمعاملة تُلغى الآن.'; end $$;

rollback;
