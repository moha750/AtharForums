import { notFound } from 'next/navigation'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { ArrowLeft, ArrowRight, ShieldAlert } from 'lucide-react'

import { Link } from '@/i18n/navigation'
import { isLocale } from '@/i18n/routing'
import { getCurrentProfile } from '@/lib/auth'
import { formatDateTime } from '@/lib/utils'
import { getPeople, getPersonTrail, resolveRange } from '@/lib/analytics/queries'
import { RangeTabs } from '@/components/admin/analytics/range-tabs'

export const dynamic = 'force-dynamic'

/**
 * سلوك الأفراد — شاشة مقصورة على «المشرف الأعلى».
 *
 * فُصلت عن اللوحة عمدًا: الأرقام المجمّعة يراها كل مشرف، وأسماء الموظفين لا.
 * وكل فتح لهذه الصفحة يُكتب في سجلّ التدقيق داخل قاعدة البيانات — فمن يطّلع
 * على سلوك زميله يُعرف أنه اطّلع. الرقابة على الرقيب جزء من تصميم النظام.
 */

export default async function AnalyticsPeoplePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ range?: string; person?: string }>
}) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  setRequestLocale(locale)

  const { range: rangeParam, person } = await searchParams
  const range = resolveRange(rangeParam)

  const [t, profile] = await Promise.all([getTranslations('analytics'), getCurrentProfile()])
  const Back = locale === 'en' ? ArrowLeft : ArrowRight

  if (profile?.role !== 'super_admin') {
    return (
      <div className="rounded-2xl bg-[var(--surface)] p-8 text-center ring-1 ring-[var(--border)]">
        <ShieldAlert className="mx-auto size-6 text-[var(--warning)]" aria-hidden />
        <p className="mt-3 text-sm text-[var(--fg-muted)]">{t('peopleRestricted')}</p>
        <Link
          href="/admin/analytics"
          className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-[var(--primary)] hover:underline"
        >
          <Back className="size-4" aria-hidden />
          {t('backToAnalytics')}
        </Link>
      </div>
    )
  }

  const people = await getPeople(range, 50)
  const trail = person ? await getPersonTrail(person, range, 100) : []
  const selected = people.find((row) => row.profile_id === person)

  const rangeOptions = [
    { value: 'today', label: t('rangeToday') },
    { value: '7d', label: t('range7d') },
    { value: '30d', label: t('range30d') },
    { value: '90d', label: t('range90d') },
  ]

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link
            href="/admin/analytics"
            className="inline-flex items-center gap-1.5 text-xs text-[var(--fg-muted)] hover:text-[var(--fg)]"
          >
            <Back className="size-3.5" aria-hidden />
            {t('backToAnalytics')}
          </Link>
          <h1 className="mt-1 text-2xl font-semibold">{t('peopleTitle')}</h1>
        </div>
        <RangeTabs options={rangeOptions} current={range.key} />
      </header>

      <p className="rounded-2xl bg-[var(--warning-soft)] p-4 text-sm leading-relaxed text-[var(--warning)] ring-1 ring-[var(--border)]">
        {t('peopleNotice')}
      </p>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <section className="overflow-hidden rounded-2xl bg-[var(--surface)] ring-1 ring-[var(--border)]">
          <table className="w-full text-sm">
            <thead className="bg-[var(--bg-subtle)] text-xs text-[var(--fg-muted)]">
              <tr>
                <th className="px-4 py-3 text-start font-medium">{t('colPerson')}</th>
                <th className="px-4 py-3 text-start font-medium">{t('colVisits')}</th>
                <th className="px-4 py-3 text-start font-medium">{t('colViews')}</th>
                <th className="px-4 py-3 text-start font-medium">{t('colLastSeen')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {people.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-[var(--fg-subtle)]">
                    {t('noData')}
                  </td>
                </tr>
              ) : (
                people.map((row) => (
                  <tr
                    key={row.profile_id}
                    className={row.profile_id === person ? 'bg-[var(--primary-soft)]' : undefined}
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/analytics/people?range=${range.key}&person=${row.profile_id}`}
                        className="font-medium hover:underline"
                      >
                        {row.full_name}
                      </Link>
                      <p className="font-latin text-xs text-[var(--fg-subtle)]">{row.email}</p>
                    </td>
                    <td className="font-latin px-4 py-3 tabular-nums">{row.visits}</td>
                    <td className="font-latin px-4 py-3 tabular-nums">{row.pageviews}</td>
                    <td className="px-4 py-3 text-xs text-[var(--fg-muted)]">
                      {formatDateTime(row.last_seen, locale)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </section>

        <section className="rounded-2xl bg-[var(--surface)] p-5 ring-1 ring-[var(--border)]">
          <h2 className="text-sm font-semibold">
            {selected ? t('trailTitleFor', { name: selected.full_name }) : t('trailTitle')}
          </h2>

          {!person ? (
            <p className="mt-6 text-center text-sm text-[var(--fg-subtle)]">{t('trailHint')}</p>
          ) : trail.length === 0 ? (
            <p className="mt-6 text-center text-sm text-[var(--fg-subtle)]">{t('noData')}</p>
          ) : (
            <ol className="mt-4 space-y-3">
              {trail.map((event, index) => (
                <li key={`${event.occurred_at}-${index}`} className="flex items-baseline gap-3">
                  <span className="font-latin w-28 shrink-0 text-xs tabular-nums text-[var(--fg-subtle)]">
                    {formatDateTime(event.occurred_at, locale)}
                  </span>
                  <bdi className="min-w-0 flex-1 truncate text-sm" title={event.path}>
                    {event.path}
                  </bdi>
                  {event.duration_ms ? (
                    <span className="font-latin shrink-0 text-xs tabular-nums text-[var(--fg-muted)]">
                      {Math.round(event.duration_ms / 1000)}s
                    </span>
                  ) : null}
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
    </div>
  )
}
