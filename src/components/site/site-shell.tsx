import { SiteHeader } from '@/components/site/site-header'
import { SiteFooter } from '@/components/site/site-footer'
import type { Locale } from '@/i18n/routing'
import type { PublicSettings } from '@/lib/database.types'

export function SiteShell({
  locale,
  settings,
  children,
}: {
  locale: Locale
  settings: PublicSettings
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader locale={locale} />
      <main id="main" className="flex-1">
        {children}
      </main>
      <SiteFooter settings={settings} />
    </div>
  )
}
