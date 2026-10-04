import type {
  AtharEvent,
  Banner,
  BoardMember,
  ContactMessage,
  Faq,
  Forum,
  ForumMemberPublic,
  PlatformStats,
  Post,
  Profile,
  PublicSettings,
  WaitlistSubscriber,
} from '@/lib/database.types'

/**
 * وضع المعاينة بلا قاعدة بيانات.
 *
 * يُفعَّل بـ ATHAR_PREVIEW_FIXTURES=1 فقط، ووجوده واضح للعين: البيانات كلها
 * تجريبية. الغرض مراجعة الواجهة وتصميمها على جهاز لا يصل إلى Supabase — لا
 * يُستخدم في الإنتاج، ولا يمنح أي صلاحية: كل ما يفعله أنه يعيد بيانات ثابتة.
 */
export const previewMode = process.env.ATHAR_PREVIEW_FIXTURES === '1'

export const fixtureSettings: PublicSettings = {
  launch_at: '2026-09-27T09:00:00Z',
  teaser_mode: process.env.ATHAR_PREVIEW_TEASER === '1',
  registration_open: true,
  allowed_email_domains: ['hrsd.gov.sa'],
  site_name_ar: 'مساحة أثر',
  site_name_en: 'Athar Space',
  tagline_ar: 'تواصل .. معرفة .. أثر',
  tagline_en: 'Connection · Knowledge · Impact',
  about_ar:
    'مساحة أثر تجمع الزملاء حول ما يجيدونه وما يحبّونه. كل مساحة يقودها الموظفون أنفسهم.',
  about_en:
    'Athar Space brings colleagues together around what they are good at and what they love.',
  contact_email: 'athar@hrsd.gov.sa',
}

const base = {
  cover_url: null,
  mission_ar: 'نلتقي مرّتين في الشهر، ونخرج بمادة أو مبادرة يستفيد منها زملاؤنا.',
  mission_en: 'We meet twice a month and ship something colleagues can use.',
  capacity: null,
  auto_approve: false,
  is_accepting: true,
  status: 'published' as const,
  created_at: '2026-09-01T00:00:00Z',
  updated_at: '2026-09-01T00:00:00Z',
  created_by: null,
}

export const fixtureForums: Forum[] = [
  {
    ...base,
    id: '11111111-1111-1111-1111-111111111111',
    slug: 'development',
    name_ar: 'مساحات تطويرية',
    name_en: 'Development Spaces',
    tagline_ar: 'مهارة تُتقَن، ومسار يتّضح',
    tagline_en: 'A skill sharpened, a path made clear',
    description_ar:
      'ورش ولقاءات تبني المهارات التي تنفع في العمل وخارجه: العرض والإلقاء، وإدارة المشاريع، والتقنية، وأدوات الإنتاجية. يقودها الموظفون أنفسهم.',
    description_en:
      'Workshops and sessions that build the skills that matter at work and beyond, led by colleagues themselves.',
    icon: 'TrendingUp',
    color: 'teal',
    skills: ['العرض والإلقاء', 'إدارة المشاريع', 'التقنية', 'أدوات الإنتاجية'],
    sort_order: 10,
    members_count: 42,
  },
  {
    ...base,
    id: '22222222-2222-2222-2222-222222222222',
    slug: 'social',
    name_ar: 'مساحات اجتماعية وترفيهية',
    name_en: 'Social & Recreational Spaces',
    tagline_ar: 'نلتقي خارج قاعات الاجتماعات',
    tagline_en: 'Meeting outside the meeting rooms',
    description_ar:
      'لقاء بلا أجندة: رحلات، ومبادرات ودّية، وتحدّيات رياضية، وجلسات تجمع الزملاء على ما يحبّون.',
    description_en:
      'Getting together without an agenda: outings, friendly initiatives, sports challenges and gatherings.',
    icon: 'Users',
    color: 'sage',
    skills: ['تنظيم الفعاليات', 'الرياضة', 'الرحلات', 'الضيافة'],
    sort_order: 20,
    members_count: 35,
  },
  {
    ...base,
    id: '33333333-3333-3333-3333-333333333333',
    slug: 'cultural',
    name_ar: 'مساحات ثقافية وإبداعية',
    name_en: 'Cultural & Creative Spaces',
    tagline_ar: 'كتاب يُقرأ، وفكرة تُصنع',
    tagline_en: 'A book read, an idea made',
    description_ar:
      'قراءة وحوار وفنون: نادٍ للكتاب، وجلسات معرفية شهرية، ومساحات للتصوير والتصميم والكتابة.',
    description_en:
      'Reading, conversation and the arts: a book club, monthly knowledge sessions, and room for photography, design and writing.',
    icon: 'Palette',
    color: 'ember',
    skills: ['القراءة', 'الكتابة', 'التصوير', 'التصميم'],
    sort_order: 30,
    members_count: 27,
  },
]

