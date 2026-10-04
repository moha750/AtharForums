-- ════════════════════════════════════════════════════════════════════════════
-- مساحة أثر — إزالة ذكر الوزارة من المحتوى
--
-- الموقع لم يعد يذكر الوزارة نصًّا ولا شعارًا. نصوص الواجهة عُدّلت في
-- messages/، وهذا الملف يعالج ما في القاعدة: نبذة «عن أثر»، والأسئلة الشائعة،
-- وأوصاف المساحات المؤرشفة التي تظهر في اللوحة.
--
-- الاستبدال موضعيّ بـ replace() لا بإعادة كتابة الحقول، فيبقى ما عدّله
-- المشرفون حول العبارة كما هو، وتشغيل الملف مرّتين لا يغيّر شيئًا.
--
-- نطاق البريد (allowed_email_domains) لا يُمسّ: هو شرط الدخول نفسه.
-- ════════════════════════════════════════════════════════════════════════════

-- ── نبذة «عن أثر» ──────────────────────────────────────────────────────────
update public.site_settings set
  about_ar = replace(replace(about_ar,
    'منسوبي وزارة الموارد البشرية والتنمية الاجتماعية بالمنطقة الشرقية', 'الزملاء'),
    'منسوبي وزارة الموارد البشرية والتنمية الاجتماعية', 'الزملاء'),
  about_en = replace(about_en,
    'colleagues at the Ministry of Human Resources and Social Development together', 'colleagues together')
where id;

-- ── الأسئلة الشائعة ────────────────────────────────────────────────────────
update public.faqs set
  question_ar = replace(question_ar,
    'إذا انتقلت من الوزارة؟', 'إذا انتقلت إلى جهة عمل أخرى؟'),
  question_en = replace(question_en,
    'if I leave the Ministry?', 'if I move to another employer?'),
  answer_ar = replace(replace(replace(replace(answer_ar,
    'منسوبو فرع وزارة الموارد البشرية والتنمية الاجتماعية بالمنطقة الشرقية، ممّن', 'الموظفون ممّن'),
    'منسوبو الوزارة ممّن', 'الموظفون ممّن'),
    'منسوبي وزارة الموارد البشرية والتنمية الاجتماعية بالمنطقة الشرقية', 'الزملاء'),
    'منسوبي وزارة الموارد البشرية والتنمية الاجتماعية', 'الزملاء'),
  answer_en = replace(replace(replace(answer_en,
    'Colleagues at the Eastern Region branch of the Ministry of Human Resources and Social Development who have', 'Colleagues who have'),
    'Ministry colleagues with an official', 'Colleagues with an official'),
    'colleagues at the Ministry of Human Resources and Social Development together', 'colleagues together')
where concat_ws(' ', question_ar, question_en, answer_ar, answer_en) ~* '(وزار|ministry)';

-- المعرّف يظهر في الرابط (#leaving-ministry) — يُغيَّر ما لم يكن البديل محجوزًا.
update public.faqs set slug = 'leaving-work'
where slug = 'leaving-ministry'
  and not exists (select 1 from public.faqs where slug = 'leaving-work');

-- ── المساحات المؤرشفة (من بذرة 0005) ───────────────────────────────────────
update public.forums set
  tagline_ar = replace(replace(tagline_ar,
    'نحكي قصة الوزارة بصورة وصوت', 'نحكي قصّتنا بصورة وصوت'),
    'أثرٌ يبدأ من الوزارة ويصل أبعد', 'أثرٌ يبدأ من هنا ويصل أبعد'),
  tagline_en = replace(tagline_en,
    'Telling the Ministry''s story in sound and image', 'Telling our story in sound and image'),
  description_ar = replace(replace(replace(description_ar,
    'ننتج معًا موادّ تعرّف بعمل الوزارة', 'ننتج معًا موادّ تعرّف بعملنا'),
    'ونستثمر خبرة منسوبي الوزارة في التنمية الاجتماعية', 'ونستثمر خبراتنا'),
    'تجمع منسوبي الوزارة خارج', 'تجمع الزملاء خارج'),
  description_en = replace(replace(description_en,
    'material that shows the Ministry''s work', 'material that shows our work'),
    'putting the Ministry''s social development expertise directly to work', 'putting our expertise directly to work')
where concat_ws(' ', tagline_ar, tagline_en, description_ar, description_en) ~* '(وزار|ministry)';

-- ── ما بقي (إن بقي) يظهر هنا ليُراجَع يدويًّا ─────────────────────────────
select 'site_settings' as source, null::text as slug, about_ar as text_ar, about_en as text_en
  from public.site_settings where concat_ws(' ', about_ar, about_en) ~* '(وزار|ministry|human resources)'
union all
select 'faqs', slug, question_ar || ' / ' || answer_ar, question_en || ' / ' || answer_en
  from public.faqs where concat_ws(' ', question_ar, question_en, answer_ar, answer_en) ~* '(وزار|ministry|human resources)'
union all
select 'forums', slug, concat_ws(' / ', name_ar, tagline_ar, description_ar), concat_ws(' / ', name_en, tagline_en, description_en)
  from public.forums where concat_ws(' ', name_ar, name_en, tagline_ar, tagline_en, description_ar, description_en) ~* '(وزار|ministry|human resources)';
