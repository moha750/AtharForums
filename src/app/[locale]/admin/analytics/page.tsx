import { notFound } from 'next/navigation'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { ShieldCheck, UsersRound } from 'lucide-react'

import { Link } from '@/i18n/navigation'
import { isLocale, localeDirection, type Locale } from '@/i18n/routing'
import { getCurrentProfile } from '@/lib/auth'
import { localized } from '@/lib/utils'
import {
  getBreakdown,
  getFunnels,
  getOverview,
  getRealtime,
  getTimeseries,
  resolveRange,
} from '@/lib/analytics/queries'
import { StatTile, formatDuration } from '@/components/admin/analytics/stat-tile'
import { TrendChart } from '@/components/admin/analytics/trend-chart'
import { BreakdownList } from '@/components/admin/analytics/breakdown-list'
import { RealtimeCard } from '@/components/admin/analytics/realtime-card'
import { FunnelCard, FunnelRow } from '@/components/admin/analytics/funnel-card'
import { RangeTabs } from '@/components/admin/analytics/range-tabs'
import type { TrendPoint } from '@/components/admin/analytics/trend-chart'

export const dynamic = 'force-dynamic'

export default async function AnalyticsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ range?: string }>
}) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  setRequestLocale(locale)

  const { range: rangeParam } = await searchParams
  const range = resolveRange(rangeParam)
  const rtl = localeDirection[locale as Locale] === 'rtl'

  const [t, profile] = await Promise.all([getTranslations('analytics'), getCurrentProfile()])

  const [overview, timeseries, realtime, funnels, pages, entries, referrers, campaigns, devices, browsers, systems, countries, locales] =
    await Promise.all([
      getOverview(range),
      getTimeseries(range),
      getRealtime(),
      getFunnels(range),
      getBreakdown(range, 'path', 8),
      getBreakdown(range, 'entry_path', 6),
      getBreakdown(range, 'referrer_host', 6),
      getBreakdown(range, 'utm_campaign', 6),
      getBreakdown(range, 'device', 4),
      getBreakdown(range, 'browser', 5),
      getBreakdown(range, 'os', 5),
      getBreakdown(range, 'country', 6),
      getBreakdown(range, 'locale', 2),
    ])

  // التنسيق على الخادم: انظر التعليق في TrendChart — اختلاف بيانات ICU بين
  // Node والمتصفّح يكسر الترطيب لو نُسّق التاريخ في المتصفّح.
  const bucketFormatter = new Intl.DateTimeFormat(
    locale === 'en' ? 'en-GB' : 'ar-SA-u-nu-latn',
    range.bucket === 'hour'
      ? { hour: 'numeric', timeZone: 'Asia/Riyadh' }
      : { day: 'numeric', month: 'short', timeZone: 'Asia/Riyadh' }
  )

  const trendPoints: TrendPoint[] = timeseries.map((point) => ({
    ...point,
    label: bucketFormatter.format(new Date(point.bucket)),
  }))

  const { current, previous } = overview
  const comparison = t('vsPrevious')
  const empty = t('noData')

  const rangeOptions = [
    { value: 'today', label: t('rangeToday') },
    { value: '7d', label: t('range7d') },
    { value: '30d', label: t('range30d') },
    { value: '90d', label: t('range90d') },
  ]

  const deviceLabel = (value: string) =>
    ({
      desktop: t('deviceDesktop'),
      mobile: t('deviceMobile'),
      tablet: t('deviceTablet'),
      bot: t('deviceBot'),
      unknown: t('deviceUnknown'),
    })[value] ?? value

  const localeLabel = (value: string) =>
    value === 'ar' ? t('localeAr') : value === 'en' ? t('localeEn') : value

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{t('heading')}</h1>
          <p className="mt-1 text-sm text-[var(--fg-muted)]">{t('subheading')}</p>
        </div>
        <RangeTabs options={rangeOptions} current={range.key} />
      </header>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <StatTile
            label={t('kpiVisitors')}
            value={current.visitors}
            previous={previous.visitors}
            comparisonLabel={comparison}
          />
          <StatTile
            label={t('kpiVisits')}
            value={current.visits}
            previous={previous.visits}
            comparisonLabel={comparison}
          />
          <StatTile
            label={t('kpiPageviews')}
            value={current.pageviews}
            previous={previous.pageviews}
            comparisonLabel={comparison}
          />
          <StatTile
            label={t('kpiBounce')}
            value={current.bounce_rate}
            previous={previous.bounce_rate}
            suffix="%"
            higherIsBetter={false}
            comparisonLabel={comparison}
          />
          <StatTile
            label={t('kpiDuration')}
            value={current.avg_duration_s}
            previous={previous.avg_duration_s}
            comparisonLabel={comparison}
            hint={formatDuration(current.avg_duration_s)}
          />
          <StatTile
            label={t('kpiConversions')}
            value={current.conversions}
            previous={previous.conversions}
            comparisonLabel={comparison}
          />
        </div>

        <RealtimeCard
          data={realtime}
          labels={{
            now: t('rtNow'),
            lastHour: t('rtLastHour'),
            topNow: t('rtTopNow'),
            none: t('rtNone'),
            minutes: t('rtMinutes'),
          }}
        />
      </div>

      <section className="rounded-2xl bg-[var(--surface)] p-5 ring-1 ring-[var(--border)]">
        <h2 className="text-sm font-semibold">{t('trendTitle')}</h2>
        <div className="mt-3">
          <TrendChart
            points={trendPoints}
            rtl={rtl}
            labels={{
              visitors: t('kpiVisitors'),
              pageviews: t('kpiPageviews'),
              empty,
            }}
          />
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        <FunnelCard title={t('funnelKeyTitle')} description={t('funnelKeyDesc')}>
          <FunnelRow
            label={t('funnelTeaser')}
            views={funnels.teaser.views}
            completions={funnels.teaser.signups}
            rate={funnels.teaser.rate}
            labels={{ views: t('funnelViews'), completed: t('funnelDone') }}
          />
          <FunnelRow
            label={t('funnelLogin')}
            views={funnels.login.views}
            completions={funnels.login.requested}
            rate={funnels.login.rate}
            labels={{ views: t('funnelViews'), completed: t('funnelDone') }}
          />
        </FunnelCard>

        <FunnelCard title={t('funnelForumsTitle')} description={t('funnelForumsDesc')}>
          {funnels.forums.length === 0 ? (
            <li className="py-6 text-center text-sm text-[var(--fg-subtle)]">{empty}</li>
          ) : (
            funnels.forums.map((forum) => (
              <FunnelRow
                key={forum.slug}
                label={localized(forum, 'name', locale)}
                views={forum.views}
                completions={forum.requests}
                labels={{ views: t('funnelViews'), completed: t('funnelJoined') }}
              />
            ))
          )}
        </FunnelCard>

        <FunnelCard title={t('funnelEventsTitle')} description={t('funnelEventsDesc')}>
          {funnels.events.length === 0 ? (
            <li className="py-6 text-center text-sm text-[var(--fg-subtle)]">{empty}</li>
          ) : (
            funnels.events.map((event) => (
              <FunnelRow
                key={event.slug}
                label={localized(event, 'title', locale)}
                views={event.views}
                completions={event.registrations}
                labels={{ views: t('funnelViews'), completed: t('funnelRegistered') }}
              />
            ))
          )}
        </FunnelCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <BreakdownList
          title={t('breakdownPages')}
          rows={pages}
          valueLabel={t('colViews')}
          emptyLabel={empty}
        />
        <BreakdownList
          title={t('breakdownEntry')}
          rows={entries}
          valueLabel={t('colViews')}
          emptyLabel={empty}
        />
        <BreakdownList
          title={t('breakdownReferrers')}
          rows={referrers}
          valueLabel={t('colViews')}
          emptyLabel={empty}
        />
        <BreakdownList
          title={t('breakdownCampaigns')}
          rows={campaigns}
          valueLabel={t('colViews')}
          emptyLabel={empty}
        />
        <BreakdownList
          title={t('breakdownDevices')}
          rows={devices}
          valueLabel={t('colViews')}
          emptyLabel={empty}
          formatLabel={deviceLabel}
        />
        <BreakdownList
          title={t('breakdownBrowsers')}
          rows={browsers}
          valueLabel={t('colViews')}
          emptyLabel={empty}
        />
        <BreakdownList
          title={t('breakdownSystems')}
          rows={systems}
          valueLabel={t('colViews')}
          emptyLabel={empty}
        />
        <BreakdownList
          title={t('breakdownCountries')}
          rows={countries}
          valueLabel={t('colViews')}
          emptyLabel={empty}
        />
        <BreakdownList
          title={t('breakdownLocales')}
          rows={locales}
          valueLabel={t('colViews')}
          emptyLabel={empty}
          formatLabel={localeLabel}
        />
      </div>

      <section className="rounded-2xl bg-[var(--bg-subtle)] p-5 ring-1 ring-[var(--border)]">
        <h2 className="inline-flex items-center gap-2 text-sm font-semibold">
          <ShieldCheck className="size-4 text-[var(--primary)]" aria-hidden />
          {t('privacyTitle')}
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-[var(--fg-muted)]">
          {t('privacyBody')}
        </p>

        {profile?.role === 'super_admin' ? (
          <Link
            href={`/admin/analytics/people?range=${range.key}`}
            className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-[var(--primary)] hover:underline"
          >
            <UsersRound className="size-4" aria-hidden />
            {t('peopleLink')}
          </Link>
        ) : (
          <p className="mt-3 text-xs text-[var(--fg-subtle)]">{t('peopleRestricted')}</p>
        )}
      </section>
    </div>
  )
}
