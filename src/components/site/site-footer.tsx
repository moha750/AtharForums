import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/navigation'
import { Logo } from '@/components/logo'
import { MinistryLogo } from '@/components/ministry-logo'
import type { PublicSettings } from '@/lib/database.types'

export async function SiteFooter({ settings }: { settings: PublicSettings }) {
  const t = await getTranslations('footer')
  const tNav = await getTranslations('nav')
  const tMeta = await getTranslations('meta')

  const links = [
    { href: '/forums', label: tNav('forums') },
    { href: '/events', label: tNav('events') },
    { href: '/news', label: tNav('news') },
    { href: '/about', label: tNav('about') },
    { href: '/faq', label: tNav('faq') },
  ] as const

  return (
    <footer className="mt-20 border-t border-[var(--border)] bg-[var(--bg-subtle)]">
      <div className="container-athar grid gap-8 py-10 sm:grid-cols-[1.4fr_1fr]">
        <div className="space-y-4">
          <div className="flex flex-wrap items-end gap-5">
            {/* قاعدة الهوية: إذا اجتمع الشعاران في صفّ واحد تقدّم الوزارة ثم أثر. */}
            <MinistryLogo className="h-16" alt={tMeta('branch')} />
            <Logo variant="full" className="h-20" alt={tMeta('siteName')} />
          </div>
          <p className="max-w-sm text-sm leading-relaxed text-[var(--fg-muted)]">
            {tMeta('description')}
          </p>
        </div>

        <nav aria-label={tNav('menu')} className="flex flex-col gap-2 text-sm sm:items-end">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-[var(--fg-muted)] transition-colors hover:text-[var(--fg)]"
            >
              {link.label}
            </Link>
          ))}
          {settings.contact_email ? (
            <a
              href={`mailto:${settings.contact_email}`}
              className="text-[var(--fg-muted)] transition-colors hover:text-[var(--fg)]"
            >
              {t('contact')}
            </a>
          ) : null}
        </nav>
      </div>

      <div className="border-t border-[var(--border)]">
        <div className="container-athar space-y-1 py-5 text-center text-xs text-[var(--fg-subtle)]">
          <p>
            © {new Date().getFullYear()} {t('ministryFull')} — {t('rights')}
          </p>
          <p>{t('credit')}</p>
        </div>
      </div>
    </footer>
  )
}
