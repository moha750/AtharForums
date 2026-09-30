-- ════════════════════════════════════════════════════════════════════════════
-- مساحة أثر — رسائل «تواصل معنا»
--
-- كان «تواصل معنا» رابط mailto: يفتح برنامج البريد عند الزائر — إن كان عنده
-- برنامج مضبوط أصلًا — والرسالة تذهب إلى صندوق شخص واحد لا يراه بقيّة
-- الفريق، ولا يُعرف أيّها رُدّ عليه. صار نموذجًا تصل رسائله إلى لوحة التحكم.
--
-- الكتابة عبر دالّة فقط: لا صلاحية insert على الجدول لأحد. الدالّة تتحقّق
-- وتحدّ المعدّل، والجدول لا يقرؤه إلا المشرفون.
-- ════════════════════════════════════════════════════════════════════════════

do $$ begin
  create type public.contact_topic as enum ('inquiry', 'suggestion', 'technical', 'other');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.contact_status as enum ('new', 'read', 'archived');
exception when duplicate_object then null; end $$;

create table if not exists public.contact_messages (
  id uuid primary key default gen_random_uuid(),

  -- المرسل المسجَّل دخوله يُربط بحسابه، وبريده يُؤخذ من الحساب لا من النموذج.
  -- الزائر بلا حساب يبقى profile_id عنده فارغًا.
  profile_id uuid references public.profiles (id) on delete set null,
  full_name text not null,
  email citext not null,

  topic public.contact_topic not null default 'inquiry',
  body text not null,
  locale text not null default 'ar',

  status public.contact_status not null default 'new',
  handled_by uuid references public.profiles (id) on delete set null,
  handled_at timestamptz,

  created_at timestamptz not null default now(),

  constraint contact_name_len check (char_length(full_name) between 2 and 120),
  -- شكل صارم عمدًا: البريد يدخل رابط mailto: في زرّ الردّ، فلا يُقبل فيه ? ولا &
  -- ولا ما يضيف مستلمًا خفيًّا أو يغيّر العنوان.
  constraint contact_email_shape
    check (char_length(email) <= 254
           and email ~ '^[a-z0-9._+''-]+@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$'),
  constraint contact_body_len check (char_length(body) between 10 and 4000),
  constraint contact_locale check (locale in ('ar', 'en'))
);

comment on table public.contact_messages is
  'رسائل نموذج «تواصل معنا» — تُقرأ وتُدار من لوحة التحكم';

create index if not exists contact_inbox_idx
  on public.contact_messages (status, created_at desc);

-- لحدّ المعدّل: كم رسالة أرسل هذا البريد في الساعة الأخيرة
create index if not exists contact_sender_recent_idx
  on public.contact_messages (email, created_at desc);

-- ── من غيّر الحالة ومتى — يُختم من القاعدة لا من التطبيق ──────────────────
create or replace function public.contact_messages_stamp()
returns trigger language plpgsql
set search_path = pg_catalog, public, pg_temp as $$
begin
  if new.status is distinct from old.status then
    new.handled_by := auth.uid();
    new.handled_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists contact_messages_stamp on public.contact_messages;
create trigger contact_messages_stamp
  before update on public.contact_messages
  for each row execute function public.contact_messages_stamp();

-- ── من يرى ومن يكتب ────────────────────────────────────────────────────────
alter table public.contact_messages enable row level security;

revoke all on public.contact_messages from anon, authenticated;
grant select, delete on public.contact_messages to authenticated;
-- الحالة وحدها قابلة للتعديل: نصّ الرسالة ومرسلها لا يُحرَّران بعد وصولها
grant update (status) on public.contact_messages to authenticated;

drop policy if exists "contact: admins read" on public.contact_messages;
create policy "contact: admins read"
  on public.contact_messages for select
  to authenticated
  using (public.is_admin());

drop policy if exists "contact: admins update" on public.contact_messages;
create policy "contact: admins update"
  on public.contact_messages for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "contact: admins delete" on public.contact_messages;
create policy "contact: admins delete"
  on public.contact_messages for delete
  to authenticated
  using (public.is_admin());

