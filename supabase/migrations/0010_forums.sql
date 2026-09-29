-- ════════════════════════════════════════════════════════════════════════════
-- مساحة أثر — المساحات الثلاث المعتمَدة
--
-- تحلّ محلّ المنتديات الثمانية المقترحة في 0005. تلك كانت بذرة للمراجعة،
-- وهذه أسماء معتمدة من إدارة المبادرة.
--
-- الأوصاف والشعارات النصّية أدناه صياغة أوّلية قابلة للتحرير من لوحة التحكم —
-- الأسماء وحدها هي المعتمَدة.
--
-- on conflict على slug: تشغيل الملف مرّتين لا يُنشئ مكرّرًا ولا يفقد عضويات.
--
-- ⚠️ الحارس forums_guard_columns يعيد status وsort_order إلى قيمتهما السابقة
-- لكل من ليس مشرفًا — والترحيل يعمل بلا هوية، فـ is_admin() تعود false وتُبتلع
-- التعديلات بصمت. لذلك نعطّله حول الكتابة ونعيده بعدها. لا تحذف هذا السطرين:
-- بدونهما يبدو الملف ناجحًا ولا يغيّر شيئًا.
-- ════════════════════════════════════════════════════════════════════════════

alter table public.forums disable trigger forums_guard_columns;

insert into public.forums (
  slug, name_ar, name_en, tagline_ar, tagline_en,
  description_ar, description_en, icon, color, skills,
  status, sort_order, is_accepting
) values
  (
    'development',
    'مساحات تطويرية',
    'Development Spaces',
    'مهارة تُتقَن، ومسار يتّضح',
    'A skill sharpened, a path made clear',
    'ورش ولقاءات تبني المهارات التي تنفع في العمل وخارجه: العرض والإلقاء، وإدارة المشاريع، والتقنية، وأدوات الإنتاجية. يقودها منسوبو الفرع أنفسهم — من أتقن شيئًا علّمه، ومن أراد أن يتعلّم وجد من يأخذ بيده.',
    'Workshops and sessions that build the skills that matter at work and beyond: presenting, project management, technology, productivity tools. Led by colleagues themselves — those who have mastered something teach it, and those who want to learn find a hand to hold.',
    'TrendingUp', 'teal',
    array['العرض والإلقاء', 'إدارة المشاريع', 'التقنية', 'أدوات الإنتاجية', 'التدريب'],
    'published', 10, true
  ),
  (
    'social',
    'مساحات اجتماعية وترفيهية',
    'Social & Recreational Spaces',
    'نلتقي خارج قاعات الاجتماعات',
    'Meeting outside the meeting rooms',
    'لقاء بلا أجندة: رحلات، ومبادرات ودّية، وتحدّيات رياضية، وجلسات تجمع الزملاء على ما يحبّون. الهدف بسيط — أن يعرف بعضنا بعضًا إنسانًا قبل أن يعرفه مسمًّى وظيفيًا.',
    'Getting together without an agenda: outings, friendly initiatives, sports challenges, and gatherings around what colleagues enjoy. The aim is simple — to know each other as people before job titles.',
    'Users', 'sage',
    array['تنظيم الفعاليات', 'الرياضة', 'الرحلات', 'الضيافة'],
    'published', 20, true
  ),
  (
    'cultural',
    'مساحات ثقافية وإبداعية',
    'Cultural & Creative Spaces',
    'كتاب يُقرأ، وفكرة تُصنع',
    'A book read, an idea made',
    'قراءة وحوار وفنون: نادٍ للكتاب، وجلسات معرفية شهرية، ومساحات للتصوير والتصميم والكتابة. من كان له شغف خارج مكتبه فهذا بيته.',
    'Reading, conversation and the arts: a book club, monthly knowledge sessions, and room for photography, design and writing. If you have a passion beyond your desk, this is its home.',
    'Palette', 'ember',
    array['القراءة', 'الكتابة', 'التصوير', 'التصميم', 'الفنون'],
    'published', 30, true
  )
on conflict (slug) do update set
  name_ar        = excluded.name_ar,
  name_en        = excluded.name_en,
  tagline_ar     = excluded.tagline_ar,
  tagline_en     = excluded.tagline_en,
  description_ar = excluded.description_ar,
  description_en = excluded.description_en,
  icon           = excluded.icon,
  color          = excluded.color,
  skills         = excluded.skills,
  status         = excluded.status,
  sort_order     = excluded.sort_order,
  is_accepting   = excluded.is_accepting;

-- ── المقترحات القديمة تُؤرشَف ولا تُحذف ────────────────────────────────────
-- الحذف يسحب معه أي عضوية أو فعالية مرتبطة (on delete cascade). الأرشفة
-- تُخفيها عن الزائر وتُبقي أثرها. إن لم تكن موجودة أصلًا فلا شيء يحدث.
update public.forums
set status = 'archived', is_accepting = false
where slug in (
  'media-content', 'tech-innovation', 'reading-knowledge', 'volunteering',
  'professional-growth', 'sports-fitness', 'arts-crafts', 'languages'
);

alter table public.forums enable trigger forums_guard_columns;

select slug, name_ar, color, status, sort_order from public.forums order by status, sort_order, slug;
