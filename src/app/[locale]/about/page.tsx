import { notFound } from 'next/navigation'
import { ArrowLeft, ArrowRight, Mail } from 'lucide-react'
import { getTranslations, setRequestLocale } from 'next-intl/server'

import { SiteShell } from '@/components/site/site-shell'
import { Link } from '@/i18n/navigation'
import { Logo } from '@/components/logo'
import { buttonStyles } from '@/components/ui/button'
import { requireLaunched } from '@/lib/gate'
import { isLocale } from '@/i18n/routing'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  if (!isLocale(locale)) return {}
  const t = await getTranslations({ locale, namespace: 'about' })
  return { title: t('heading') }
}

export default async function AboutPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  setRequestLocale(locale)

  const settings = await requireLaunched(locale)
  const [t, tMeta] = await Promise.all([getTranslations('about'), getTranslations('meta')])

  const about = locale === 'en' ? settings.about_en : settings.about_ar
  const Arrow = locale === 'en' ? ArrowRight : ArrowLeft
  const steps = [t('howOne'), t('howTwo'), t('howThree'), t('howFour')]

  return (
    <SiteShell locale={locale} settings={settings}>
      <div className="container-athar max-w-3xl py-12 sm:py-16">
        <Logo variant="full" className="h-28" alt={tMeta('siteName')} />

        <h1 className="mt-8 text-3xl font-bold sm:text-4xl">{t('heading')}</h1>

        <section className="mt-8" aria-labelledby="mission">
          <h2 id="mission" className="text-xl font-semibold">
            {t('missionHeading')}
          </h2>
          <p className="mt-3 whitespace-pre-line text-lg leading-relaxed text-[var(--fg-muted)]">
            {about ?? tMeta('description')}
          </p>
        </section>

        <section className="mt-12" aria-labelledby="how">
          <h2 id="how" className="text-xl font-semibold">
            {t('howHeading')}
          </h2>
          <ol className="mt-5 space-y-4">
            {steps.map((step, i) => (
              <li key={i} className="flex gap-4">
                <span className="font-latin grid size-8 shrink-0 place-items-center rounded-full bg-[var(--primary-soft)] text-sm font-semibold text-[var(--primary)]">
                  {i + 1}
                </span>
                <p className="pt-1 leading-relaxed text-[var(--fg-muted)]">{step}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="mt-12 rounded-2xl bg-athar-gradient p-7 text-white sm:p-9" aria-labelledby="join">
          <h2 id="join" className="text-2xl font-semibold">
            {t('joinHeading')}
          </h2>
          <p className="mt-2 text-white/85">{t('joinLead')}</p>
          <Link
            href="/forums"
            className="mt-5 inline-flex h-11 items-center gap-2 rounded-lg bg-white px-5 font-medium text-[var(--color-teal-700)] transition-colors hover:bg-white/90"
          >
            {t('joinHeading')}
            <Arrow className="size-4" aria-hidden />
          </Link>
        </section>

        {settings.contact_email ? (
          <section className="mt-10" aria-labelledby="contact">
            <h2 id="contact" className="text-xl font-semibold">
              {t('contactHeading')}
            </h2>
            <a
              href={`mailto:${settings.contact_email}`}
              className={`${buttonStyles('secondary', 'md')} mt-3`}
            >
              <Mail className="size-4" aria-hidden />
              <span dir="ltr" className="font-latin">
                {settings.contact_email}
              </span>
            </a>
          </section>
        ) : null}
      </div>
    </SiteShell>
  )
}
