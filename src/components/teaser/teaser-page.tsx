import { getTranslations } from 'next-intl/server'
import { Compass, Sparkles, Users } from 'lucide-react'

import { Logo } from '@/components/logo'
import { Badge } from '@/components/ui/badge'
import { Countdown } from '@/components/teaser/countdown'
import { WaitlistForm } from '@/components/teaser/waitlist-form'
import { LocaleSwitcher } from '@/components/site/locale-switcher'
import { ThemeToggle } from '@/components/theme-toggle'
import type { Locale } from '@/i18n/routing'
import type { PublicSettings } from '@/lib/database.types'

const PILLARS = [
  { key: 'one', Icon: Compass, tone: 'teal' },
  { key: 'two', Icon: Users, tone: 'sage' },
  { key: 'three', Icon: Sparkles, tone: 'ember' },
] as const

const PILLAR_STYLES = {
  teal: 'bg-teal-50 text-teal-700 dark:bg-teal-950 dark:text-teal-300',
  sage: 'bg-sage-50 text-sage-700 dark:bg-sage-950 dark:text-sage-300',
  ember: 'bg-ember-50 text-ember-700 dark:bg-ember-950 dark:text-ember-300',
} as const

export async function TeaserPage({
  settings,
  locale,
}: {
  settings: PublicSettings
  locale: Locale
}) {
  const t = await getTranslations('teaser')
  const tMeta = await getTranslations('meta')
  const tFooter = await getTranslations('footer')

  const themeLabels = {
    system: locale === 'en' ? 'System theme' : 'حسب النظام',
    light: locale === 'en' ? 'Light theme' : 'الوضع الفاتح',
    dark: locale === 'en' ? 'Dark theme' : 'الوضع الداكن',
  }

  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden">
      {/* خلفية الهوية */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="bg-athar-grid mask-fade-b absolute inset-0 opacity-[0.55]" />
        <div className="absolute -top-40 start-1/2 size-[42rem] -translate-x-1/2 rounded-full bg-teal-300/30 blur-3xl dark:bg-teal-700/20 rtl:translate-x-1/2" />
        <div className="absolute -bottom-52 -end-32 size-[34rem] rounded-full bg-ember-300/30 blur-3xl dark:bg-ember-800/15" />
        <div className="absolute -bottom-40 -start-24 size-[28rem] rounded-full bg-sage-300/30 blur-3xl dark:bg-sage-800/15" />
      </div>

      <header className="container-athar flex items-center justify-between py-5">
        <span className="text-xs font-medium tracking-wide text-[var(--fg-subtle)]">
          {tMeta('ministry')}
        </span>
        <div className="flex items-center gap-0.5">
          <LocaleSwitcher current={locale} />
          <ThemeToggle labels={themeLabels} />
        </div>
      </header>

      <main className="container-athar flex flex-1 flex-col items-center justify-center py-10 text-center sm:py-16">
        <Logo variant="full" priority className="h-40 sm:h-52" alt={tMeta('siteName')} />

        <Badge tone="ember" className="mt-8">
          <span className="size-1.5 rounded-full bg-ember-500" aria-hidden />
          {t('badge')}
        </Badge>

        <h1 className="mt-6 text-balance text-3xl font-bold sm:text-5xl">
          <span className="text-athar-gradient">{tMeta('tagline')}</span>
        </h1>

        <p className="mt-5 max-w-xl text-pretty text-[0.975rem] leading-relaxed text-[var(--fg-muted)] sm:text-lg">
          {t('lead')}
        </p>

        {/* العدّاد */}
        <section className="mt-10 w-full max-w-md" aria-label={t('launchLabel')}>
          <p className="mb-3 text-sm font-medium text-[var(--fg-subtle)]">{t('launchLabel')}</p>
          <Countdown
            launchAt={settings.launch_at}
            labels={{
              days: t('days'),
              hours: t('hours'),
              minutes: t('minutes'),
              seconds: t('seconds'),
            }}
            onDone={
              <p className="rounded-xl bg-[var(--primary-soft)] px-4 py-4 font-medium text-[var(--primary)]">
                {t('launchedLabel')}
              </p>
            }
          />
        </section>

        {/* صندوق المتحمّسين */}
        <section className="mt-10 w-full max-w-lg rounded-2xl bg-[var(--surface)] p-5 shadow-[var(--shadow-soft)] ring-1 ring-[var(--border)] sm:p-6">
          <h2 className="text-lg font-semibold">{t('formHeading')}</h2>
          <p className="mt-1.5 text-sm text-[var(--fg-muted)]">{t('formLead')}</p>
          <div className="mt-4">
            <WaitlistForm />
          </div>
        </section>

        {/* الركائز الثلاث */}
        <section className="mt-16 w-full max-w-4xl" aria-labelledby="pillars-heading">
          <h2
            id="pillars-heading"
            className="text-sm font-semibold uppercase tracking-wider text-[var(--fg-subtle)]"
          >
            {t('pillars.heading')}
          </h2>
          <ul className="mt-6 grid gap-4 sm:grid-cols-3">
            {PILLARS.map(({ key, Icon, tone }) => (
              <li
                key={key}
                className="rounded-2xl bg-[var(--surface)] p-5 text-start ring-1 ring-[var(--border)] transition-shadow hover:shadow-[var(--shadow-soft)]"
              >
                <span
                  className={`inline-flex size-10 items-center justify-center rounded-xl ${PILLAR_STYLES[tone]}`}
                >
                  <Icon className="size-5" aria-hidden />
                </span>
                <h3 className="mt-4 font-semibold">{t(`pillars.${key}.title`)}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-[var(--fg-muted)]">
                  {t(`pillars.${key}.body`)}
                </p>
              </li>
            ))}
          </ul>
        </section>
      </main>

      <footer className="container-athar border-t border-[var(--border)] py-6">
        <p className="text-center text-xs text-[var(--fg-subtle)]">
          © {new Date().getFullYear()} {tFooter('ministryFull')} — {tFooter('rights')}
        </p>
      </footer>
    </div>
  )
}
