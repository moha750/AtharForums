'use client'

import { useId, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Download, Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { QR_EXPORT_SIZE } from '@/lib/qr/config'
import { downloadName, logoBox, renderSvg } from '@/lib/qr/render'
import { readSpec, type QrSpec } from '@/lib/qr/spec'
import { cn } from '@/lib/utils'

/**
 * المعاينة: الـSVG نفسه الذي يُنزَّل، مرسومًا في الصفحة.
 * القيمة المخزّنة تمرّ بـ readSpec أولًا — لا يُرسم شيء لم يُصدَّق.
 */
export function QrPreview({
  spec,
  className,
  label,
}: {
  spec: QrSpec
  className?: string
  label?: string
}) {
  const id = useId()
  const svg = useMemo(() => renderSvg(spec, { idPrefix: `qr${id}` }), [spec, id])
  return (
    <div
      role="img"
      aria-label={label}
      className={cn('[&>svg]:block [&>svg]:h-auto [&>svg]:w-full', className)}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  )
}

/** للصفحات التي تستلم الوصفة خامًا من القاعدة. */
export function StoredQrPreview({ raw, text, className, label }: { raw: unknown; text: string; className?: string; label?: string }) {
  const spec = useMemo(() => readSpec(raw, text), [raw, text])
  return <QrPreview spec={spec} className={className} label={label} />
}

/* ── التنزيل ──────────────────────────────────────────────────────────────── */

let fontCssCache: Promise<string> | null = null

async function toBase64(url: string): Promise<string> {
  const buffer = await (await fetch(url)).arrayBuffer()
  let binary = ''
  const bytes = new Uint8Array(buffer)
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  }
  return btoa(binary)
}

/** خطّ النداء مضمَّنًا في الملف: الملف المنزَّل لا يرى خطوط الصفحة. */
function captionFontCss(): Promise<string> {
  fontCssCache ??= Promise.all([
    toBase64('/qr-fonts/caption-arabic-600.woff2'),
    toBase64('/qr-fonts/caption-latin-600.woff2'),
  ])
    .then(
      ([arabic, latin]) =>
        `@font-face{font-family:'QR Caption';font-weight:600;src:url(data:font/woff2;base64,${arabic}) format('woff2');unicode-range:U+0600-06FF,U+0750-077F,U+0870-08FF,U+200C-200E,U+FB50-FDFF,U+FE70-FEFC}` +
        `@font-face{font-family:'QR Caption';font-weight:600;src:url(data:font/woff2;base64,${latin}) format('woff2');unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+2000-206F,U+20AC,U+2122}`
    )
    .catch(() => {
      fontCssCache = null
      return ''
    })
  return fontCssCache
}

async function exportSvg(spec: QrSpec, withLogo = true): Promise<string> {
  const fontCss = spec.frame?.caption ? await captionFontCss() : undefined
  const target = withLogo ? spec : { ...spec, logo: null }
  return renderSvg(target, { width: QR_EXPORT_SIZE, idPrefix: 'qr', fontCss })
}

function save(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 4000)
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.decoding = 'async'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('image'))
    img.src = src
  })
}

async function drawPng(svg: string, width: number, height: number, extra?: (ctx: CanvasRenderingContext2D) => Promise<void>): Promise<Blob> {
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }))
  try {
    const img = await loadImage(url)
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(img, 0, 0, width, height)
    if (extra) await extra(ctx)
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('png'))), 'image/png')
    )
  } finally {
    URL.revokeObjectURL(url)
  }
}

/**
 * PNG يُشتقّ من SVG برسمه على canvas — فالمعاينة هي المُنزَّل نفسه.
 * بعض المتصفّحات ترفض تصدير canvas رُسم عليه SVG فيه صورة؛ حينها نرسم
 * الباركود بلا الشعار ثم الشعار فوقه في موضعه نفسه.
 */
async function pngOf(spec: QrSpec): Promise<Blob> {
  const svg = await exportSvg(spec)
  const ratio = /viewBox="0 0 ([\d.]+) ([\d.]+)"/.exec(svg)
  const width = QR_EXPORT_SIZE
  const height = ratio ? Math.round((width * Number(ratio[2])) / Number(ratio[1])) : width
  try {
    return await drawPng(svg, width, height)
  } catch {
    const box = logoBox(spec)
    const bare = await exportSvg(spec, false)
    return drawPng(bare, width, height, async (ctx) => {
      if (!box || !spec.logo) return
      const logo = await loadImage(spec.logo.href)
      const scale = width / box.width
      const side = box.size * scale
      const fit = Math.min(side / logo.naturalWidth, side / logo.naturalHeight)
      const w = logo.naturalWidth * fit
      const h = logo.naturalHeight * fit
      ctx.drawImage(logo, box.x * scale + (side - w) / 2, box.y * scale + (side - h) / 2, w, h)
    })
  }
}

export function DownloadButtons({ spec, title, className }: { spec: QrSpec; title: string; className?: string }) {
  const t = useTranslations('qr.design')
  const [busy, setBusy] = useState<'png' | 'svg' | null>(null)

  async function run(kind: 'png' | 'svg') {
    setBusy(kind)
    try {
      if (kind === 'svg') {
        save(new Blob([await exportSvg(spec)], { type: 'image/svg+xml' }), downloadName(title, 'svg'))
      } else {
        save(await pngOf(spec), downloadName(title, 'png'))
      }
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      <Button size="sm" onClick={() => run('png')} disabled={busy !== null}>
        {busy === 'png' ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Download className="size-4" aria-hidden />}
        {busy === 'png' ? t('downloading') : t('downloadPng')}
      </Button>
      <Button size="sm" variant="secondary" onClick={() => run('svg')} disabled={busy !== null}>
        {busy === 'svg' ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Download className="size-4" aria-hidden />}
        {t('downloadSvg')}
      </Button>
    </div>
  )
}

/** المعاينة مع التنزيل من وصفة واحدة — لا تُرسل الوصفة (وشعارها) مرّتين. */
export function StoredQrCard({ raw, text, title, label }: { raw: unknown; text: string; title: string; label?: string }) {
  const spec = useMemo(() => readSpec(raw, text), [raw, text])
  return (
    <>
      <div className="mx-auto max-w-72 rounded-xl bg-white p-3 ring-1 ring-[var(--border)]">
        <QrPreview spec={spec} label={label} />
      </div>
      <DownloadButtons spec={spec} title={title} className="mt-4 justify-center" />
    </>
  )
}
