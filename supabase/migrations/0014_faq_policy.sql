-- ════════════════════════════════════════════════════════════════════════════
-- مساحة أثر — أسئلة السياسة، وبريد التواصل
--
-- أجوبة إدارة المبادرة عن أسئلة لا يعرفها الكود: وقت المشاركة، والشهادات،
-- ونطاق الفرع، وتعيين القادة، وشكل الفعاليات، واقتراح المساحات، ومصير
-- الحساب عند الانتقال.
--
-- سؤالان قائمان يُحدَّثان لا يُضافان — لأنّ الجواب المزروع فيهما صار ناقصًا
-- بعد هذا التوضيح، لا لأنّه كان خطأً. وهذا التحديث يدهس ما زُرِع فيهما فقط؛
-- الأسئلة الأخرى لا تُمسّ.
-- ════════════════════════════════════════════════════════════════════════════

-- ── تحديث جوابين قائمين ────────────────────────────────────────────────────

-- الأهلية: المبادرة للفرع لا للوزارة كلّها. (وصف الموقع يبقى بلا ذكر الفرع
-- كما طُلب سابقًا؛ موضع هذه الحقيقة سؤال الأهلية لا نصّ التعريف.)
update public.faqs set
  answer_ar = 'منسوبو فرع وزارة الموارد البشرية والتنمية الاجتماعية بالمنطقة الشرقية، ممّن لديهم بريد رسمي على نطاق hrsd.gov.sa. البريد الشخصي لا يُقبل عند التسجيل.',
  answer_en = 'Colleagues at the Eastern Region branch of the Ministry of Human Resources and Social Development who have an official hrsd.gov.sa email address. Personal email addresses are not accepted at sign-up.'
where slug = 'who-can-join';

-- القيادة: يعيّنها المجلس الإداري
update public.faqs set
  answer_ar = 'موظّف من منسوبي الفرع يعيّنه المجلس الإداري لمساحة أثر. القائد يراجع طلبات الانضمام، وينشر فعاليات مساحته وأخبارها.',
  answer_en = 'An employee from the branch, appointed by the Athar Space board. The lead reviews join requests and publishes the space''s events and news.'
where slug = 'lead';

-- ── أسئلة جديدة ────────────────────────────────────────────────────────────
insert into public.faqs (slug, question_ar, question_en, answer_ar, answer_en,
                         status, is_featured, sort_order) values
  ('working-hours',
   'هل المشاركة داخل وقت الدوام؟ وهل أحتاج موافقة مديري؟',
   'Do activities run during working hours? Do I need my manager''s approval?',
   'قد تكون الأنشطة خارج وقت الدوام. ولا تحتاج موافقة مديرك المباشر للانضمام إلى مساحة ولا للمشاركة في فعالياتها.',
   'Activities may take place outside working hours. You do not need your line manager''s approval to join a space or take part in its events.',
   'published', true, 45),

  ('certificate',
   'هل تُحتسب المشاركة في التقييم الوظيفي؟',
   'Does participation count towards my performance review?',
   'لا تُحتسب في التقييم الوظيفي. وتُمنح شهادة على المشاركة.',
   'It does not count towards your performance review. A certificate of participation is issued.',
   'published', false, 55),

  ('events-format',
   'هل الفعاليات حضورية أم عن بُعد؟ وهل عليها رسوم؟',
   'Are events on-site or online? Is there a fee?',
   'قد تكون حضورية وقد تكون عن بُعد، ويُذكر ذلك في صفحة كل فعالية. وجميعها مجانية بلا أي رسوم.',
   'They may be on-site or online — each event page says which. All of them are free of charge.',
   'published', false, 95),

  ('suggest-space',
   'هل أقترح مساحة جديدة؟',
   'Can I suggest a new space?',
   'نعم. أرسل اقتراحك عبر قنوات التواصل في الموقع، ويُعرض على المجلس الإداري لمساحة أثر.',
   'Yes. Send your suggestion through the contact channels on this site and it will be put to the Athar Space board.',
   'published', false, 125),

  ('leaving-ministry',
   'ماذا يحدث لحسابي إذا انتقلت من الوزارة؟',
   'What happens to my account if I leave the Ministry?',
   'تُنهى عضوياتك في المساحات ويُغلق حسابك.',
   'Your space memberships are ended and your account is closed.',
   'published', false, 130)
on conflict (slug) do nothing;

-- ── بريد التواصل ───────────────────────────────────────────────────────────
-- يُفعّل بطاقة «لم تجد سؤالك؟» في صفحة الأسئلة، ورابط التواصل في التذييل
-- وصفحة «عن أثر».
update public.site_settings set contact_email = 'is99946@hotmail.com' where id;

select
  (select count(*) from public.faqs where status = 'published') as published,
  (select count(*) from public.faqs where is_featured) as featured,
  (select contact_email from public.site_settings where id) as contact;
