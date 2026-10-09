import { notFound } from 'next/navigation'
import { getTranslations, setRequestLocale } from 'next-intl/server'

import { redirect } from '@/i18n/navigation'
import { isLocale } from '@/i18n/routing'
import { Logo } from '@/components/logo'
import { QrNav } from '@/components/qr/qr-nav'
import { getCurrentProfile, isAdmin } from '@/lib/auth'
import { getQrPermissions } from '@/lib/qr/server'

export const dynamic = 'force-dynamic'

/**
 * مساحة الباركود لحاملي صلاحيته — موظّفًا كان أو مشرفًا. خارج /admin عمدًا:
 * صلاحية المولّد لا تعني صلاحية لوحة التحكم.
 */
export default async function QrLayout({
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

  const [t, perms] = await Promise.all([getTranslations('qr'), getQrPermissions()])

  if (!perms.any) {
    return (
      <main className="grid min-h-dvh place-items-center px-6 text-center">
        <div className="space-y-4">
          <Logo variant="mark" className="mx-auto h-14" />
          <p className="max-w-sm text-[var(--fg-muted)]">{t('noAccess')}</p>
        </div>
      </main>
    )
  }

  const items = [
    ...(perms.use
      ? [
          { key: 'singles' as const, href: '/qr', label: t('nav.singles') },
          { key: 'campaigns' as const, href: '/qr/campaigns', label: t('nav.campaigns') },
        ]
      : []),
    ...(perms.oversee ? [{ key: 'oversight' as const, href: '/qr/oversight', label: t('nav.oversight') }] : []),
    ...(isAdmin(profile) ? [{ key: 'admin' as const, href: '/admin', label: t('nav.admin') }] : []),
  ]

  return (
    <div className="min-h-dvh bg-[var(--bg-subtle)]">
      <div className="container-athar grid gap-8 py-8 lg:grid-cols-[15rem_minmax(0,1fr)]">
        <aside className="lg:sticky lg:top-8 lg:self-start">
          <div className="flex items-center gap-2.5 px-3 pb-5">
            <Logo variant="mark" className="h-8" />
            <span className="text-sm font-semibold">{t('heading')}</span>
          </div>
          <QrNav items={items} backLabel={t('nav.back')} label={t('nav.label')} locale={locale} />
        </aside>
        <main id="main" className="min-w-0">
          {children}
        </main>
      </div>
    </div>
  )
}
