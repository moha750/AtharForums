import { notFound } from 'next/navigation'
import { CalendarDays, LogOut } from 'lucide-react'
import { getTranslations, setRequestLocale } from 'next-intl/server'

import { SiteShell } from '@/components/site/site-shell'
import { Link, redirect } from '@/i18n/navigation'
import { Badge } from '@/components/ui/badge'
import { Button, buttonStyles } from '@/components/ui/button'
import { ProfileForm } from '@/components/dashboard/profile-form'
import { signOut } from '@/actions/auth'
import { getCurrentProfile, displayName } from '@/lib/auth'
import { getMyMemberships, getMyEventRegistrations } from '@/lib/data'
import { getPublicSettings } from '@/lib/settings'
import { formatDateTime, localized } from '@/lib/utils'
import { isLocale } from '@/i18n/routing'
import type { MembershipStatus } from '@/lib/database.types'

export const dynamic = 'force-dynamic'

const STATUS_TONE: Record<MembershipStatus, 'success' | 'warning' | 'danger' | 'neutral'> = {
  approved: 'success',
  pending: 'warning',
  rejected: 'danger',
  withdrawn: 'neutral',
  removed: 'neutral',
}

export default async function DashboardPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  setRequestLocale(locale)

  const profile = await getCurrentProfile()
  if (!profile) {
    redirect({ href: '/login', locale })
    return null
  }

  const [t, tNav, settings, memberships, registrations] = await Promise.all([
    getTranslations('dashboard'),
    getTranslations('nav'),
    getPublicSettings(),
    getMyMemberships(),
    getMyEventRegistrations(),
  ])

  const statusLabel = (status: MembershipStatus) =>
    ({
      approved: t('statusApproved'),
      pending: t('statusPending'),
      rejected: t('statusRejected'),
      withdrawn: t('statusWithdrawn'),
      removed: t('statusRemoved'),
    })[status]

  return (
    <SiteShell locale={locale} settings={settings}>
      <div className="container-athar py-12 sm:py-16">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">{t('heading')}</h1>
            <p className="mt-1.5 text-[var(--fg-muted)]">
              {t('welcome', { name: displayName(profile, locale) })}
            </p>
          </div>
          <form action={signOut}>
            <Button type="submit" variant="ghost" size="sm">
              <LogOut className="size-4" aria-hidden />
              {tNav('logout')}
            </Button>
          </form>
        </header>

        <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <section aria-labelledby="profile-heading">
            <h2 id="profile-heading" className="text-xl font-semibold">
              {t('profileHeading')}
            </h2>
            <p className="mt-1 text-sm text-[var(--fg-subtle)]" dir="ltr">
              {profile.email}
            </p>
            <div className="mt-5 rounded-2xl bg-[var(--surface)] p-5 ring-1 ring-[var(--border)] sm:p-6">
              <ProfileForm profile={profile} />
            </div>
          </section>

          <aside className="space-y-8">
            <section aria-labelledby="my-forums">
              <h2 id="my-forums" className="text-lg font-semibold">
                {t('myForumsHeading')}
              </h2>
              {memberships.length === 0 ? (
                <div className="mt-3 rounded-xl bg-[var(--bg-subtle)] p-4 text-sm">
                  <p className="text-[var(--fg-subtle)]">{t('myForumsEmpty')}</p>
                  <Link href="/forums" className={`${buttonStyles('primary', 'sm')} mt-3 w-full`}>
                    {t('browseForums')}
                  </Link>
                </div>
              ) : (
                <ul className="mt-3 space-y-2.5">
                  {memberships.map((m) => (
                    <li key={m.id}>
                      <Link
                        href={`/forums/${m.forums.slug}`}
                        className="flex items-center justify-between gap-3 rounded-xl bg-[var(--surface)] p-3.5 ring-1 ring-[var(--border)] transition-shadow hover:shadow-[var(--shadow-soft)]"
                      >
                        <span className="min-w-0 truncate text-sm font-medium">
                          {localized(m.forums, 'name', locale)}
                        </span>
                        <Badge tone={STATUS_TONE[m.status]} className="shrink-0">
                          {statusLabel(m.status)}
                        </Badge>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section aria-labelledby="my-events">
              <h2 id="my-events" className="flex items-center gap-2 text-lg font-semibold">
                <CalendarDays className="size-4.5 text-[var(--primary)]" aria-hidden />
                {t('myEventsHeading')}
              </h2>
              {registrations.length === 0 ? (
                <p className="mt-3 rounded-xl bg-[var(--bg-subtle)] px-4 py-4 text-sm text-[var(--fg-subtle)]">
                  {t('myEventsEmpty')}
                </p>
              ) : (
                <ul className="mt-3 space-y-2.5">
                  {registrations
                    .filter((r) => r.status === 'registered' && r.events)
                    .map((r) => (
                      <li key={r.id}>
                        <Link
                          href={`/events/${r.events.slug}`}
                          className="block rounded-xl bg-[var(--surface)] p-3.5 ring-1 ring-[var(--border)] transition-shadow hover:shadow-[var(--shadow-soft)]"
                        >
                          <p className="text-xs text-[var(--fg-subtle)]">
                            {formatDateTime(r.events.starts_at, locale)}
                          </p>
                          <p className="mt-0.5 text-sm font-medium">
                            {localized(r.events, 'title', locale)}
                          </p>
                        </Link>
                      </li>
                    ))}
                </ul>
              )}
            </section>
          </aside>
        </div>
      </div>
    </SiteShell>
  )
}
