import { notFound } from 'next/navigation'
import { getTranslations, setRequestLocale } from 'next-intl/server'

import { Logo } from '@/components/logo'
import { LoginForm } from '@/components/auth/login-form'
import { Link } from '@/i18n/navigation'
import { isLocale } from '@/i18n/routing'
import { createClient } from '@/lib/supabase/server'
import { redirect } from '@/i18n/navigation'

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  if (!isLocale(locale)) return {}
  const t = await getTranslations({ locale, namespace: 'auth' })
  return { title: t('loginHeading'), robots: { index: false, follow: false } }
}

export default async function LoginPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ next?: string; error?: string }>
}) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  setRequestLocale(locale)

  const { next, error } = await searchParams

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (user) redirect({ href: '/me', locale })

  const t = await getTranslations('auth')
  const tMeta = await getTranslations('meta')

  return (
    <main className="grid min-h-dvh place-items-center px-5 py-12">
      <div className="w-full max-w-md">
        <Link href="/" className="mx-auto block w-fit">
          <Logo variant="full" className="h-24" priority alt={tMeta('siteName')} />
        </Link>

        <div className="mt-8 rounded-2xl bg-[var(--surface)] p-6 shadow-[var(--shadow-soft)] ring-1 ring-[var(--border)] sm:p-8">
          <div className="mb-6 space-y-1.5 text-center">
            <h1 className="text-2xl font-semibold">{t('loginHeading')}</h1>
            <p className="text-sm text-[var(--fg-muted)]">
              {t('loginLead', { ministry: tMeta('ministry') })}
            </p>
          </div>

          <LoginForm next={next} ministry={tMeta('ministry')} linkError={error === 'link'} />
        </div>
      </div>
    </main>
  )
}