export const fixtureMembers: ForumMemberPublic[] = [
  {
    profile_id: 'a1',
    full_name_ar: 'سارة الدوسري',
    full_name_en: 'Sarah Aldossari',
    job_title: 'أخصائية اتصال مؤسسي',
    avatar_url: null,
    skills: ['كتابة المحتوى'],
    membership_role: 'lead',
    joined_at: '2026-09-02T00:00:00Z',
  },
  {
    profile_id: 'a2',
    full_name_ar: 'عبدالله القحطاني',
    full_name_en: 'Abdullah Alqahtani',
    job_title: 'مصمّم جرافيك',
    avatar_url: null,
    skills: ['التصميم الجرافيكي'],
    membership_role: 'core',
    joined_at: '2026-09-03T00:00:00Z',
  },
  {
    profile_id: 'a3',
    full_name_ar: 'نورة العتيبي',
    full_name_en: 'Noura Alotaibi',
    job_title: 'محلّلة بيانات',
    avatar_url: null,
    skills: ['تحليل البيانات'],
    membership_role: 'member',
    joined_at: '2026-09-05T00:00:00Z',
  },
  {
    profile_id: 'a4',
    full_name_ar: 'فهد الشمري',
    full_name_en: 'Fahad Alshammari',
    job_title: 'مصوّر',
    avatar_url: null,
    skills: ['التصوير'],
    membership_role: 'member',
    joined_at: '2026-09-06T00:00:00Z',
  },
]

export const fixtureEvents: AtharEvent[] = [
  {
    id: 'e1',
    forum_id: '11111111-1111-1111-1111-111111111111',
    slug: 'photo-workshop',
    title_ar: 'ورشة التصوير الاحترافي بالجوال',
    title_en: 'Pro mobile photography workshop',
    description_ar: 'ورشة عملية لمدة ساعتين.',
    description_en: 'A hands-on two-hour workshop.',
    cover_url: null,
    starts_at: '2026-10-05T11:00:00Z',
    ends_at: '2026-10-05T13:00:00Z',
    mode: 'onsite',
    location_ar: 'قاعة التدريب — المبنى الرئيسي',
    location_en: 'Training hall — HQ',
    meeting_url: null,
    capacity: 25,
    registration_open: true,
    members_only: false,
    registrations_count: 12,
    status: 'published',
    created_at: '2026-09-10T00:00:00Z',
    updated_at: '2026-09-10T00:00:00Z',
    created_by: null,
  },
  {
    id: 'e2',
    forum_id: '33333333-3333-3333-3333-333333333333',
    slug: 'book-circle-october',
    title_ar: 'حلقة الكتاب — لقاء أكتوبر',
    title_en: 'Book circle — October',
    description_ar: 'نناقش كتاب الشهر.',
    description_en: 'We discuss the book of the month.',
    cover_url: null,
    starts_at: '2026-10-12T13:30:00Z',
    ends_at: null,
    mode: 'hybrid',
    location_ar: 'المكتبة',
    location_en: 'The library',
    meeting_url: null,
    capacity: null,
    registration_open: true,
    members_only: false,
    registrations_count: 8,
    status: 'published',
    created_at: '2026-09-11T00:00:00Z',
    updated_at: '2026-09-11T00:00:00Z',
    created_by: null,
  },
]

