/**
 * بيانات إحصائية تجريبية — للمعاينة بلا قاعدة بيانات فقط.
 *
 * تُبنى بمولّد شبه عشوائي ثابت البذرة، فالأرقام تبدو طبيعية ولا تتبدّل بين
 * إعادة التحميل. لا تُستعمل إطلاقًا خارج ATHAR_PREVIEW_FIXTURES.
 */

import type {
  AnalyticsFunnels,
  AnalyticsOverview,
  AnalyticsPerson,
  AnalyticsPersonEvent,
  AnalyticsPoint,
  AnalyticsRealtime,
  AnalyticsRow,
} from '@/lib/database.types'

/** مولّد ثابت: نفس البذرة تعطي نفس السلسلة دائمًا. */
function seeded(seed: number): () => number {
  let state = seed
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296
    return state / 4294967296
  }
}

function buildTimeseries(): AnalyticsPoint[] {
  const random = seeded(20260927)
  const points: AnalyticsPoint[] = []
  const now = new Date()

  for (let i = 13; i >= 0; i -= 1) {
    const day = new Date(now)
    day.setDate(day.getDate() - i)
    day.setHours(0, 0, 0, 0)

    const weekend = day.getDay() === 5 || day.getDay() === 6
    const base = weekend ? 18 : 46
    const visitors = Math.round(base + random() * base * 0.8)
    const visits = Math.round(visitors * (1.1 + random() * 0.3))

    points.push({
      bucket: day.toISOString(),
      visitors,
      visits,
      pageviews: Math.round(visits * (2.2 + random() * 1.4)),
      conversions: Math.round(visits * (0.04 + random() * 0.08)),
    })
  }

  return points
}

const timeseries = buildTimeseries()
const totalVisits = timeseries.reduce((sum, p) => sum + p.visits, 0)
const totalViews = timeseries.reduce((sum, p) => sum + p.pageviews, 0)
const totalVisitors = timeseries.reduce((sum, p) => sum + p.visitors, 0)
const totalConversions = timeseries.reduce((sum, p) => sum + p.conversions, 0)

function rows(entries: Array<[string, number]>): AnalyticsRow[] {
  const total = entries.reduce((sum, [, v]) => sum + v, 0)
  return entries.map(([label, visits]) => ({
    label,
    visits,
    pageviews: Math.round(visits * 2.4),
    visitors: Math.round(visits * 0.86),
    share: total === 0 ? 0 : Math.round((visits * 1000) / total) / 10,
  }))
}

