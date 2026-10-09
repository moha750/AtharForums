import { QR_TZ } from './config'

/**
 * الوقت بمنطقة الجهة لا بساعة الجهاز.
 *
 * ما يكتبه المستخدم في حقل datetime-local ساعةُ جدار في الرياض، يُحوَّل هنا
 * صراحةً بإزاحة المنطقة عند تلك اللحظة — لا بـ new Date(value) الذي يفسّره
 * بمنطقة الخادم أو المتصفّح أيًّا كانت.
 */

type Parts = { y: number; m: number; d: number; h: number; mi: number; s: number }

const formatters = new Map<string, Intl.DateTimeFormat>()

function formatter(tz: string): Intl.DateTimeFormat {
  let fmt = formatters.get(tz)
  if (!fmt) {
    fmt = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
    formatters.set(tz, fmt)
  }
  return fmt
}

function zonedParts(date: Date, tz: string): Parts {
  const p: Record<string, string> = {}
  for (const part of formatter(tz).formatToParts(date)) p[part.type] = part.value
  return { y: +p.year!, m: +p.month!, d: +p.day!, h: +p.hour! % 24, mi: +p.minute!, s: +p.second! }
}

/** إزاحة المنطقة عن UTC (بالملّي ثانية) عند هذه اللحظة. */
export function zoneOffsetMs(date: Date, tz = QR_TZ): number {
  const p = zonedParts(date, tz)
  const asUtc = Date.UTC(p.y, p.m - 1, p.d, p.h, p.mi, p.s)
  return asUtc - Math.floor(date.getTime() / 1000) * 1000
}

const LOCAL = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?$/

/** ساعة جدار في المنطقة ('YYYY-MM-DD' أو 'YYYY-MM-DDTHH:mm') ← لحظة. */
export function zonedToUtc(local: string, tz = QR_TZ): Date | null {
  const m = LOCAL.exec(local.trim())
  if (!m) return null
  const [y, mo, d, h, mi] = [+m[1]!, +m[2]!, +m[3]!, +(m[4] ?? 0), +(m[5] ?? 0)]
  const wall = Date.UTC(y, mo - 1, d, h, mi)
  const check = new Date(wall)
  if (check.getUTCMonth() !== mo - 1 || check.getUTCDate() !== d || h > 23 || mi > 59) return null
  // مرّتان: الأولى تقدير، والثانية تصحّح عند حدود التوقيت الصيفي إن وُجد
  let t = wall - zoneOffsetMs(new Date(wall), tz)
  t = wall - zoneOffsetMs(new Date(t), tz)
  return new Date(t)
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

/** لحظة ← قيمة حقل datetime-local بساعة المنطقة. */
export function utcToZonedInput(value: string | Date | null | undefined, tz = QR_TZ): string {
  if (!value) return ''
  const date = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(date.getTime())) return ''
  const p = zonedParts(date, tz)
  return `${p.y}-${pad(p.m)}-${pad(p.d)}T${pad(p.h)}:${pad(p.mi)}`
}

/** اليوم ('YYYY-MM-DD') بالمنطقة عند هذه اللحظة. */
export function zonedDay(date: Date = new Date(), tz = QR_TZ): string {
  const p = zonedParts(date, tz)
  return `${p.y}-${pad(p.m)}-${pad(p.d)}`
}

export function addDays(day: string, days: number): string {
  const [y, m, d] = day.split('-').map(Number) as [number, number, number]
  const t = new Date(Date.UTC(y, m - 1, d + days))
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`
}

export function isDay(value: string | undefined | null): value is string {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value) && zonedToUtc(value))
}

/* ── مدى الإحصاء ──────────────────────────────────────────────────────────── */

export const STATS_RANGES = [
  'today',
  'yesterday',
  '7d',
  '90d',
  'month',
  'last-month',
  'year',
  'all',
] as const

export type StatsRangeKey = (typeof STATS_RANGES)[number] | 'custom'

export type StatsRange = {
  key: StatsRangeKey
  /** بداية المدى (داخلة)، أو null = منذ إنشاء الباركود. */
  from: Date | null
  /** نهاية المدى (خارجة)، أو null = حتى الآن. */
  to: Date | null
  fromDay: string | null
  toDay: string | null
}

/**
 * يحلّ المدى من الرابط. المدى المخصّص طرفاه داخلان: من أول يوم «من» إلى
 * آخر لحظة في يوم «إلى»، بمنطقة الجهة.
 */
export function resolveStatsRange(
  params: { range?: string; from?: string; to?: string },
  now: Date = new Date(),
  tz = QR_TZ
): StatsRange {
  const today = zonedDay(now, tz)
  const start = (day: string) => zonedToUtc(day, tz)!
  const make = (key: StatsRangeKey, fromDay: string | null, toDayExclusive: string | null): StatsRange => ({
    key,
    from: fromDay ? start(fromDay) : null,
    to: toDayExclusive ? start(toDayExclusive) : null,
    fromDay,
    toDay: toDayExclusive ? addDays(toDayExclusive, -1) : null,
  })

  if (params.range === 'custom' || (!params.range && (params.from || params.to))) {
    let from = isDay(params.from) ? params.from : null
    let to = isDay(params.to) ? params.to : null
    if (from && to && from > to) [from, to] = [to, from]
    if (from || to) return make('custom', from, to ? addDays(to, 1) : null)
  }

  const [y, m] = today.split('-').map(Number) as [number, number]
  const monthStart = `${y}-${pad(m)}-01`
  const prevMonth = m === 1 ? `${y - 1}-12-01` : `${y}-${pad(m - 1)}-01`

  switch (params.range) {
    case 'today':
      return make('today', today, addDays(today, 1))
    case 'yesterday':
      return make('yesterday', addDays(today, -1), today)
    case '7d':
      return make('7d', addDays(today, -6), addDays(today, 1))
    case '90d':
      return make('90d', addDays(today, -89), addDays(today, 1))
    case 'month':
      return make('month', monthStart, addDays(today, 1))
    case 'last-month':
      return make('last-month', prevMonth, monthStart)
    case 'year':
      return make('year', `${y}-01-01`, addDays(today, 1))
    default:
      return { key: 'all', from: null, to: null, fromDay: null, toDay: null }
  }
}
