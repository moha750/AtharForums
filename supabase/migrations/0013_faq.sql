-- ════════════════════════════════════════════════════════════════════════════
-- مساحة أثر — الأسئلة الشائعة
--
-- تُدار من لوحة التحكم كالمساحات والبانرات: السؤال الذي يتكرّر من الموظّفين
-- يُضاف في دقيقة بلا إصدار ولا رفع.
--
-- is_featured يختار ما يظهر مختصرًا في صفحة «عن أثر»؛ والبقية في /faq.
--
-- البذرة أدناه on conflict do nothing لا do update: تشغيل الملفّ مرّة أخرى
-- لا يدهس تحريرًا كتبه المشرف بيده.
-- ════════════════════════════════════════════════════════════════════════════

create table if not exists public.faqs (
  id uuid primary key default gen_random_uuid(),

  -- مفتاح ثابت للبذرة وحدها؛ لا يظهر للزائر ولا يُستعمل في الروابط.
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),

  question_ar text not null,
  question_en text,
  answer_ar text not null,
  answer_en text,

  status public.publish_status not null default 'draft',
  is_featured boolean not null default false,
  sort_order integer not null default 100,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.faqs is 'الأسئلة الشائعة — تُدار من لوحة التحكم';
comment on column public.faqs.is_featured is
  'يظهر في المختصر داخل صفحة «عن أثر» إضافةً إلى صفحة الأسئلة';

create index if not exists faqs_live_idx
  on public.faqs (status, sort_order);

create or replace trigger faqs_touch
  before update on public.faqs
  for each row execute function public.touch_updated_at();

-- ── من يرى ومن يكتب ────────────────────────────────────────────────────────
alter table public.faqs enable row level security;

revoke all on public.faqs from anon, authenticated;
grant select on public.faqs to anon, authenticated;
grant insert, update, delete on public.faqs to authenticated;

drop policy if exists "faqs: public reads published" on public.faqs;
create policy "faqs: public reads published"
  on public.faqs for select
  to anon, authenticated
  using (status = 'published');

drop policy if exists "faqs: admins read all" on public.faqs;
create policy "faqs: admins read all"
  on public.faqs for select
  to authenticated
  using (public.is_admin());

drop policy if exists "faqs: admins insert" on public.faqs;
create policy "faqs: admins insert"
  on public.faqs for insert
  to authenticated
  with check (public.is_admin());

drop policy if exists "faqs: admins update" on public.faqs;
create policy "faqs: admins update"
  on public.faqs for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "faqs: admins delete" on public.faqs;
create policy "faqs: admins delete"
  on public.faqs for delete
  to authenticated
  using (public.is_admin());