export const fixtureAnalytics: {
  overview: AnalyticsOverview
  timeseries: AnalyticsPoint[]
  breakdowns: Record<string, AnalyticsRow[]>
  realtime: AnalyticsRealtime
  funnels: AnalyticsFunnels
  people: AnalyticsPerson[]
  personTrail: AnalyticsPersonEvent[]
} = {
  overview: {
    current: {
      visitors: totalVisitors,
      visits: totalVisits,
      pageviews: totalViews,
      bounces: Math.round(totalVisits * 0.38),
      bounce_rate: 38.4,
      avg_duration_s: 147,
      views_per_visit: Math.round((totalViews / totalVisits) * 100) / 100,
      returning: Math.round(totalVisits * 0.41),
      returning_rate: 41.2,
      identified: Math.round(totalVisits * 0.63),
      conversions: totalConversions,
      conversion_rate: 9.6,
      bots: 214,
    },
    previous: {
      visitors: Math.round(totalVisitors * 0.82),
      visits: Math.round(totalVisits * 0.85),
      pageviews: Math.round(totalViews * 0.79),
      bounce_rate: 44.1,
      avg_duration_s: 118,
      conversions: Math.round(totalConversions * 0.71),
    },
  },

  timeseries,

  breakdowns: {
    path: rows([
      ['/ar', 412],
      ['/ar/forums', 288],
      ['/ar/forums/tech-innovation', 176],
      ['/ar/forums/media-content', 154],
      ['/ar/events', 97],
      ['/ar/about', 71],
      ['/en', 54],
      ['/ar/login', 48],
    ]),
    page_type: rows([
      ['home', 412],
      ['forums', 288],
      ['forum', 402],
      ['events', 97],
      ['about', 71],
      ['login', 48],
    ]),
    entry_path: rows([
      ['/ar', 508],
      ['/ar/forums', 192],
      ['/en', 61],
      ['/ar/events', 44],
    ]),
    exit_path: rows([
      ['/ar/forums/tech-innovation', 143],
      ['/ar', 138],
      ['/ar/forums', 96],
      ['/ar/events', 52],
    ]),
    referrer_host: rows([
      ['مباشر', 486],
      ['mail.google.com', 142],
      ['x.com', 88],
      ['linkedin.com', 41],
      ['hrsd.gov.sa', 33],
    ]),
    utm_source: rows([
      ['email', 132],
      ['twitter', 71],
      ['linkedin', 29],
    ]),
    utm_campaign: rows([
      ['launch-teaser', 118],
      ['internal-newsletter', 84],
      ['forum-lead-call', 30],
    ]),
    device: rows([
      ['desktop', 498],
      ['mobile', 246],
      ['tablet', 46],
    ]),
    browser: rows([
      ['Chrome', 431],
      ['Safari', 214],
      ['Edge', 108],
      ['Firefox', 37],
    ]),
    os: rows([
      ['Windows', 372],
      ['iOS', 198],
      ['macOS', 141],
      ['Android', 79],
    ]),
    country: rows([
      ['SA', 736],
      ['AE', 28],
      ['EG', 14],
      ['US', 12],
    ]),
    locale: rows([
      ['ar', 692],
      ['en', 98],
    ]),
  },

  realtime: {
    active_visitors: 7,
    views_last_hour: 63,
    top_now: [
      { path: '/ar/forums/tech-innovation', views: 14 },
      { path: '/ar', views: 11 },
      { path: '/ar/forums', views: 8 },
      { path: '/ar/events', views: 4 },
    ],
    minutes: Array.from({ length: 30 }, (_, index) => {
      const random = seeded(4200 + index)
      const minute = new Date(Date.now() - (29 - index) * 60_000)
      minute.setSeconds(0, 0)
      return { minute: minute.toISOString(), views: Math.round(random() * 6) }
    }),
  },

  funnels: {
    overall: [
      { name: 'waitlist_signup', completions: 64, visits: 61 },
      { name: 'join_request', completions: 38, visits: 36 },
      { name: 'magic_link_requested', completions: 29, visits: 27 },
      { name: 'event_registration', completions: 17, visits: 17 },
    ],
    teaser: { views: 412, signups: 64, rate: 15.5 },
    forums: [
      { slug: 'tech-innovation', name_ar: 'منتدى التقنية والابتكار', name_en: 'Technology & Innovation', views: 176, requests: 14 },
      { slug: 'media-content', name_ar: 'منتدى الإعلام والمحتوى', name_en: 'Media & Content', views: 154, requests: 11 },
      { slug: 'reading-knowledge', name_ar: 'منتدى القراءة والمعرفة', name_en: 'Reading & Knowledge', views: 98, requests: 7 },
      { slug: 'volunteering', name_ar: 'منتدى التطوع والأثر المجتمعي', name_en: 'Volunteering', views: 74, requests: 6 },
    ],
    events: [
      { slug: 'mobile-photography-workshop', title_ar: 'ورشة التصوير الاحترافي بالجوال', title_en: 'Mobile Photography Workshop', views: 62, registrations: 11 },
      { slug: 'book-circle-october', title_ar: 'حلقة الكتاب — لقاء أكتوبر', title_en: 'Book Circle — October', views: 35, registrations: 6 },
    ],
    login: { views: 48, requested: 29, rate: 60.4 },
  },

  people: [
    { profile_id: '00000000-0000-4000-8000-000000000101', full_name: 'سارة الدوسري', email: 'sara@hrsd.gov.sa', visits: 22, pageviews: 71, last_seen: new Date(Date.now() - 12 * 60_000).toISOString() },
    { profile_id: '00000000-0000-4000-8000-000000000102', full_name: 'عبدالله القحطاني', email: 'abdullah@hrsd.gov.sa', visits: 18, pageviews: 54, last_seen: new Date(Date.now() - 96 * 60_000).toISOString() },
    { profile_id: '00000000-0000-4000-8000-000000000103', full_name: 'نورة الشمري', email: 'noura@hrsd.gov.sa', visits: 13, pageviews: 47, last_seen: new Date(Date.now() - 300 * 60_000).toISOString() },
  ],

  personTrail: [
    { occurred_at: new Date(Date.now() - 12 * 60_000).toISOString(), path: '/ar/forums/tech-innovation', page_type: 'forum', locale: 'ar', device: 'desktop', duration_ms: 184_000 },
    { occurred_at: new Date(Date.now() - 19 * 60_000).toISOString(), path: '/ar/forums', page_type: 'forums', locale: 'ar', device: 'desktop', duration_ms: 42_000 },
    { occurred_at: new Date(Date.now() - 24 * 60_000).toISOString(), path: '/ar', page_type: 'home', locale: 'ar', device: 'desktop', duration_ms: 31_000 },
  ],
}
