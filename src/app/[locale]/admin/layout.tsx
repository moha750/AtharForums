import { notFound } from 'next/navigation'
import { getTranslations, setRequestLocale } from 'next-intl/server'

import { redirect } from '@/i18n/navigation'
import { Logo } from '@/components/logo'
import { AdminNav } from '@/components/admin/admin-nav'
import { getCurrentProfile, isAdmin } from '@/lib/auth'
import { isLocale } from '@/i18n/routing'

export const dynamic = 'force-dynamic'

export default async function AdminLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  setRequestLocale(locale)

  const profile = await getCurrentProfile()
  if (!profile) {
    redirect({ href: '/login', locale })
    return null
  }
  if (!isAdmin(profile)) {
    const t = await getTranslations('admin')
    return (
      <main className="grid min-h-dvh place-items-center px-6 text-center">
        <div className="space-y-4">
          <Logo variant="mark" className="mx-auto h-14" />
          <p className="text-[var(--fg-muted)]">{t('noAccess')}</p>
        </div>
      </main>
    )
  }

  const t = await getTranslations('admin')
  const items = [
    { key: 'overview' as const, href: '/admin', label: t('navOverview') },
    { key: 'forums' as const, href: '/admin/forums', label: t('navForums') },
    { key: 'applications' as const, href: '/admin/applications', label: t('navApplications') },
    { key: 'members' as const, href: '/admin/members', label: t('navMembers') },
    { key: 'events' as const, href: '/admin/events', label: t('navEvents') },
    { key: 'news' as const, href: '/admin/news', label: t('navNews') },
    { key: 'waitlist' as const, href: '/admin/waitlist', label: t('navWaitlist') },
    { key: 'settings' as const, href: '/admin/settings', label: t('navSettings') },
  ]

  return (
    <div className="min-h-dvh bg-[var(--bg-subtle)]">
      <div className="container-athar grid gap-8 py-8 lg:grid-cols-[15rem_minmax(0,1fr)]">
        <aside className="lg:sticky lg:top-8 lg:self-start">
          <div className="flex items-center gap-2.5 px-3 pb-5">
            <Logo variant="mark" className="h-8" />
            <span className="text-sm font-semibold">{t('heading')}</span>
          </div>
          <AdminNav items={items} backLabel={t('backToSite')} locale={locale} />
        </aside>

        <main id="main" className="min-w-0">
          {children}
        </main>
      </div>
    </div>
  )
}
