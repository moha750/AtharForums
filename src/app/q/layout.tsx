import type { Metadata, Viewport } from 'next'

import '@fontsource/ibm-plex-sans-arabic/400.css'
import '@fontsource/ibm-plex-sans-arabic/500.css'
import '@fontsource/ibm-plex-sans-arabic/600.css'
import '@fontsource-variable/ibm-plex-sans'
import '../globals.css'

import { themeBootstrapScript } from '@/components/theme-toggle'
import { siteUrl } from '@/lib/env'

/**
 * تخطيط جذري للصفحتين العامّتين خلف الباركود (غير متاح، وعرض الملف).
 * خارج مسار اللغة عمدًا: الرابط المطبوع /q/… لا يحمل لغة ولا يُحوَّل.
 */

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: 'مساحة أثر',
  icons: { icon: '/athar-mark.svg', apple: '/athar-mark.svg' },
  robots: { index: false, follow: false },
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0c1416' },
  ],
}

export default function PublicQrLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrapScript }} />
      </head>
      <body className="min-h-dvh bg-[var(--bg-subtle)] text-[var(--fg)] antialiased">{children}</body>
    </html>
  )
}
