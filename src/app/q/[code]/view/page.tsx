import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { Download, ExternalLink, FileText } from 'lucide-react'

import { Logo } from '@/components/logo'
import { buttonStyles } from '@/components/ui/button'
import { env } from '@/lib/env'
import { isCodeShape } from '@/lib/qr/code'
import { FILE_BUCKET } from '@/lib/qr/config'
import { fileExtOf, fileKindOf, isFilePath } from '@/lib/qr/file-path'
import { anonRpc } from '@/lib/qr/rpc'

/**
 * صفحة العرض العلنية لباركود من نوع ملف: /q/{code}/view
 *
 * فتحها مباشرةً لا يُعَدّ — العدّ في /q/{code} وحده، وهو الذي يحوّل إلى هنا.
 * لا يظهر اسم الباركود ولا مالكه: file_of() لا تُرجع إلا المسار.
 */

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'ملف',
  robots: { index: false, follow: false },
}

function publicUrl(path: string, download?: string): string {
  const base = `${env.supabaseUrl}/storage/v1/object/public/${FILE_BUCKET}/${path}`
  return download ? `${base}?download=${encodeURIComponent(download)}` : base
}

export default async function QrFileViewPage({ params }: { params: Promise<{ code: string }> }) {
  const { code: raw } = await params
  let code = ''
  try {
    code = decodeURIComponent(raw).trim().toLowerCase()
  } catch {
    redirect('/q/unavailable')
  }
  if (!isCodeShape(code)) redirect('/q/unavailable')

  let path: string | null = null
  try {
    path = await anonRpc<string | null>('qr_file_of', { p_code: code })
  } catch (error) {
    console.error('[qr] تعذّر قراءة ملف الباركود', error)
  }
  if (!path || !isFilePath(path)) redirect('/q/unavailable')

  const kind = fileKindOf(path)
  const name = `athar-${code}.${fileExtOf(path)}`

  return (
    <main className="flex min-h-dvh flex-col items-center gap-6 px-4 py-8 sm:py-12">
      <Logo variant="mark" className="h-10" />

      {kind === 'image' ? (
        <figure className="flex w-full max-w-3xl flex-col items-center gap-5">
          {/* صورة المستخدم كما هي: لا تحسين من next/image ولا قصّ */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={publicUrl(path)}
            alt=""
            className="max-h-[78dvh] w-auto max-w-full rounded-xl bg-[var(--surface)] object-contain shadow-[var(--shadow-soft)] ring-1 ring-[var(--border)]"
          />
          <a href={publicUrl(path, name)} className={buttonStyles('primary', 'lg')}>
            <Download className="size-5" aria-hidden />
            احفظ الصورة
          </a>
        </figure>
      ) : (
        <section className="w-full max-w-sm rounded-2xl bg-[var(--surface)] p-7 text-center shadow-[var(--shadow-soft)] ring-1 ring-[var(--border)]">
          <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-[var(--primary-soft)] text-[var(--primary)]">
            <FileText className="size-7" aria-hidden />
          </span>
          <h1 className="mt-4 text-lg font-semibold">ملف PDF</h1>
          <p className="mt-1 text-sm text-[var(--fg-muted)]">افتحه في المتصفّح أو احفظه على جهازك.</p>
          <div className="mt-6 grid gap-2.5">
            <a href={publicUrl(path)} target="_blank" rel="noopener" className={buttonStyles('primary', 'lg')}>
              <ExternalLink className="size-5" aria-hidden />
              افتح
            </a>
            <a href={publicUrl(path, name)} className={buttonStyles('secondary', 'lg')}>
              <Download className="size-5" aria-hidden />
              احفظ
            </a>
          </div>
        </section>
      )}
    </main>
  )
}