-- ── الإرسال ────────────────────────────────────────────────────────────────
-- رموز الأخطاء يقرؤها التطبيق ليردّ برسالة بلغة الواجهة:
--   22023 مدخل غير صالح · 42501 الموقع لم يُدشَّن بعد · 54000 تجاوز المعدّل
create or replace function public.submit_contact_message(
  sender_name text,
  sender_email text,
  message_topic text,
  message_body text,
  message_locale text default 'ar'
)
returns void language plpgsql security definer
set search_path = pg_catalog, public, pg_temp as $$
declare
  v_uid uuid := auth.uid();
  v_profile_email citext;
  v_profile_name text;
  v_email citext;
  v_name text;
  v_body text := btrim(coalesce(message_body, ''));
  v_topic text := coalesce(nullif(btrim(message_topic), ''), 'inquiry');
begin
  -- قبل التدشين لا يصل النموذجَ إلا المشرفون، فلا يُقبل من غيرهم نداءٌ مباشر
  if not (public.site_is_public() or public.is_admin()) then
    raise exception 'الموقع لم يُدشَّن بعد.' using errcode = '42501';
  end if;

  if v_uid is not null then
    select email, coalesce(nullif(full_name_ar, ''), nullif(full_name_en, ''))
      into v_profile_email, v_profile_name
    from public.profiles where id = v_uid;
  end if;

  -- المسجَّل: البريد من حسابه — لا يرسل أحدٌ باسم بريد غيره
  v_email := lower(btrim(coalesce(v_profile_email::text, sender_email, '')));
  v_name := coalesce(nullif(btrim(coalesce(sender_name, '')), ''), v_profile_name);

  if v_email !~ '^[a-z0-9._+''-]+@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$' or char_length(v_email) > 254 then
    raise exception 'email' using errcode = '22023';
  end if;
  if v_name is null or char_length(v_name) not between 2 and 120 then
    raise exception 'name' using errcode = '22023';
  end if;
  if char_length(v_body) not between 10 and 4000 then
    raise exception 'body' using errcode = '22023';
  end if;
  if not (v_topic = any (enum_range(null::public.contact_topic)::text[])) then
    raise exception 'topic' using errcode = '22023';
  end if;

  -- حدّ المعدّل: ثلاث رسائل للبريد الواحد في الساعة، وسقف عامّ يمنع إغراق
  -- الوارد إن تبدّلت البُرد. الرقم الثاني فوق ما تحتاجه مبادرة داخلية بكثير.
  if (select count(*) from public.contact_messages
      where email = v_email and created_at > now() - interval '1 hour') >= 3
  then
    raise exception 'rate' using errcode = '54000';
  end if;
  if (select count(*) from public.contact_messages
      where created_at > now() - interval '10 minutes') >= 30
  then
    raise exception 'rate' using errcode = '54000';
  end if;

  insert into public.contact_messages (profile_id, full_name, email, topic, body, locale)
  values (
    v_uid,
    v_name,
    v_email,
    v_topic::public.contact_topic,
    v_body,
    case when message_locale = 'en' then 'en' else 'ar' end
  );
end;
$$;

revoke all on function public.submit_contact_message(text, text, text, text, text) from public;
grant execute on function public.submit_contact_message(text, text, text, text, text)
  to anon, authenticated;

-- ── أثر في السجلّ: الحذف لا رجعة فيه، فيُعرف من حذف ماذا ──────────────────
create or replace function public.audit_contact_delete()
returns trigger language plpgsql security definer
set search_path = pg_catalog, public, pg_temp as $$
begin
  insert into public.audit_log (actor_id, action, entity, entity_id, meta)
  values (
    auth.uid(),
    'contact.delete',
    'contact_messages',
    old.id::text,
    jsonb_build_object('email', old.email, 'topic', old.topic, 'created_at', old.created_at)
  );
  return old;
end;
$$;

drop trigger if exists contact_messages_audit on public.contact_messages;
create trigger contact_messages_audit
  after delete on public.contact_messages
  for each row execute function public.audit_contact_delete();

-- ── بريد التواصل ───────────────────────────────────────────────────────────
-- يظهر سطرًا صغيرًا تحت النموذج لمن يفضّل البريد، وفي بطاقة «لم تجد سؤالك؟».
-- يُعدَّل بعد ذلك من لوحة التحكم ← الإعدادات.
update public.site_settings set contact_email = 'ialmatar@hrsd.gov.sa' where id;

select 'contact_messages' as table_created,
       (select count(*) from pg_policies where tablename = 'contact_messages') as policies,
       (select contact_email from public.site_settings where id) as contact;
