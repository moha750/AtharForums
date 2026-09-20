import Link from 'next/link'

import './globals.css'

export default function GlobalNotFound() {
  return (
    <html lang="ar" dir="rtl">
      <body className="grid min-h-dvh place-items-center bg-[var(--bg)] p-6 text-center">
        <div className="space-y-3">
          <p className="text-5xl font-semibold text-[var(--primary)]">٤٠٤</p>
          <h1 className="text-xl font-semibold text-[var(--fg)]">الصفحة غير موجودة</h1>
          <Link
            href="/"
            className="inline-block text-sm font-medium text-[var(--primary)] underline underline-offset-4"
          >
            العودة للرئيسية
          </Link>
        </div>
      </body>
    </html>
  )
}
