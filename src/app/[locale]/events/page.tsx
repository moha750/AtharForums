import { notFound } from 'next/navigation'
import { getTranslations, setRequestLocale } from 'next-intl/server'

import { SiteShell } from '@/components/site/site-shell'
import { EventCard } from '@/components/events/event-card'
import { getForumsById, getPastEvents, getUpcomingEvents } from '@/lib/data'
import { requireLaunched } from '@/lib/gate'
import { isLocale } from '@/i18n/routing'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  if (!isLocale(locale)) return {}
  const t = await getTranslations({ locale, namespace: 'events' })
  return { title: t('heading'), description: t('lead') }
}

export default async function EventsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  setRequestLocale(locale)

  const settings = await requireLaunched(locale)
  const [t, upcoming, past] = await Promise.all([
    getTranslations('events'),
    getUpcomingEvents(24),
    getPastEvents(12),
  ])
  const forums = await getForumsById(
    [...upcoming, ...past].map((e) => e.forum_id).filter((id): id is string => Boolean(id))
  )

  const modeLabel = (mode: string) =>
    mode === 'online' ? t('online') : mode === 'hybrid' ? t('hybrid') : t('onsite')

  return (
    <SiteShell locale={locale} settings={settings}>
      <div className="container-athar py-12 sm:py-16">
        <header className="max-w-2xl">
          <h1 className="text-3xl font-bold sm:text-4xl">{t('heading')}</h1>
          <p className="mt-3 leading-relaxed text-[var(--fg-muted)]">{t('lead')}</p>
        </header>

        <section className="mt-10" aria-labelledby="upcoming-heading">
          <h2 id="upcoming-heading" className="text-xl font-semibold">
            {t('upcoming')}
          </h2>
          {upcoming.length === 0 ? (
            <p className="mt-4 rounded-xl bg-[var(--bg-subtle)] px-4 py-8 text-center text-sm text-[var(--fg-subtle)]">
              {t('empty')}
            </p>
          ) : (
            <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {upcoming.map((event) => (
                <EventCard
                  key={event.id}
                  event={event}
                  forum={event.forum_id ? forums.get(event.forum_id) : undefined}
                  locale={locale}
                  modeLabel={modeLabel(event.mode)}
                />
              ))}
            </div>
          )}
        </section>

        {past.length > 0 ? (
          <section className="mt-14" aria-labelledby="past-heading">
            <h2 id="past-heading" className="text-xl font-semibold">
              {t('past')}
            </h2>
            <div className="mt-5 grid gap-4 opacity-80 sm:grid-cols-2 lg:grid-cols-3">
              {past.map((event) => (
                <EventCard
                  key={event.id}
                  event={event}
                  forum={event.forum_id ? forums.get(event.forum_id) : undefined}
                  locale={locale}
                  modeLabel={modeLabel(event.mode)}
                />
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </SiteShell>
  )
}
