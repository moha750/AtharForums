import { notFound } from 'next/navigation'
import { getTranslations, setRequestLocale } from 'next-intl/server'

import { SiteShell } from '@/components/site/site-shell'
import { ForumsBrowser } from '@/components/forums/forums-browser'
import { getPublishedForums } from '@/lib/data'
import { requireLaunched } from '@/lib/gate'
import { isLocale } from '@/i18n/routing'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  if (!isLocale(locale)) return {}
  const t = await getTranslations({ locale, namespace: 'forums' })
  return { title: t('heading'), description: t('lead') }
}

export default async function ForumsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  setRequestLocale(locale)

  const settings = await requireLaunched(locale)
  const [forums, t] = await Promise.all([getPublishedForums(), getTranslations('forums')])

  return (
    <SiteShell locale={locale} settings={settings}>
      <div className="container-athar py-12 sm:py-16">
        <header className="max-w-2xl">
          <h1 className="text-3xl font-bold sm:text-4xl">{t('heading')}</h1>
          <p className="mt-3 text-pretty leading-relaxed text-[var(--fg-muted)]">{t('lead')}</p>
        </header>

        <div className="mt-8">
          <ForumsBrowser forums={forums} locale={locale} />
        </div>
      </div>
    </SiteShell>
  )
}
