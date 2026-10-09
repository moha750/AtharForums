import { getTranslations, setRequestLocale } from 'next-intl/server'

import { Link } from '@/i18n/navigation'
import { localeDirection, type Locale } from '@/i18n/routing'
import { BreakdownList } from '@/components/admin/analytics/breakdown-list'
import { StatTile } from '@/components/admin/analytics/stat-tile'
import { RangeFilter } from '@/components/qr/range-filter'
import { Heatmap, HoursChart, SeriesChart } from '@/components/qr/stats-charts'
import { Notice } from '@/components/qr/ui'
import { getLink, linkStats } from '@/lib/qr/server'
import { QR_TZ } from '@/lib/qr/config'
import { resolveStatsRange } from '@/lib/qr/time'
import { formatDateTime } from '@/lib/utils'

export const dynamic = 'force-dynamic'

const DEVICES = ['mobile', 'tablet', 'desktop', 'unknown'] as const

export default async function QrStatsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; id: string }>
  searchParams: Promise<{ range?: string; from?: string; to?: string }>
}) {
  const { locale, id } = await params
  setRequestLocale(locale)
  const query = await searchParams

  const [t, found] = await Promise.all([getTranslations('qr'), getLink(id)])
  if (!found) {
    return <p className="rounded-xl bg-[var(--surface)] p-8 text-center ring-1 ring-[var(--border)]">{t('notFound')}</p>
  }

  const range = resolveStatsRange(query)
  const stats = await linkStats(id, range.from, range.to)
  const { link } = found
  const rtl = localeDirection[locale as Locale] === 'rtl'
  const intl = locale === 'en' ? 'en-GB' : 'ar-SA-u-nu-latn'

  const dayFormat = new Intl.DateTimeFormat(intl, { day: 'numeric', month: 'short', timeZone: 'UTC' })
  const series = (stats?.series ?? []).map((p) => ({
    key: p.d,
    label: dayFormat.format(new Date(`${p.d}T00:00:00Z`)),
    value: p.n,
  }))

  const humanTotal = DEVICES.reduce((sum, d) => sum + (stats?.devices[d] ?? 0), 0)
  const deviceRows = DEVICES.filter((d) => (stats?.devices[d] ?? 0) > 0)
    .map((d) => {
      const n = stats?.devices[d] ?? 0
      return { label: t(`stats.${d}`), visits: n, pageviews: n, visitors: n, share: humanTotal ? Math.round((n / humanTotal) * 1000) / 10 : 0 }
    })
    .sort((a, b) => b.pageviews - a.pageviews)

  // الأحد أولًا: أسبوع الجهة يبدأ الأحد، وextract(dow) في القاعدة يبدأ به
  const weekdays = Array.from({ length: 7 }, (_, d) =>
    new Intl.DateTimeFormat(intl, { weekday: 'long', timeZone: 'UTC' }).format(new Date(Date.UTC(2026, 0, 4 + d)))
  )

  return (
    <div className="space-y-6">
      <header className="space-y-4">
        <Link href={`/qr/${id}`} className="text-sm text-[var(--fg-subtle)] hover:text-[var(--fg)]">
          ← {link.title}
        </Link>
        <h1 className="text-2xl font-semibold">{t('stats.title', { title: link.title })}</h1>
        <RangeFilter current={range.key} from={range.fromDay} to={range.toDay} />
      </header>

      {!stats ? (
        <p className="rounded-xl bg-[var(--surface)] p-8 text-center text-[var(--fg-muted)] ring-1 ring-[var(--border)]">
          {t('errors.generic')}
        </p>
      ) : (
        <>
          {stats.capped ? <Notice tone="warning">{t('stats.capped', { cap: stats.cap.toLocaleString('en-US') })}</Notice> : null}

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatTile label={t('stats.total')} value={stats.total} hint={t('stats.range') + ': ' + t(`stats.${range.key}`)} />
            <StatTile
              label={t('stats.thisWeek')}
              value={stats.week.current}
              previous={stats.week.previous}
              comparisonLabel={t('stats.vsPrevWeek')}
              hint={t('stats.vsPrevWeek') + ': ' + stats.week.previous}
            />
            <div className="rounded-2xl bg-[var(--surface)] p-5 ring-1 ring-[var(--border)]">
              <p className="text-sm text-[var(--fg-muted)]">{t('stats.first')}</p>
              <p className="mt-2 font-medium">{stats.first ? formatDateTime(stats.first, locale) : t('stats.none')}</p>
              <p className="mt-3 text-sm text-[var(--fg-muted)]">{t('stats.last')}</p>
              <p className="mt-1 font-medium">{stats.last ? formatDateTime(stats.last, locale) : t('stats.none')}</p>
            </div>
            <div className="rounded-2xl bg-[var(--surface)] p-5 text-sm leading-relaxed text-[var(--fg-muted)] ring-1 ring-[var(--border)]">
              <p>{t('stats.bots', { count: stats.bots })}</p>
              <p className="mt-2 text-xs text-[var(--fg-subtle)]">{t('stats.noUnique')}</p>
            </div>
          </div>

          <section className="rounded-2xl bg-[var(--surface)] p-5 ring-1 ring-[var(--border)]">
            <h2 className="text-sm font-semibold">{stats.bucket === 'week' ? t('stats.seriesWeekly') : t('stats.series')}</h2>
            {stats.total === 0 ? (
              <p className="py-12 text-center text-sm text-[var(--fg-subtle)]">{t('stats.noData')}</p>
            ) : (
              <div className="mt-3">
                <SeriesChart points={series} rtl={rtl} label={stats.bucket === 'week' ? t('stats.seriesWeekly') : t('stats.series')} />
              </div>
            )}
          </section>

          <div className="grid gap-4 lg:grid-cols-[20rem_minmax(0,1fr)]">
            <BreakdownList
              title={t('stats.devices')}
              rows={deviceRows}
              valueLabel={t('stats.countLabel')}
              emptyLabel={t('stats.noData')}
            />
            <section className="rounded-2xl bg-[var(--surface)] p-5 ring-1 ring-[var(--border)]">
              <h2 className="text-sm font-semibold">
                {t('stats.hours')} <span className="font-normal text-[var(--fg-subtle)]">· {QR_TZ}</span>
              </h2>
              <div className="mt-4">
                <HoursChart hours={stats.hours} label={t('stats.hours')} hourLabel={(h) => t('stats.hourLabel', { hour: h })} />
              </div>
            </section>
          </div>

          <section className="rounded-2xl bg-[var(--surface)] p-5 ring-1 ring-[var(--border)]">
            <h2 className="text-sm font-semibold">{t('stats.heatmap')}</h2>
            <div className="mt-4">
              <Heatmap
                grid={stats.heatmap}
                days={weekdays}
                label={t('stats.heatmap')}
                cellLabel={(day, hour, value) => `${day} · ${t('stats.hourLabel', { hour })}: ${value}`}
              />
            </div>
          </section>
        </>
      )}
    </div>
  )
}
