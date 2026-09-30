/**
 * تسجيل الزيارات — من الخادم، بلا كوكيز، وبلا تأخير للصفحة.
 *
 * لماذا نداء REST مباشر لا عميل supabase-js: هذا الملف يعمل داخل الوسيط
 * (Edge runtime) على كل طلب صفحة. إضافة مكتبة كاملة هناك تعني حزمة أثقل
 * ووقت إقلاع أطول على كل طلب — ونحن لا نحتاج منها إلا نداء RPC واحدًا.
 *
 * الأمن: النداء يحمل مفتاحًا سرّيًا (ANALYTICS_INGEST_KEY) تتحقّق منه الدالّة
 * في قاعدة البيانات. المفتاح العام وحده لا يكفي لحقن زيارات وهمية.
 */

import { env } from '@/lib/env'
import { previewMode } from '@/lib/fixtures'
import { parseUserAgent } from '@/lib/analytics/ua'
import { classifyPath, stripLocale, type PageType } from '@/lib/analytics/page-type'

const INGEST_KEY = process.env.ANALYTICS_INGEST_KEY ?? ''

/** بلا مفتاح لا تسجيل — هكذا تعمل البيئة المحلّية والمعاينة بلا ضوضاء. */
export const analyticsEnabled = INGEST_KEY.length >= 24 && !previewMode

interface HeaderLike {
  get(name: string): string | null
}

async function callRpc(fn: string, args: Record<string, unknown>): Promise<void> {
  const response = await fetch(`${env.supabaseUrl}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: {
      apikey: env.supabaseAnonKey,
      Authorization: `Bearer ${env.supabaseAnonKey}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(args),
    cache: 'no-store',
  })

  if (!response.ok) {
    // لا نُفشل الطلب من أجل الإحصاءات — لكن لا نبتلع الخطأ صامتين أيضًا.
    const detail = await response.text().catch(() => '')
    console.error(`[analytics] ${fn} فشل (${response.status}): ${detail.slice(0, 300)}`)
  }
}

/** عنوان الزائر. لا يُخزَّن — يدخل الدالّة ليُمزج بالملح ويخرج بصمة. */
export function clientIp(headers: HeaderLike): string {
  const forwarded = headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0]!.trim()
  return headers.get('x-real-ip') ?? headers.get('cf-connecting-ip') ?? 'unknown'
}

/**
 * هل هذا الطلب جلب مسبق لا زيارة حقيقية؟
 * Next.js يجلب الصفحات المرتبطة قبل أن ينقر المستخدم عليها. احتسابها مشاهدات
 * يضخّم الأرقام بلا وجه حق، وهو أشهر أسباب تضخّم إحصاءات المواقع المبنية به.
 */
export function isPrefetch(headers: HeaderLike): boolean {
  return (
    headers.get('next-router-prefetch') === '1' ||
    headers.get('x-middleware-prefetch') === '1' ||
    headers.get('purpose') === 'prefetch' ||
    headers.get('x-purpose') === 'prefetch' ||
    headers.get('x-moz') === 'prefetch'
  )
}

function referrerOf(raw: string | null, selfHost: string): { host: string | null; path: string | null } {
  if (!raw) return { host: null, path: null }
  try {
    const url = new URL(raw)
    if (url.host === selfHost) return { host: null, path: null } // تنقّل داخلي
    return { host: url.host.replace(/^www\./, ''), path: url.pathname.slice(0, 256) || '/' }
  } catch {
    return { host: null, path: null }
  }
}

function utmOf(params: URLSearchParams): Record<string, string> {
  const utm: Record<string, string> = {}
  for (const key of ['source', 'medium', 'campaign', 'content', 'term'] as const) {
    const value = params.get(`utm_${key}`)
    if (value) utm[key] = value.slice(0, 128)
  }
  return utm
}

export interface PageviewInput {
  url: URL
  headers: HeaderLike
  locale: string
  locales: readonly string[]
  profileId: string | null
}

/**
 * يسجّل مشاهدة صفحة. لا يُنتظر في مسار الاستجابة — نادِه داخل waitUntil.
 * يعيد false إن لم يُسجَّل شيء (روبوت، جلب مسبق، أو تسجيل معطّل).
 */
export async function recordPageview(input: PageviewInput): Promise<boolean> {
  if (!analyticsEnabled) return false
  if (isPrefetch(input.headers)) return false

  const ua = parseUserAgent(input.headers.get('user-agent'))
  const path = stripLocale(input.url.pathname, input.locales)
  const { pageType, entitySlug } = classifyPath(path)
  const referrer = referrerOf(input.headers.get('referer'), input.url.host)

  await callRpc('analytics_track', {
    p_secret: INGEST_KEY,
    p_ip: clientIp(input.headers),
    p_ua: input.headers.get('user-agent') ?? '',
    p_path: input.url.pathname.slice(0, 512),
    p_locale: input.locale,
    p_page_type: pageType,
    p_entity_slug: entitySlug,
    p_profile_id: input.profileId,
    p_device: ua.device,
    p_browser: ua.browser,
    p_os: ua.os,
    p_country: input.headers.get('x-vercel-ip-country'),
    p_region: input.headers.get('x-vercel-ip-country-region'),
    p_referrer_host: referrer.host,
    p_referrer_path: referrer.path,
    p_utm: utmOf(input.url.searchParams),
  })

  return true
}

/** زمن البقاء وعمق التمرير، يصلان من المتصفّح بعد مغادرة الصفحة. */
export async function recordEngagement(params: {
  headers: HeaderLike
  path: string
  durationMs: number
  scrollPct: number | null
  screenWidth: number | null
}): Promise<void> {
  if (!analyticsEnabled) return
  if (parseUserAgent(params.headers.get('user-agent')).isBot) return

  await callRpc('analytics_engagement', {
    p_secret: INGEST_KEY,
    p_ip: clientIp(params.headers),
    p_ua: params.headers.get('user-agent') ?? '',
    p_path: params.path.slice(0, 512),
    p_duration_ms: Math.round(params.durationMs),
    p_scroll_pct: params.scrollPct,
    p_screen_w: params.screenWidth,
  })
}

/** أسماء التحوّلات — مركزيّة حتى لا تتفرّق النصوص بين الملفّات. */
export const CONVERSIONS = {
  waitlistSignup: 'waitlist_signup',
  joinRequest: 'join_request',
  eventRegistration: 'event_registration',
  magicLinkRequested: 'magic_link_requested',
  profileCompleted: 'profile_completed',
  contactMessage: 'contact_message',
} as const

export type ConversionName = (typeof CONVERSIONS)[keyof typeof CONVERSIONS]

export async function recordConversion(params: {
  headers: HeaderLike
  name: ConversionName
  path?: string | null
  entityId?: string | null
  locale?: string | null
}): Promise<void> {
  if (!analyticsEnabled) return

  await callRpc('analytics_conversion', {
    p_secret: INGEST_KEY,
    p_ip: clientIp(params.headers),
    p_ua: params.headers.get('user-agent') ?? '',
    p_name: params.name,
    p_path: params.path ?? null,
    p_entity_id: params.entityId ?? null,
    p_locale: params.locale ?? null,
  })
}

export type { PageType }
