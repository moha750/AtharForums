import { notFound } from 'next/navigation'
import { getTranslations, setRequestLocale } from 'next-intl/server'

import { FaqList } from '@/components/site/faq-list'
import { SiteShell } from '@/components/site/site-shell'
import { isLocale } from '@/i18n/routing'
import { Link } from '@/i18n/navigation'
import { getFaqs } from '@/lib/data'
import { buttonStyles } from '@/components/ui/button'

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  if (!isLocale(locale)) return {}
  const t = await getTranslations({ locale, namespace: 'faq' })
  return { title: t('heading'), description: t('lead') }
}

export default async function FaqPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  setRequestLocale(locale)

  const [t, faqs] = await Promise.all([getTranslations('faq'), getFaqs()])

  return (
    <SiteShell locale={locale}>
      <div className="container-athar py-12 sm:py-16">
        <header className="mx-auto max-w-2xl text-center">
          <h1 className="text-3xl font-bold sm:text-4xl">{t('heading')}</h1>
          <p className="mt-3 text-pretty leading-relaxed text-[var(--fg-muted)]">{t('lead')}</p>
        </header>

        <div className="mx-auto mt-10 max-w-3xl">
          {faqs.length > 0 ? (
            <FaqList items={faqs} locale={locale} />
          ) : (
            <p className="rounded-xl bg-[var(--bg-subtle)] p-8 text-center text-[var(--fg-muted)] ring-1 ring-[var(--border)]">
              {t('empty')}
            </p>
          )}

          <div className="mt-10 rounded-2xl bg-[var(--bg-subtle)] p-6 text-center ring-1 ring-[var(--border)]">
            <p className="font-medium">{t('stillHeading')}</p>
            <p className="mt-1 text-sm text-[var(--fg-muted)]">{t('stillLead')}</p>
            <Link href="/about#contact" className={`${buttonStyles('secondary', 'md')} mt-4`}>
              {t('stillCta')}
            </Link>
          </div>
        </div>
      </div>
    </SiteShell>
  )
}
