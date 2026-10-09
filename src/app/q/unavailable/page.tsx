import type { Metadata } from 'next'
import Link from 'next/link'
import { ScanLine } from 'lucide-react'

import { Logo } from '@/components/logo'
import { buttonStyles } from '@/components/ui/button'

export const metadata: Metadata = {
  title: 'الباركود غير متاح',
  robots: { index: false, follow: false },
}

/**
 * وجهة واحدة للمجهول والموقوف وعطل القراءة — لا تقول أيّها، فلا يُستدلّ
 * منها على وجود رمز بعينه.
 */
export default function QrUnavailablePage() {
  return (
    <main className="grid min-h-dvh place-items-center px-5 py-16">
      <div className="w-full max-w-md rounded-2xl bg-[var(--surface)] p-8 text-center shadow-[var(--shadow-soft)] ring-1 ring-[var(--border)]">
        <Logo variant="mark" className="mx-auto h-14" />
        <span className="mx-auto mt-6 grid size-12 place-items-center rounded-full bg-[var(--primary-soft)] text-[var(--primary)]">
          <ScanLine className="size-6" aria-hidden />
        </span>
        <h1 className="mt-4 text-xl font-semibold">هذا الباركود غير متاح الآن</h1>
        <p className="mt-2 leading-relaxed text-[var(--fg-muted)]">
          ربما أُوقف مؤقّتًا أو انتهى استخدامه. إن وصلك من جهة تعرفها فتواصل معها.
        </p>
        <p dir="ltr" lang="en" className="font-latin mt-4 text-sm text-[var(--fg-subtle)]">
          This QR code isn’t available right now.
        </p>
        <Link href="/" className={buttonStyles('secondary', 'md', 'mt-6')}>
          مساحة أثر
        </Link>
      </div>
    </main>
  )
}
