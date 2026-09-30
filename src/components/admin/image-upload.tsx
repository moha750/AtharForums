'use client'

import { useId, useRef, useState } from 'react'
import Image from 'next/image'
import { useTranslations } from 'next-intl'
import { ImageUp, Loader2, X } from 'lucide-react'

import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

/** حدّ دلو media في 0004_grants_storage.sql. تغييره هنا وحده لا يرفع الحدّ. */
const MAX_BYTES = 8 * 1024 * 1024

/**
 * الدلو يقبل SVG أيضًا، ونمنعه هنا: next/image لا يحسّن SVG إلا بتفعيل
 * dangerouslyAllowSVG، وخلفيّة البانر صورة لا رسم متجهيّ.
 */
const TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/avif']

/**
 * رفع صورة إلى دلو media، وإخراج رابطها العامّ في حقل مخفيّ باسم `name`
 * ليصل مع بقيّة النموذج إلى إجراء الخادم.
 *
 * الرفع يتمّ من المتصفّح مباشرة إلى Supabase: المرور بالخادم يعني تحميل
 * ثمانية ميغابايت إلى الذاكرة ثمّ رفعها ثانية، بلا فائدة. وسياسة الدلو هي
 * التي تحرس الكتابة — لا هذا المكوّن.
 */
export function ImageUpload({
  name,
  defaultUrl,
  folder = 'uploads',
  className,
}: {
  name: string
  defaultUrl?: string | null
  folder?: string
  className?: string
}) {
  const t = useTranslations('admin')
  const inputId = useId()
  const fileRef = useRef<HTMLInputElement>(null)
  // مسارات رفعناها في هذه الجلسة ثمّ استُبدلت — تُحذف كي لا تتراكم يتيمة.
  const orphans = useRef<string[]>([])

  const [url, setUrl] = useState(defaultUrl ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)

  async function handle(file: File) {
    setError(null)
    if (!TYPES.includes(file.type)) return setError(t('uploadBadType'))
    if (file.size > MAX_BYTES) return setError(t('uploadTooBig'))

    setBusy(true)
    try {
      const supabase = createClient()
      const ext = (file.name.split('.').pop() ?? '').toLowerCase().replace(/[^a-z0-9]/g, '')
      const path = `${folder}/${crypto.randomUUID()}.${ext || 'jpg'}`

      const { error: uploadError } = await supabase.storage
        .from('media')
        .upload(path, file, { contentType: file.type, cacheControl: '31536000' })
      if (uploadError) throw uploadError

      const { data } = supabase.storage.from('media').getPublicUrl(path)

      const previous = orphans.current.pop()
      if (previous) await supabase.storage.from('media').remove([previous])
      orphans.current.push(path)

      setUrl(data.publicUrl)
    } catch {
      setError(t('uploadFailed'))
    } finally {
      setBusy(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <div className={cn('space-y-2', className)}>
      <input type="hidden" name={name} value={url} />
      <input
        ref={fileRef}
        id={inputId}
        type="file"
        accept={TYPES.join(',')}
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) void handle(file)
        }}
      />

      {url ? (
        <div className="relative overflow-hidden rounded-xl ring-1 ring-[var(--border)]">
          <div className="relative aspect-[16/6] bg-[var(--bg-subtle)]">
            <Image src={url} alt="" fill sizes="(min-width: 640px) 40rem, 100vw" className="object-cover" />
          </div>
          <div className="flex items-center justify-between gap-2 bg-[var(--surface)] px-3 py-2">
            <label
              htmlFor={inputId}
              className="cursor-pointer text-sm font-medium text-[var(--primary)] hover:underline"
            >
              {busy ? t('uploadBusy') : t('uploadReplace')}
            </label>
            <button
              type="button"
              onClick={() => setUrl('')}
              className="inline-flex items-center gap-1 text-sm text-[var(--fg-subtle)] transition-colors hover:text-[var(--danger)]"
            >
              <X className="size-4" aria-hidden />
              {t('uploadRemove')}
            </button>
          </div>
        </div>
      ) : (
        <label
          htmlFor={inputId}
          onDragOver={(e) => {
            e.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDragging(false)
            const file = e.dataTransfer.files?.[0]
            if (file) void handle(file)
          }}
          className={cn(
            'flex aspect-[16/6] cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 text-center transition-colors',
            dragging
              ? 'border-[var(--primary)] bg-[var(--primary-soft)]'
              : 'border-[var(--border-strong)] bg-[var(--bg-subtle)] hover:border-[var(--primary)]'
          )}
        >
          {busy ? (
            <Loader2 className="size-6 animate-spin text-[var(--primary)]" aria-hidden />
          ) : (
            <ImageUp className="size-6 text-[var(--fg-subtle)]" aria-hidden />
          )}
          <span className="text-sm font-medium text-[var(--fg)]">
            {busy ? t('uploadBusy') : t('uploadPrompt')}
          </span>
          <span className="text-xs text-[var(--fg-subtle)]">{t('uploadHint')}</span>
        </label>
      )}

      {error ? (
        <p role="alert" className="text-sm text-[var(--danger)]">
          {error}
        </p>
      ) : null}
    </div>
  )
}
