import { getTranslations } from 'next-intl/server'
import { ArrowLeft, ArrowRight, CalendarDays, Newspaper } from 'lucide-react'

import { Link } from '@/i18n/navigation'
import { Badge } from '@/components/ui/badge'
import { buttonStyles } from '@/components/ui/button'
import { ForumCard } from '@/components/forums/forum-card'
import {
  getPublishedForums,
  getPlatformStats,
  getUpcomingEvents,
  getPublishedPosts,
} from '@/lib/data'
import { formatDateTime, localized } from '@/lib/utils'
import type { Locale } from '@/i18n/routing'
import type { PublicSettings } from '@/lib/database.types'

export async function HomePage({
  locale,
  settings,
}: {
  locale: Locale
  settings: PublicSettings
}) {
  const t = await getTranslations('home')
  const tForums = await getTranslations('forums')
  const tMeta = await getTranslations('meta')

  const [forums, stats, events, posts] = await Promise.all([
    getPublishedForums(),
    getPlatformStats(),
    getUpcomingEvents(3),
    getPublishedPosts(3),
  ])

  const Arrow = locale === 'en' ? ArrowRight : ArrowLeft
  const featured = forums.slice(0, 6)
  const about = locale === 'en' ? settings.about_en : settings.about_ar

  return (
    <>
      <section className="relative overflow-hidden border-b border-[var(--border)]">
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
          <div className="bg-athar-grid mask-fade-b absolute inset-0 opacity-50" />
          <div className="absolute -top-32 start-1/2 size-[36rem] -translate-x-1/2 rounded-full bg-teal-300/25 blur-3xl dark:bg-teal-700/15 rtl:translate-x-1/2" />
        </div>

        <div className="container-athar py-16 text-center sm:py-24">
          <Badge tone="teal">{t('heroBadge', { branch: tMeta('branchShort') })}</Badge>

          <h1 className="mx-auto mt-6 max-w-3xl text-balance text-3xl font-bold sm:text-5xl">
            <span className="text-athar-gradient">{tMeta('hook')}</span>
          </h1>

          <p className="mx-auto mt-5 max-w-2xl text-pretty leading-relaxed text-[var(--fg-muted)] sm:text-lg">
            {about ?? tMeta('description')}
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link href="/forums" className={buttonStyles('primary', 'lg')}>
              {t('heroCta')}
              <Arrow className="size-4" aria-hidden />
            </Link>
            <Link href="/about" className={buttonStyles('secondary', 'lg')}>
              {t('heroCtaSecondary')}
            </Link>
          </div>

          <dl className="mx-auto mt-12 grid max-w-lg grid-cols-3 gap-4">
            {(
              [
                [stats.forums, t('statsForums')],
                [stats.members, t('statsMembers')],
                [stats.upcoming_events, t('statsEvents')],
              ] as const
            ).map(([value, label]) => (
              <div
                key={label}
                className="rounded-xl bg-[var(--surface)] px-3 py-4 ring-1 ring-[var(--border)]"
              >
                <dt className="sr-only">{label}</dt>
                <dd>
                  <span className="font-latin block text-2xl font-semibold tabular-nums text-[var(--primary)]">
                    {value}
                  </span>
                  <span className="mt-0.5 block text-xs text-[var(--fg-subtle)]">{label}</span>
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section className="container-athar py-16" aria-labelledby="forums-heading">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="forums-heading" className="text-2xl font-semibold sm:text-3xl">
              {t('forumsHeading')}
            </h2>
            <p className="mt-1.5 text-[var(--fg-muted)]">{t('forumsLead')}</p>
          </div>
          <Link
            href="/forums"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--primary)] hover:underline"
          >
            {t('viewAll')}
            <Arrow className="size-4" aria-hidden />
          </Link>
        </div>

        <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {featured.map((forum) => (
            <ForumCard
              key={forum.id}
              forum={forum}
              locale={locale}
              membersLabel={tForums('members', { count: forum.members_count })}
            />
          ))}
        </div>
      </section>

      <section className="container-athar grid gap-10 pb-8 lg:grid-cols-2">
        <div aria-labelledby="events-heading">
          <h2 id="events-heading" className="flex items-center gap-2 text-xl font-semibold">
            <CalendarDays className="size-5 text-[var(--primary)]" aria-hidden />
            {t('eventsHeading')}
          </h2>
          <div className="mt-4 space-y-3">
            {events.length === 0 ? (
              <p className="rounded-xl bg-[var(--bg-subtle)] px-4 py-5 text-sm text-[var(--fg-subtle)]">
                {t('eventsEmpty')}
              </p>
            ) : (
              events.map((event) => (
                <Link
                  key={event.id}
                  href={`/events/${event.slug}`}
                  className="block rounded-xl bg-[var(--surface)] p-4 ring-1 ring-[var(--border)] transition-shadow hover:shadow-[var(--shadow-soft)]"
                >
                  <p className="text-xs text-[var(--fg-subtle)]">
                    {formatDateTime(event.starts_at, locale)}
                  </p>
                  <p className="mt-1 font-medium">{localized(event, 'title', locale)}</p>
                </Link>
              ))
            )}
          </div>
        </div>

        <div aria-labelledby="news-heading">
          <h2 id="news-heading" className="flex items-center gap-2 text-xl font-semibold">
            <Newspaper className="size-5 text-[var(--primary)]" aria-hidden />
            {t('newsHeading')}
          </h2>
          <div className="mt-4 space-y-3">
            {posts.length === 0 ? (
              <p className="rounded-xl bg-[var(--bg-subtle)] px-4 py-5 text-sm text-[var(--fg-subtle)]">
                {t('newsEmpty')}
              </p>
            ) : (
              posts.map((post) => (
                <Link
                  key={post.id}
                  href={`/news/${post.slug}`}
                  className="block rounded-xl bg-[var(--surface)] p-4 ring-1 ring-[var(--border)] transition-shadow hover:shadow-[var(--shadow-soft)]"
                >
                  <p className="font-medium">{localized(post, 'title', locale)}</p>
                  {localized(post, 'excerpt', locale) ? (
                    <p className="mt-1 line-clamp-2 text-sm text-[var(--fg-muted)]">
                      {localized(post, 'excerpt', locale)}
                    </p>
                  ) : null}
                </Link>
              ))
            )}
          </div>
        </div>
      </section>
    </>
  )
}
