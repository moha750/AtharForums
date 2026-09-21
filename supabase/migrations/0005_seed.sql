-- ════════════════════════════════════════════════════════════════════════════
-- منتديات أثر — البيانات الأوّلية
--
-- ⚠️ المنتديات أدناه مقترحة كبذرة أولى. راجعوها وعدّلوها من لوحة التحكم قبل
--    التدشين — الأسماء والأوصاف والطاقات الاستيعابية كلها قابلة للتغيير.
-- ════════════════════════════════════════════════════════════════════════════

insert into public.site_settings (id)
values (true)
on conflict (id) do nothing;

update public.site_settings
set
  launch_at = '2026-09-27T09:00:00Z',            -- الأحد ٢٧ سبتمبر، ١٢:٠٠ ظهرًا بتوقيت الرياض
  teaser_mode = true,
  registration_open = true,
  allowed_email_domains = array['hrsd.gov.sa'],
  bootstrap_admin_emails = array['admin@hrsd.gov.sa'],
  about_ar = 'منتديات أثر مبادرة من فرع وزارة الموارد البشرية والتنمية الاجتماعية بالمنطقة الشرقية، تجمع منسوبي الفرع حول ما يجيدونه وما يحبّونه. كل منتدى مساحة يقودها الموظفون أنفسهم: يتعلّمون فيها، ويبنون، ويتركون أثرًا يتجاوز مكاتبهم.',
  about_en = 'Athar Forums is an initiative by the Eastern Region Branch of the Ministry of Human Resources and Social Development, bringing colleagues together around what they are good at and what they love. Each forum is a space led by employees themselves — to learn, to build, and to leave a mark beyond their desks.',
  contact_email = 'athar@hrsd.gov.sa'
where id;

-- ── المنتديات المقترحة ─────────────────────────────────────────────────────
insert into public.forums
  (slug, name_ar, name_en, tagline_ar, tagline_en, description_ar, description_en, icon, color, skills, status, sort_order, is_accepting)
values
  (
    'media-content', 'منتدى الإعلام والمحتوى', 'Media & Content Forum',
    'نحكي قصة الوزارة بصورة وصوت', 'Telling the Ministry''s story in sound and image',
    'مساحة لمن يجيد التصوير والمونتاج والتصميم وكتابة المحتوى. ننتج معًا موادّ تعرّف بعمل الوزارة، ونتدرّب على أدوات الإنتاج الحديثة، ونغطّي فعاليات المنتديات.',
    'For those skilled in photography, editing, design and writing. We produce material that shows the Ministry''s work, train on modern production tools, and cover forum events.',
    'Clapperboard', 'ember', array['التصوير','المونتاج','التصميم الجرافيكي','كتابة المحتوى','الموشن جرافيك'],
    'published', 10, true
  ),
  (
    'tech-innovation', 'منتدى التقنية والابتكار', 'Technology & Innovation Forum',
    'من فكرة على ورق إلى أداة تعمل', 'From an idea on paper to a working tool',
    'للمهتمين بالبرمجة وتحليل البيانات والذكاء الاصطناعي وأتمتة الأعمال. نبني حلولًا صغيرة تخدم زملاءنا، ونتبادل الخبرة التقنية، ونستضيف ورشًا عملية.',
    'For those interested in programming, data analysis, AI and workflow automation. We build small tools that serve colleagues, share technical expertise, and host hands-on workshops.',
    'Cpu', 'teal', array['البرمجة','تحليل البيانات','الذكاء الاصطناعي','أتمتة الأعمال','الأمن السيبراني'],
    'published', 20, true
  ),
  (
    'reading-knowledge', 'منتدى القراءة والمعرفة', 'Reading & Knowledge Forum',
    'كتاب نقرؤه، وحوار يستحقّ الوقت', 'A book worth reading, a conversation worth having',
    'نادٍ للقراءة وجلسات معرفية شهرية. نختار كتابًا، نقرؤه، ونلتقي لنتحاور فيه — ونستضيف ضيوفًا يثرون النقاش.',
    'A reading club with monthly knowledge sessions. We pick a book, read it, and meet to discuss — with guests who enrich the conversation.',
    'BookOpen', 'sage', array['القراءة','الكتابة','إدارة الحوار','التلخيص'],
    'published', 30, true
  ),
  (
    'volunteering', 'منتدى التطوع والأثر المجتمعي', 'Volunteering & Social Impact Forum',
    'أثرٌ يبدأ من الوزارة ويصل أبعد', 'Impact that starts here and reaches further',
    'نخطّط وننفّذ مبادرات تطوعية تخدم المجتمع، ونستثمر خبرة منسوبي الوزارة في التنمية الاجتماعية لخدمة الناس مباشرة.',
    'We plan and run volunteer initiatives serving the community, putting the Ministry''s social development expertise directly to work.',
    'HeartHandshake', 'sage', array['تنظيم الفعاليات','العمل التطوعي','إدارة المبادرات','التواصل المجتمعي'],
    'published', 40, true
  ),
  (
    'professional-growth', 'منتدى التطوير المهني', 'Professional Growth Forum',
    'مهارة كل شهر، ومسار يتّضح', 'A skill a month, a path that clears up',
    'ورش ولقاءات تركّز على المهارات التي تنفع في العمل: العرض والإلقاء، إدارة المشاريع، التفاوض، وأدوات الإنتاجية. ونفتح باب الإرشاد المهني بين الزملاء.',
    'Workshops focused on skills that matter at work: presenting, project management, negotiation and productivity tools — plus peer mentoring.',
    'GraduationCap', 'teal', array['العرض والإلقاء','إدارة المشاريع','التفاوض','الإنتاجية','الإرشاد المهني'],
    'published', 50, true
  ),
  (
    'sports-fitness', 'منتدى الرياضة واللياقة', 'Sports & Fitness Forum',
    'نتحرّك معًا', 'We move together',
    'تحدّيات مشي، ودوريات ودّية، ولقاءات رياضية تجمع منسوبي الوزارة خارج قاعات الاجتماعات.',
    'Walking challenges, friendly tournaments, and sports meetups that bring colleagues together outside meeting rooms.',
    'Activity', 'ember', array['تنظيم البطولات','التدريب الرياضي','قيادة الفرق'],
    'published', 60, true
  ),
  (
    'arts-crafts', 'منتدى الفنون والحِرف', 'Arts & Crafts Forum',
    'ما نصنعه بأيدينا', 'What we make with our hands',
    'للرسم والخط العربي والحِرف اليدوية والتصوير الفوتوغرافي كهواية. نقيم معارض داخلية ونتبادل التعلّم.',
    'For drawing, Arabic calligraphy, handicrafts and photography as a craft. We hold internal exhibitions and learn from each other.',
    'Palette', 'ember', array['الرسم','الخط العربي','الحِرف اليدوية','التصوير الفوتوغرافي'],
    'published', 70, true
  ),
  (
    'languages', 'منتدى اللغات', 'Languages Forum',
    'نتدرّب على الحديث لا الحفظ', 'Practising speech, not memorisation',
    'حلقات محادثة بالإنجليزية ولغات أخرى، وتبادل تعليم بين الزملاء لمن يتقن لغة ويريد أن يعلّمها.',
    'Conversation circles in English and other languages, with peer teaching from colleagues who want to share a language they know.',
    'Languages', 'teal', array['الإنجليزية','الترجمة','المحادثة','تعليم اللغات'],
    'published', 80, true
  )
on conflict (slug) do nothing;