-- ── البذرة ─────────────────────────────────────────────────────────────────
-- كل جواب هنا يصف ما تفعله المنصّة فعلًا، لا ما يُفترض أن تفعله. ما لم
-- يُتحقَّق منه في الكود لم يُكتب.
insert into public.faqs (slug, question_ar, question_en, answer_ar, answer_en,
                         status, is_featured, sort_order) values
  ('what-is-athar',
   'ما مساحة أثر؟',
   'What is Athar Space?',
   'مبادرة داخلية تجمع منسوبي وزارة الموارد البشرية والتنمية الاجتماعية حول ما يجيدونه وما يحبّونه. المساحات يقودها الموظّفون أنفسهم: يتعلّمون فيها، ويبنون، ويتركون أثرًا يتجاوز مكاتبهم.',
   'An internal initiative that brings colleagues at the Ministry of Human Resources and Social Development together around what they are good at and what they love. The spaces are led by employees themselves — to learn, to build, and to leave a mark beyond their desks.',
   'published', true, 10),

  ('spaces-available',
   'ما المساحات المتاحة؟',
   'Which spaces are available?',
   'ثلاث: «مساحات تطويرية» للمهارات المهنية والتقنية، و«مساحات اجتماعية وترفيهية» للقاء خارج قاعات الاجتماعات، و«مساحات ثقافية وإبداعية» للقراءة والكتابة والفنون.',
   'Three: Development Spaces for professional and technical skills, Social & Recreational Spaces for meeting outside the meeting rooms, and Cultural & Creative Spaces for reading, writing and the arts.',
   'published', false, 20),

  ('who-can-join',
   'من يستطيع الانضمام؟',
   'Who can join?',
   'منسوبو الوزارة ممّن لديهم بريد رسمي على نطاق hrsd.gov.sa. البريد الشخصي لا يُقبل عند التسجيل.',
   'Ministry colleagues with an official hrsd.gov.sa email address. Personal email addresses are not accepted at sign-up.',
   'published', true, 30),

  ('how-to-login',
   'كيف أسجّل الدخول؟ لا أذكر كلمة مرور.',
   'How do I sign in? I do not remember a password.',
   'لا كلمة مرور أصلًا. اكتب بريدك الرسمي في صفحة الدخول فيصلك رابط صالح لساعة واحدة، تضغطه فتدخل. إن لم يصلك، تفقّد مجلّد البريد غير المرغوب.',
   'There is no password. Enter your official email on the sign-in page and you will receive a link valid for one hour; click it and you are in. If nothing arrives, check your spam folder.',
   'published', true, 40),

  ('how-to-join-space',
   'كيف أنضمّ إلى مساحة؟',
   'How do I join a space?',
   'افتح صفحة المساحة واضغط «انضم»، ثمّ اكتب سبب رغبتك في الانضمام (عشرة أحرف فأكثر) ومهاراتك إن أردت. يصل الطلب إلى قائد المساحة ويبقى «قيد المراجعة» حتى يُقبل أو يُعتذر عنه.',
   'Open the space page and press Join, then write why you want to join (at least ten characters) and your skills if you like. The request reaches the space lead and stays pending until it is accepted or declined.',
   'published', true, 50),

  ('multiple-spaces',
   'هل أنضمّ إلى أكثر من مساحة؟',
   'Can I join more than one space?',
   'نعم، ولا حدّ لعددها. لكلّ مساحة طلب مستقلّ.',
   'Yes, with no limit. Each space has its own separate request.',
   'published', false, 60),

  ('reapply',
   'اعتُذر عن طلبي — هل أعيد التقديم؟',
   'My request was declined — can I apply again?',
   'نعم. التقديم مرّة أخرى يفتح طلبك نفسه من جديد بسببٍ محدَّث، ولا يُنشئ طلبًا مكرّرًا.',
   'Yes. Applying again reopens your existing request with an updated reason; it does not create a duplicate.',
   'published', false, 70),

  ('space-full',
   'ماذا لو اكتمل عدد المساحة؟',
   'What if a space is full?',
   'لكلّ مساحة طاقة استيعابية، وعند بلوغها لا يستطيع القائد قبول طلبات جديدة حتى يشغر مكان. طلبك يبقى قائمًا في الانتظار.',
   'Each space has a capacity. Once it is reached the lead cannot accept new requests until a place frees up. Your request stays pending.',
   'published', false, 80),

  ('events',
   'كيف أسجّل في فعالية؟',
   'How do I register for an event?',
   'من صفحة الفعالية بضغطة واحدة بعد تسجيل الدخول، ويمكنك إلغاء تسجيلك من الصفحة نفسها متى شئت.',
   'From the event page with one click once you are signed in. You can cancel your registration from the same page at any time.',
   'published', false, 90),

  ('lead',
   'من يقود المساحة؟',
   'Who leads a space?',
   'موظّف من منسوبي الفرع. القائد يراجع طلبات الانضمام، وينشر فعاليات مساحته وأخبارها.',
   'An employee from the branch. The lead reviews join requests and publishes the space''s events and news.',
   'published', false, 100),

  ('privacy',
   'ما البيانات التي تُجمع عنّي؟',
   'What data is collected about me?',
   'إحصاءات الزيارة تُسجَّل بلا أي كوكيز تتبّع. وعنوان الإنترنت لا يُخزَّن أصلًا: يُحوَّل إلى بصمة لا يمكن عكسها، بملحٍ يتبدّل كل شهر فتنقطع الصلة بين زياراتك من شهر إلى آخر. وما تكتبه في طلب الانضمام يراه قائد المساحة والمشرفون فقط.',
   'Visit analytics are recorded with no tracking cookies at all. Your IP address is never stored: it is turned into a fingerprint that cannot be reversed, with a salt that changes every month so visits cannot be linked across months. What you write in a join request is seen only by the space lead and the administrators.',
   'published', true, 110),

  ('languages',
   'هل الموقع بالعربية والإنجليزية؟',
   'Is the site available in Arabic and English?',
   'نعم، وتبدّل اللغة من أعلى الصفحة.',
   'Yes — switch languages from the top of the page.',
   'published', false, 120)
on conflict (slug) do nothing;

select count(*) filter (where status = 'published') as published,
       count(*) filter (where is_featured) as featured,
       count(*) as total
from public.faqs;
