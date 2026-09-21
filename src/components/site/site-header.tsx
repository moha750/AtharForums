import { getTranslations } from 'next-intl/server'
import { LayoutDashboard, LogIn, Settings2 } from 'lucide-react'

import { Link } from '@/i18n/navigation'
import { Logo } from '@/components/logo'
import { MinistryLogo } from '@/components/ministry-logo'
import { LocaleSwitcher } from '@/components/site/locale-switcher'
import { MobileNav } from '@/components/site/mobile-nav'
import { ThemeToggle } from '@/components/theme-toggle'
import { buttonStyles } from '@/components/ui/button'
import { getCurrentProfile, isAdmin } from '@/lib/auth'
import type { Locale } from '@/i18n/routing'

export async function SiteHeader({ locale }: { locale: Locale }) {
  const t = await getTranslations('nav')
  const tMeta = await getTranslations('meta')
  const profile = await getCurrentProfile()

  const links = [
    { href: '/forums', label: t('forums') },
    { href: '/events', label: t('events') },
    { href: '/news', label: t('news') },
    { href: '/about', label: t('about') },
  ] as const

  const themeLabels = {
    system: locale === 'en' ? 'System theme' : 'حسب النظام',
    light: locale === 'en' ? 'Light theme' : 'الوضع الفاتح',
    dark: locale === 'en' ? 'Dark theme' : 'الوضع الداكن',
  }

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-[color-mix(in_srgb,var(--bg)_88%,transparent)] backdrop-blur-md">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:start-4 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-[var(--primary)] focus:px-3 focus:py-2 focus:text-sm focus:text-[var(--primary-fg)]"
      >
        {t('skipToContent')}
      </a>

      <div className="container-athar flex h-16 items-center gap-3">
        <Link href="/" className="flex shrink-0 items-center gap-2.5">
          <Logo variant="mark" className="h-9" alt={tMeta('siteName')} />
          <span className="hidden text-[0.95rem] font-semibold sm:inline">
            {tMeta('siteName')}
          </span>
        </Link>

        <nav aria-label={t('menu')} className="ms-4 hidden items-center gap-1 md:flex">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-lg px-3 py-2 text-sm font-medium text-[var(--fg-muted)] transition-colors hover:bg-[var(--bg-subtle)] hover:text-[var(--fg)]"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="ms-auto flex items-center gap-1">
          <MinistryLogo
            variant="symbol"
            className="me-2 hidden h-8 border-e border-[var(--border)] pe-3 sm:inline-block"
            alt={tMeta('branch')}
          />
          <LocaleSwitcher current={locale} />
          <ThemeToggle labels={themeLabels} />

          {profile ? (
            <div className="hidden items-center gap-1 md:flex">
              {isAdmin(profile) ? (
                <Link href="/admin" className={buttonStyles('ghost', 'sm')}>
                  <Settings2 className="size-4" aria-hidden />
                  {t('admin')}
                </Link>
              ) : null}
              <Link href="/me" className={buttonStyles('secondary', 'sm')}>
                <LayoutDashboard className="size-4" aria-hidden />
                {t('dashboard')}
              </Link>
            </div>
          ) : (
            <Link href="/login" className={`${buttonStyles('primary', 'sm')} hidden md:inline-flex`}>
              <LogIn className="size-4" aria-hidden />
              {t('login')}
            </Link>
          )}

          <MobileNav
            links={[...links]}
            signedIn={Boolean(profile)}
            isAdmin={isAdmin(profile)}
            labels={{
              menu: t('menu'),
              close: t('closeMenu'),
              login: t('login'),
              dashboard: t('dashboard'),
              admin: t('admin'),
            }}
          />
        </div>
      </div>
    </header>
  )
}