export const fixturePosts: Post[] = [
  {
    id: 'p1',
    forum_id: null,
    slug: 'athar-launch',
    title_ar: 'انطلاق مساحة أثر',
    title_en: 'Athar Space is live',
    excerpt_ar: 'ثلاث مساحات تفتح أبوابها للموظفين بدءًا من اليوم.',
    excerpt_en: 'Eight forums open their doors to employees starting today.',
    body_ar: null,
    body_en: null,
    cover_url: null,
    status: 'published',
    published_at: '2026-09-27T09:00:00Z',
    author_id: null,
    created_at: '2026-09-27T09:00:00Z',
    updated_at: '2026-09-27T09:00:00Z',
  },
]

export const fixtureBanners: Banner[] = [
  {
    id: 'b1',
    image_url: '/athar-logo.svg',
    image_alt_ar: null,
    image_alt_en: null,
    title_ar: 'التسجيل في المساحات مفتوح',
    title_en: 'Registration is open',
    body_ar: 'اختر مساحتك وانضمّ إلى زملائك قبل نهاية الشهر.',
    body_en: 'Pick your space and join your colleagues before the month ends.',
    cta_label_ar: 'تصفّح المساحات',
    cta_label_en: 'Browse the spaces',
    cta_href: '/forums',
    status: 'published',
    starts_at: null,
    ends_at: null,
    sort_order: 10,
    created_by: null,
    created_at: '2026-09-27T09:00:00Z',
    updated_at: '2026-09-27T09:00:00Z',
  },
]

export const fixtureFaqs: Faq[] = [
  {
    id: 'f1',
    slug: 'what-is-athar',
    question_ar: 'ما مساحة أثر؟',
    question_en: 'What is Athar Space?',
    answer_ar: 'مبادرة داخلية تجمع الزملاء حول ما يجيدونه وما يحبّونه.',
    answer_en: 'An internal initiative bringing colleagues together around what they are good at.',
    status: 'published',
    is_featured: true,
    sort_order: 10,
    created_at: '2026-09-27T09:00:00Z',
    updated_at: '2026-09-27T09:00:00Z',
  },
]

/** أسماء المعاينة متخيَّلة، وبلا صور: يظهر الحرف الأوّل مكانها. */
export const fixtureBoard: BoardMember[] = (
  [
    ['r1', 'general_manager', 'عبدالله السالم', 'Abdullah Alsalem', null, null, 'يرعى المبادرة ويعتمد توجّهها.', 'Sponsors the initiative and sets its direction.', true],
    ['r2', 'chair', 'نورة الخالدي', 'Noura Alkhalidi', 'رئيسة مجلس إدارة مساحة أثر', 'Chair of the Athar Space Board', 'تقود المجلس وتعتمد المساحات الجديدة وقادتها.', 'Leads the board and approves new spaces and their leads.', true],
    ['r3', 'member', 'فهد العتيبي', 'Fahad Alotaibi', null, null, 'يوثّق قرارات المجلس ويتابع تنفيذها.', 'Records the board’s decisions and follows them through.', false],
    ['r4', 'member', 'ريم الدوسري', 'Reem Aldosari', 'عضوة إداريّة', null, 'تبني الشراكات مع الجهات من خارج أثر.', 'Builds partnerships with bodies beyond Athar.', false],
    ['r5', 'member', 'سلطان الشمري', 'Sultan Alshammari', null, null, 'يدير حضور أثر في القنوات الداخلية.', 'Runs Athar’s presence on internal channels.', false],
  ] as const
).map(([id, rank, name_ar, name_en, position_ar, position_en, role_ar, role_en, is_featured], i) => ({
  id,
  rank,
  name_ar,
  name_en,
  position_ar,
  position_en,
  role_ar,
  role_en,
  photo_url: null,
  sort_order: (i + 1) * 10,
  is_featured,
  status: 'published' as const,
  created_at: '2026-09-27T09:00:00Z',
  updated_at: '2026-09-27T09:00:00Z',
}))

