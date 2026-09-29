-- ════════════════════════════════════════════════════════════════════════════
-- مساحة أثر — تحديث الاسم والهوية في قاعدة البيانات
--
-- الاسم تبدّل من «منتديات أثر» إلى «مساحة أثر»، والشعار النصّي معه. الافتراضات
-- في 0001 عُدّلت للمشاريع الجديدة، لكن الصفّ القائم لا يتأثّر بتغيير الافتراض
-- — فهذا الترحيل يحدّثه صراحةً.
--
-- «المنتديات» تبقى كما هي: هي ما بداخل المساحة لا اسمها.
-- ════════════════════════════════════════════════════════════════════════════

update public.site_settings
set
  site_name_ar = 'مساحة أثر',
  site_name_en = 'Athar Space',
  tagline_ar   = 'تواصل .. معرفة .. أثر',
  tagline_en   = 'Connection · Knowledge · Impact',
  about_ar     = 'مساحة أثر مبادرة من فرع وزارة الموارد البشرية والتنمية الاجتماعية بالمنطقة الشرقية، تجمع منسوبي الفرع حول ما يجيدونه وما يحبّونه. كل منتدى حلقة يقودها الموظفون أنفسهم: يتعلّمون فيها، ويبنون، ويتركون أثرًا يتجاوز مكاتبهم.',
  about_en     = 'Athar Space is an initiative by the Eastern Region Branch of the Ministry of Human Resources and Social Development, bringing colleagues together around what they are good at and what they love. Each forum is a circle led by employees themselves — to learn, to build, and to leave a mark beyond their desks.'
where id;

select site_name_ar, site_name_en, tagline_ar, tagline_en from public.site_settings;
