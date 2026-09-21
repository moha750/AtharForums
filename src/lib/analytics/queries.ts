import { createClient } from '@/lib/supabase/server'
import { previewMode } from '@/lib/fixtures'
import { fixtureAnalytics } from '@/lib/analytics/fixtures'
import type {
  AnalyticsFunnels,
  AnalyticsOverview,
  AnalyticsPerson,
  AnalyticsPersonEvent,
  AnalyticsPoint,
  AnalyticsRealtime,
  AnalyticsRow,
} from '@/lib/database.types'

export type RangeKey = 'today' | '7d' | '30d' | '90d'

export interface Range {
  key: RangeKey
  from: Date
  to: Date
  bucket: 'hour' | 'day' | 'week'
}

export function resolveRange(key: string | undefined): Range {
  const to = new Date()
  const safe: RangeKey = key === 'today' || key === '7d' || key === '30d' || key === '90d' ? key : '7d'

  const days = safe === 'today' ? 0 : safe === '7d' ? 7 : safe === '30d' ? 30 : 90
  const from = new Date(to)

  if (safe === 'today') from.setHours(0, 0, 0, 0)
  else from.setDate(from.getDate() - days)

  // دلو يناسب المدى: ٢٤ نقطة لليوم، ونقطة لكل يوم للأسبوع والشهر، وأسبوع للربع
  const bucket = safe === 'today' ? 'hour' : safe === '90d' ? 'week' : 'day'

  return { key: safe, from, to, bucket }
}

/** أبعاد التفصيل المسموح بها. القائمة مغلقة عمدًا: الاسم يصل من رابط الصفحة. */
export const BREAKDOWNS = [
  'path',
  'page_type',
  'entry_path',
  'exit_path',
  'referrer_host',
  'utm_source',
  'utm_campaign',
  'device',
  'browser',
  'os',
  'country',
  'locale',
] as const

export type Breakdown = (typeof BREAKDOWNS)[number]

const EMPTY_KPIS = {
  visitors: 0,
  visits: 0,
  pageviews: 0,
  bounce_rate: 0,
  avg_duration_s: 0,
  conversions: 0,
}

const EMPTY_OVERVIEW: AnalyticsOverview = { current: EMPTY_KPIS, previous: EMPTY_KPIS }

export async function getOverview(range: Range): Promise<AnalyticsOverview> {
  if (previewMode) return fixtureAnalytics.overview

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('analytics_overview', {
    p_from: range.from.toISOString(),
    p_to: range.to.toISOString(),
  })

  if (error) {
    console.error('[analytics] overview', error)
    return EMPTY_OVERVIEW
  }
  return (data as unknown as AnalyticsOverview) ?? EMPTY_OVERVIEW
}

export async function getTimeseries(range: Range): Promise<AnalyticsPoint[]> {
  if (previewMode) return fixtureAnalytics.timeseries

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('analytics_timeseries', {
    p_from: range.from.toISOString(),
    p_to: range.to.toISOString(),
    p_bucket: range.bucket,
  })

  if (error) {
    console.error('[analytics] timeseries', error)
    return []
  }
  return (data as AnalyticsPoint[]) ?? []
}

export async function getBreakdown(
  range: Range,
  dimension: Breakdown,
  limit = 8
): Promise<AnalyticsRow[]> {
  if (previewMode) return fixtureAnalytics.breakdowns[dimension] ?? []

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('analytics_breakdown', {
    p_from: range.from.toISOString(),
    p_to: range.to.toISOString(),
    p_dimension: dimension,
    p_limit: limit,
  })

  if (error) {
    console.error('[analytics] breakdown', dimension, error)
    return []
  }
  return (data as AnalyticsRow[]) ?? []
}

export async function getRealtime(): Promise<AnalyticsRealtime> {
  if (previewMode) return fixtureAnalytics.realtime

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('analytics_realtime', {})

  if (error) {
    console.error('[analytics] realtime', error)
    return { active_visitors: 0, views_last_hour: 0, top_now: [], minutes: [] }
  }
  return (data as unknown as AnalyticsRealtime) ?? {
    active_visitors: 0,
    views_last_hour: 0,
    top_now: [],
    minutes: [],
  }
}

export async function getFunnels(range: Range): Promise<AnalyticsFunnels> {
  if (previewMode) return fixtureAnalytics.funnels

  const empty: AnalyticsFunnels = {
    overall: [],
    teaser: { views: 0, signups: 0, rate: 0 },
    forums: [],
    events: [],
    login: { views: 0, requested: 0, rate: 0 },
  }

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('analytics_funnels', {
    p_from: range.from.toISOString(),
    p_to: range.to.toISOString(),
  })

  if (error) {
    console.error('[analytics] funnels', error)
    return empty
  }
  return (data as unknown as AnalyticsFunnels) ?? empty
}

export async function getPeople(range: Range, limit = 25): Promise<AnalyticsPerson[]> {
  if (previewMode) return fixtureAnalytics.people

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('analytics_people', {
    p_from: range.from.toISOString(),
    p_to: range.to.toISOString(),
    p_limit: limit,
  })

  if (error) {
    console.error('[analytics] people', error)
    return []
  }
  return (data as AnalyticsPerson[]) ?? []
}

export async function getPersonTrail(
  profileId: string,
  range: Range,
  limit = 100
): Promise<AnalyticsPersonEvent[]> {
  if (previewMode) return fixtureAnalytics.personTrail

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('analytics_person', {
    p_profile_id: profileId,
    p_from: range.from.toISOString(),
    p_to: range.to.toISOString(),
    p_limit: limit,
  })

  if (error) {
    console.error('[analytics] person', error)
    return []
  }
  return (data as AnalyticsPersonEvent[]) ?? []
}
