import type { Metadata, Viewport } from 'next'
import { notFound } from 'next/navigation'
import { NextIntlClientProvider } from 'next-intl'
import { getMessages, getTranslations, setRequestLocale } from 'next-intl/server'

import '@fontsource/ibm-plex-sans-arabic/300.css'
import '@fontsource/ibm-plex-sans-arabic/400.css'
import '@fontsource/ibm-plex-sans-arabic/500.css'
import '@fontsource/ibm-plex-sans-arabic/600.css'
import '@fontsource/ibm-plex-sans-arabic/700.css'
import '@fontsource-variable/ibm-plex-sans'
import '../globals.css'

import { routing, isLocale, localeDirection, type Locale } from '@/i18n/routing'
import { themeBootstrapScript } from '@/components/theme-toggle'
import { siteUrl } from '@/lib/env'

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }))
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0c1416' },
  ],
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  if (!isLocale(locale)) return {}
  const t = await getTranslations({ locale, namespace: 'meta' })

  return {
    metadataBase: new URL(siteUrl()),
    title: { default: t('siteName'), template: `%s · ${t('siteName')}` },
    description: t('description'),
    applicationName: t('siteName'),
    icons: { icon: '/athar-mark.svg', apple: '/athar-mark.svg' },
    openGraph: {
      type: 'website',
      siteName: t('siteName'),
      title: t('siteName'),
      description: t('description'),
      locale: locale === 'en' ? 'en' : 'ar_SA',
    },
    alternates: {
      languages: { ar: '/ar', en: '/en' },
    },
    robots: { index: true, follow: true },
  }
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()

  setRequestLocale(locale)
  const messages = await getMessages()

  return (
    <html
      lang={locale}
      dir={localeDirection[locale as Locale]}
      data-scroll-behavior="smooth"
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrapScript }} />
      </head>
      <body className="min-h-dvh bg-[var(--bg)] text-[var(--fg)] antialiased">
        <NextIntlClientProvider messages={messages}>{children}</NextIntlClientProvider>
      </body>
    </html>
  )
}
