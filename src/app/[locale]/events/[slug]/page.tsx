import { notFound } from 'next/navigation'
import { CalendarDays, Clock, ExternalLink, MapPin, Users, Video } from 'lucide-react'
import { getTranslations, setRequestLocale } from 'next-intl/server'

import { SiteShell } from '@/components/site/site-shell'
import { Link } from '@/i18n/navigation'
import { Badge } from '@/components/ui/badge'
import { Button, buttonStyles } from '@/components/ui/button'
import { registerForEvent, cancelEventRegistration } from '@/actions/events'
import { getEventBySlug, getForumsById } from '@/lib/data'
import { getCurrentProfile } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { requireLaunched } from '@/lib/gate'
import { formatDateTime, localized } from '@/lib/utils'
import { isLocale } from '@/i18n/routing'

export const dynamic = 'force-dynamic'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>
}) {
  const { locale, slug } = await params
  if (!isLocale(locale)) return {}
  const event = await getEventBySlug(slug)
  if (!event) return {}
  return {
    title: localized(event, 'title', locale),
    description: localized(event, 'description', locale).slice(0, 180),
  }
}

export default async function EventPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>
}) {
  const { locale, slug } = await params
  if (!isLocale(locale)) notFound()
  setRequestLocale(locale)

  const settings = await requireLaunched(locale)
  const event = await getEventBySlug(slug)
  if (!event || event.status !== 'published') notFound()

  const [t, tNav, profile, forums] = await Promise.all([
    getTranslations('events'),
    getTranslations('nav'),
    getCurrentProfile(),
    getForumsById(event.forum_id ? [event.forum_id] : []),
  ])

  const forum = event.forum_id ? forums.get(event.forum_id) : undefined

  let registered = false
  if (profile) {
    const supabase = await createClient()
    const { data } = await supabase
      .from('event_registrations')
      .select('status')
      .eq('event_id', event.id)
      .eq('profile_id', profile.id)
      .maybeSingle()
    registered = (data as { status: string } | null)?.status === 'registered'
  }

  const seatsLeft = event.capacity === null ? null : event.capacity - event.registrations_count
  const full = seatsLeft !== null && seatsLeft <= 0
  const ModeIcon = event.mode === 'online' ? Video : MapPin
  const modeLabel =
    event.mode === 'online' ? t('online') : event.mode === 'hybrid' ? t('hybrid') : t('onsite')

  return (
    <SiteShell locale={locale} settings={settings}>
      <div className="container-athar py-12 sm:py-16">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <article>
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="teal">{modeLabel}</Badge>
              {event.members_only ? <Badge tone="warning">{t('membersOnly')}</Badge> : null}
              {forum ? (
                <Link
                  href={`/forums/${forum.slug}`}
                  className="text-sm text-[var(--primary)] hover:underline"
                >
                  {localized(forum, 'name', locale)}
                </Link>
              ) : null}
            </div>

            <h1 className="mt-4 text-3xl font-bold sm:text-4xl">
              {localized(event, 'title', locale)}
            </h1>

            {localized(event, 'description', locale) ? (
              <p className="mt-5 whitespace-pre-line leading-relaxed text-[var(--fg-muted)]">
                {localized(event, 'description', locale)}
              </p>
            ) : null}
          </article>

          <aside className="lg:sticky lg:top-24 lg:self-start">
            <div className="space-y-4 rounded-2xl bg-[var(--surface)] p-5 shadow-[var(--shadow-soft)] ring-1 ring-[var(--border)]">
              <dl className="space-y-3 text-sm">
                <div className="flex gap-2.5">
                  <CalendarDays className="mt-0.5 size-4 shrink-0 text-[var(--primary)]" aria-hidden />
                  <div>
                    <dt className="text-xs text-[var(--fg-subtle)]">{t('whenHeading')}</dt>
                    <dd className="font-medium">{formatDateTime(event.starts_at, locale)}</dd>
                    {event.ends_at ? (
                      <dd className="mt-0.5 inline-flex items-center gap-1 text-xs text-[var(--fg-subtle)]">
                        <Clock className="size-3" aria-hidden />
                        {formatDateTime(event.ends_at, locale)}
                      </dd>
                    ) : null}
                  </div>
                </div>

                {localized(event, 'location', locale) || event.mode === 'online' ? (
                  <div className="flex gap-2.5">
                    <ModeIcon className="mt-0.5 size-4 shrink-0 text-[var(--primary)]" aria-hidden />
                    <div>
                      <dt className="text-xs text-[var(--fg-subtle)]">{t('whereHeading')}</dt>
                      <dd className="font-medium">
                        {localized(event, 'location', locale) || modeLabel}
                      </dd>
                    </div>
                  </div>
                ) : null}

                {seatsLeft !== null ? (
                  <div className="flex gap-2.5">
                    <Users className="mt-0.5 size-4 shrink-0 text-[var(--primary)]" aria-hidden />
                    <div>
                      <dt className="text-xs text-[var(--fg-subtle)]">{t('seats', { count: Math.max(0, seatsLeft) })}</dt>
                    </div>
                  </div>
                ) : null}
              </dl>

              <div className="border-t border-[var(--border)] pt-4">
                {!profile ? (
                  <Link
                    href={`/login?next=/${locale}/events/${slug}`}
                    className={`${buttonStyles('primary', 'md')} w-full`}
                  >
                    {tNav('login')}
                  </Link>
                ) : registered ? (
                  <form action={cancelEventRegistration} className="space-y-2">
                    <input type="hidden" name="eventId" value={event.id} />
                    <input type="hidden" name="slug" value={event.slug} />
                    <p className="rounded-lg bg-[var(--success-soft)] px-3 py-2 text-center text-sm text-[var(--success)]">
                      {t('registered')}
                    </p>
                    <Button type="submit" variant="ghost" size="sm" className="w-full">
                      {t('cancel')}
                    </Button>
                  </form>
                ) : !event.registration_open ? (
                  <p className="rounded-lg bg-[var(--bg-subtle)] px-3 py-2 text-center text-sm text-[var(--fg-subtle)]">
                    {t('closed')}
                  </p>
                ) : full ? (
                  <p className="rounded-lg bg-[var(--warning-soft)] px-3 py-2 text-center text-sm text-[var(--warning)]">
                    {t('full')}
                  </p>
                ) : (
                  <form action={registerForEvent}>
                    <input type="hidden" name="eventId" value={event.id} />
                    <input type="hidden" name="slug" value={event.slug} />
                    <Button type="submit" className="w-full">
                      {t('register')}
                    </Button>
                  </form>
                )}

                {registered && event.meeting_url ? (
                  <a
                    href={event.meeting_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`${buttonStyles('secondary', 'sm')} mt-2 w-full`}
                  >
                    <ExternalLink className="size-4" aria-hidden />
                    {t('joinLink')}
                  </a>
                ) : null}
              </div>
            </div>
          </aside>
        </div>
      </div>
    </SiteShell>
  )
}
