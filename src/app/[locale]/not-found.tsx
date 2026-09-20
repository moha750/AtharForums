import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/navigation'
import { buttonStyles } from '@/components/ui/button'
import { Logo } from '@/components/logo'

export default async function NotFound() {
  const t = await getTranslations('common')

  return (
    <main className="grid min-h-dvh place-items-center px-6 py-20 text-center">
      <div className="space-y-6">
        <Logo variant="mark" className="mx-auto h-16" />
        <div className="space-y-2">
          <p className="font-latin text-5xl font-semibold text-[var(--primary)]">404</p>
          <h1 className="text-2xl font-semibold">{t('notFoundHeading')}</h1>
          <p className="mx-auto max-w-sm text-[var(--fg-muted)]">{t('notFoundLead')}</p>
        </div>
        <Link href="/" className={buttonStyles('primary', 'md')}>
          {t('backHome')}
        </Link>
      </div>
    </main>
  )
}