export const fixtureStats: PlatformStats = {
  forums: fixtureForums.length,
  members: 177,
  events: 9,
  upcoming_events: 4,
}

export const fixtureProfile: Profile = {
  id: '00000000-0000-0000-0000-000000000001',
  email: 'admin@hrsd.gov.sa',
  full_name_ar: 'مشرف المعاينة',
  full_name_en: 'Preview Admin',
  employee_no: null,
  job_title: 'إدارة مساحة أثر',
  department: null,
  sector: null,
  work_location: null,
  phone: null,
  avatar_url: null,
  bio: null,
  skills: [],
  interests: [],
  role: 'super_admin',
  is_active: true,
  onboarded_at: null,
  created_at: '2026-09-01T00:00:00Z',
  updated_at: '2026-09-01T00:00:00Z',
}

export const fixtureApplications = [
  {
    id: 'm1',
    forum_id: fixtureForums[0].id,
    profile_id: 'a9',
    role: 'member' as const,
    status: 'pending' as const,
    motivation:
      'أعمل في الاتصال المؤسسي منذ ثلاث سنوات وأصوّر وأونتج كهواية. أحبّ أن أسخّر ذلك لتغطية فعاليات المساحات وإنتاج مواد تعرّف بها.',
    relevant_skills: ['التصوير', 'المونتاج'],
    applied_at: '2026-09-18T08:00:00Z',
    decided_at: null,
    decided_by: null,
    decision_note: null,
    forums: {
      id: fixtureForums[0].id,
      slug: fixtureForums[0].slug,
      name_ar: fixtureForums[0].name_ar,
      name_en: fixtureForums[0].name_en,
    },
    profiles: {
      id: 'a9',
      email: 'r.alharbi@hrsd.gov.sa',
      full_name_ar: 'ريم الحربي',
      full_name_en: 'Reem Alharbi',
      job_title: 'أخصائية اتصال',
      department: 'الإدارة العامة للاتصال المؤسسي',
      skills: ['التصوير'],
    },
  },
]

export const fixtureContactMessages: ContactMessage[] = [
  {
    id: 'c1',
    profile_id: null,
    full_name: 'نورة الدوسري',
    email: 'n.aldosari@hrsd.gov.sa',
    topic: 'suggestion',
    body: 'أقترح مساحة للتصوير الفوتوغرافي، فعدد من الزملاء يمارسونه ويحتاجون من ينظّم لهم جولات وورشًا.',
    locale: 'ar',
    status: 'new',
    handled_by: null,
    handled_at: null,
    created_at: '2026-09-30T08:15:00Z',
  },
  {
    id: 'c2',
    profile_id: 'p1',
    full_name: 'خالد العمري',
    email: 'k.alomari@hrsd.gov.sa',
    topic: 'technical',
    body: 'رابط الدخول يصلني منتهيًا إذا فتحته من الجوّال بعد فتحه على الحاسب.\nهل من طريقة أخرى؟',
    locale: 'ar',
    status: 'read',
    handled_by: 'p1',
    handled_at: '2026-09-29T12:00:00Z',
    created_at: '2026-09-29T10:40:00Z',
  },
  {
    id: 'c3',
    profile_id: null,
    full_name: 'Sara Ahmed',
    email: 'sara.ahmed@example.com',
    topic: 'inquiry',
    body: 'Are the events open to employees from other regions?',
    locale: 'en',
    status: 'archived',
    handled_by: 'p1',
    handled_at: '2026-09-28T09:00:00Z',
    created_at: '2026-09-27T16:05:00Z',
  },
]

export const fixtureWaitlist: WaitlistSubscriber[] = [
  {
    id: 'w1',
    email: 's.alotaibi@hrsd.gov.sa',
    full_name: null,
    source: 'teaser',
    interests: [],
    notified_at: null,
    created_at: '2026-09-19T10:00:00Z',
  },
  {
    id: 'w2',
    email: 'm.alzahrani@hrsd.gov.sa',
    full_name: null,
    source: 'teaser',
    interests: [],
    notified_at: null,
    created_at: '2026-09-19T14:20:00Z',
  },
]
