import { notFound } from 'next/navigation'
import { setRequestLocale } from 'next-intl/server'

import { TeaserPage } from '@/components/teaser/teaser-page'
import { HomePage } from '@/components/home/home-page'
import { SiteShell } from '@/components/site/site-shell'
import { getPublicSettings, hasLaunched } from '@/lib/settings'
import { getCurrentProfile, isStaff } from '@/lib/auth'
import { isLocale } from '@/i18n/routing'

export const dynamic = 'force-dynamic'

export default async function IndexPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  setRequestLocale(locale)

  const settings = await getPublicSettings()
  const launched = hasLaunched(settings)

  if (!launched) {
    // فريق أثر يرى الموقع الكامل للمراجعة قبل التدشين
    const profile = await getCurrentProfile()
    if (!isStaff(profile)) {
      return <TeaserPage settings={settings} locale={locale} />
    }
  }

  return (
    <SiteShell locale={locale} settings={settings}>
      <HomePage locale={locale} settings={settings} />
    </SiteShell>
  )
}
